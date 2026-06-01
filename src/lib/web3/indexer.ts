import "server-only";
import type { Hex } from "viem";
import { parseAbiItem } from "viem";
import type { Token, Collection } from "@/lib/types";
import { serverPublicClient } from "./server-client";
import { getContracts } from "./contracts";
import {
  readOnchainToken,
  LOG_WINDOW,
  MAX_WINDOWS,
  FL_DEPLOY_BLOCK,
} from "./read-token";

const MINTED_EVENT = parseAbiItem(
  "event TokenMinted(uint256 indexed tokenId, address indexed creator, bytes32 metadataHash, uint96 royaltyBps, uint64 timestamp, uint64 blockNumber)",
);

const MAX_TOKENS = 200;
// Per-collection cap so one large edition can't exhaust the global budget and
// starve other collections (e.g. a 100-token edition on the canonical FL hiding
// every sovereign collection's tokens). Keeps total bounded by MAX_TOKENS too.
const MAX_TOKENS_PER_COLLECTION = 100;

// ---------------------------------------------------------------------------
// Module-level TTL cache — avoids unstable_cache (AGENTS.md: Next 16 differs).
// ---------------------------------------------------------------------------
const cache = new Map<number, { at: number; tokens: Token[] }>();
const collCache = new Map<number, { at: number; cols: CollectionInfo[] }>();
const TTL_MS = 60_000;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export const FACTORY_DEPLOY_BLOCK: Record<number, bigint> = {
  84532: BigInt(42258356),
  11155111: BigInt(10965404),
};

export interface CollectionInfo {
  address: Hex;
  owner: Hex;
  name: string;
  createdBlock: bigint;
}

// ---------------------------------------------------------------------------
// indexCollections
// ---------------------------------------------------------------------------

export async function indexCollections(chainId: number): Promise<CollectionInfo[]> {
  const cached = collCache.get(chainId);
  if (cached && Date.now() - cached.at < TTL_MS) return cached.cols;

  try {
    const pub = serverPublicClient(chainId);
    const contracts = getContracts(chainId);
    if (!pub) return [];

    const COLLECTION_CREATED = parseAbiItem(
      "event CollectionCreated(address indexed collection, address indexed owner, string name, string symbol)",
    );

    const sovereign: CollectionInfo[] = [];

    if (contracts.factory) {
      const factory = contracts.factory;
      const factoryFloor = FACTORY_DEPLOY_BLOCK[chainId] ?? BigInt(0);
      const latest = await pub.getBlockNumber();
      let from = factoryFloor;
      for (let w = 0; w < MAX_WINDOWS && from <= latest; w++) {
        const rawTo = from + LOG_WINDOW - BigInt(1);
        const to = rawTo > latest ? latest : rawTo;
        try {
          const logs = await pub.getLogs({
            address: factory,
            event: COLLECTION_CREATED,
            fromBlock: from,
            toBlock: to,
          });
          for (const l of logs) {
            if (l.args.collection && l.args.owner && l.args.name !== undefined) {
              sovereign.push({
                address: l.args.collection as Hex,
                owner: l.args.owner as Hex,
                name: l.args.name as string,
                createdBlock: l.blockNumber as bigint,
              });
            }
          }
        } catch { /* window failure is non-fatal */ }
        from = to + BigInt(1);
      }
    }

    // Prepend canonical FL as the "Default (open)" collection
    const result: CollectionInfo[] = [];
    if (contracts.foreverLibrary) {
      result.push({
        address: contracts.foreverLibrary,
        owner: "0x0000000000000000000000000000000000000000" as Hex,
        name: "Default (open)",
        createdBlock: FL_DEPLOY_BLOCK[chainId] ?? BigInt(0),
      });
    }
    result.push(...sovereign);

    collCache.set(chainId, { at: Date.now(), cols: result });
    return result;
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Scan TokenMinted logs for a specific contract and return deduplicated, sorted tokenIds. */
async function enumerateTokenIdsForContract(
  pub: NonNullable<ReturnType<typeof serverPublicClient>>,
  contractAddr: Hex,
  fromBlock: bigint,
  latest: bigint,
): Promise<bigint[]> {
  const seen = new Set<string>();
  let from = fromBlock;
  for (let w = 0; w < MAX_WINDOWS && from <= latest; w++) {
    const rawTo = from + LOG_WINDOW - BigInt(1);
    const to = rawTo > latest ? latest : rawTo;
    try {
      const logs = await pub.getLogs({
        address: contractAddr,
        event: MINTED_EVENT,
        fromBlock: from,
        toBlock: to,
      });
      for (const l of logs) {
        if (l.args.tokenId !== undefined) {
          seen.add((l.args.tokenId as bigint).toString());
        }
      }
    } catch { /* non-fatal */ }
    from = to + BigInt(1);
  }
  return [...seen].map((s) => BigInt(s)).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch all on-chain tokens across all collections for a chain, with a 60 s TTL cache.
 * Never throws — returns [] on any RPC failure so pages never 500.
 */
export async function indexAllTokens(chainId: number): Promise<Token[]> {
  const cached = cache.get(chainId);
  if (cached && Date.now() - cached.at < TTL_MS) {
    return cached.tokens;
  }

  try {
    const pub = serverPublicClient(chainId);
    if (!pub) return [];

    const collections = await indexCollections(chainId);
    const latest = await pub.getBlockNumber();
    const allTokens: Token[] = [];

    for (const col of collections) {
      if (allTokens.length >= MAX_TOKENS) break;
      const ids = await enumerateTokenIdsForContract(pub, col.address, col.createdBlock, latest);
      let colCount = 0;
      for (const id of ids) {
        // Per-collection cap (so every collection contributes) AND the global
        // cap (so the total stays bounded).
        if (colCount >= MAX_TOKENS_PER_COLLECTION || allTokens.length >= MAX_TOKENS) break;
        const t = await readOnchainToken(chainId, col.address, id);
        if (t) {
          allTokens.push(t);
          colCount++;
        }
      }
      if (ids.length > colCount) {
        console.warn(
          `[indexer] collection ${col.address} truncated: indexed ${colCount} of ${ids.length} tokens (cap ${MAX_TOKENS_PER_COLLECTION}/collection, ${MAX_TOKENS} global)`,
        );
      }
    }

    cache.set(chainId, { at: Date.now(), tokens: allTokens });
    return allTokens;
  } catch {
    return [];
  }
}

/**
 * Build Collection records from the live on-chain collections and tokens.
 * Never throws — returns [] on any failure.
 */
export async function indexedCollections(chainId: number): Promise<Collection[]> {
  try {
    const collections = await indexCollections(chainId);
    const allTokens = await indexAllTokens(chainId);
    const chain = chainId === 84532 ? "base" : chainId === 11155111 ? "ethereum" : "base" as const;
    const canonicalFL = (getContracts(chainId).foreverLibrary ?? "").toLowerCase();

    const result: Collection[] = [];
    for (const col of collections) {
      const addrLower = col.address.toLowerCase();
      const colTokens = allTokens.filter((t) => t.collectionSlug === addrLower);
      // Include ALL collections, even empty ones — a freshly-deployed sovereign
      // collection is a real contract the artist paid gas for and may have
      // selected, so the owner should see it even with 0 mints. (The canonical
      // FL is always included regardless.)

      const ownerSet = new Set<string>();
      for (const t of colTokens) ownerSet.add(t.owner.toLowerCase());

      result.push({
        slug: addrLower,
        name: col.name,
        artistHandle: "perpetual",
        genre: colTokens[0]?.genre ?? "Generative",
        description: addrLower !== canonicalFL
          ? `Sovereign collection at ${col.address}`
          : "Live on-chain works minted on Perpetual.",
        contractAddress: col.address,
        chain,
        sovereign: addrLower !== canonicalFL,
        coverSeed: addrLower,
        floorEth: 0,
        volumeEth: 0,
        itemCount: colTokens.length,
        ownerCount: ownerSet.size,
        royaltyBps: 0,
      });
    }
    return result;
  } catch {
    return [];
  }
}

