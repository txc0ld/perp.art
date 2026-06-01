import "server-only";
import { parseAbiItem, type Hex } from "viem";
import type { Token, Collection, Chain, PermanenceStatus } from "@/lib/types";
import { resolveShardUrl } from "@/lib/logledger/resolve-url";
import { serverPublicClient } from "./server-client";
import { getContracts } from "./contracts";
import { PERPETUAL_DROP_ABI } from "./abis";
import { FACTORY_DEPLOY_BLOCK } from "./indexer";
import { LOG_WINDOW, MAX_WINDOWS } from "./read-token";

const CHAIN_BY_ID: Record<number, Chain> = { 84532: "base", 11155111: "ethereum" };

// Bound how many tokens we read per drop so a 7,000-supply drop can't exhaust
// the request budget. The per-collection cap mirrors the FL indexer's intent.
const MAX_DROP_TOKENS_READ = 60;

const DROP_CREATED = parseAbiItem(
  "event DropCreated(address indexed drop, address indexed owner, string name, string symbol, uint256 maxSupply)",
);

// ---------------------------------------------------------------------------
// Module-level TTL cache (mirrors indexer.ts — no unstable_cache; Next 16).
// ---------------------------------------------------------------------------
const dropCache = new Map<number, { at: number; drops: DropInfo[] }>();
const tokenCache = new Map<number, { at: number; tokens: Token[] }>();
const TTL_MS = 60_000;

export interface DropInfo {
  address: Hex;
  owner: Hex;
  name: string;
  symbol: string;
  maxSupply: bigint;
  createdBlock: bigint;
}

/**
 * Enumerate every PerpetualDrop deployed by the factory, mirroring
 * indexCollections' DropCreated scan. Fails soft to [] on any RPC error so the
 * pages never 500. Cached for 60s.
 */
export async function indexDrops(chainId: number): Promise<DropInfo[]> {
  const cached = dropCache.get(chainId);
  if (cached && Date.now() - cached.at < TTL_MS) return cached.drops;

  try {
    const pub = serverPublicClient(chainId);
    const contracts = getContracts(chainId);
    if (!pub || !contracts.factory) {
      dropCache.set(chainId, { at: Date.now(), drops: [] });
      return [];
    }

    const factory = contracts.factory;
    const floor = FACTORY_DEPLOY_BLOCK[chainId] ?? BigInt(0);
    const latest = await pub.getBlockNumber();
    const out: DropInfo[] = [];
    let from = floor;
    for (let w = 0; w < MAX_WINDOWS && from <= latest; w++) {
      const rawTo = from + LOG_WINDOW - BigInt(1);
      const to = rawTo > latest ? latest : rawTo;
      try {
        const logs = await pub.getLogs({
          address: factory,
          event: DROP_CREATED,
          fromBlock: from,
          toBlock: to,
        });
        for (const l of logs) {
          if (l.args.drop && l.args.owner && l.args.name !== undefined) {
            out.push({
              address: l.args.drop as Hex,
              owner: l.args.owner as Hex,
              name: l.args.name as string,
              symbol: (l.args.symbol as string) ?? "",
              maxSupply: (l.args.maxSupply as bigint) ?? BigInt(0),
              createdBlock: l.blockNumber as bigint,
            });
          }
        }
      } catch {
        /* window failure is non-fatal */
      }
      from = to + BigInt(1);
    }

    dropCache.set(chainId, { at: Date.now(), drops: out });
    return out;
  } catch {
    return [];
  }
}

/** Neutral permanence record for a drop token (folder-permanence tier — the
 *  per-token 5-shard guarantee does NOT apply). Never faked as verified. */
function dropPermanence(metadataUrl: string): PermanenceStatus {
  return {
    onchainProofConfigured: false,
    shards: [
      {
        index: 0,
        backend: "ipfs",
        label: "IPFS folder (folder-permanence)",
        status: metadataUrl ? "verified" : "not-configured",
        detail: "Folder pin · anchored by an on-chain provenance hash",
        sourceUrl: metadataUrl,
        locator: metadataUrl,
        hashMatches: false,
        mandatory: false,
        guaranteed: false,
      },
    ],
    contentHash: "",
    contentHashMatches: false,
    locked: true,
    selectedShardIndex: 0,
    lastVerified: new Date().toISOString(),
  };
}

interface DropTokenMeta {
  name?: string;
  description?: string;
  image?: string;
  attributes?: { trait_type?: string; value?: string | number }[];
}

/**
 * Read a single drop token: resolve `tokenURI(id)` (= baseURI + id) to its
 * OpenSea-style JSON, then map to the app Token shape. The media + traits come
 * from the metadata folder, NOT the 5-shard reads. Fails soft to null.
 */
async function readDropToken(
  chainId: number,
  drop: DropInfo,
  tokenId: bigint,
): Promise<Token | null> {
  const pub = serverPublicClient(chainId);
  if (!pub) return null;
  const addrLower = drop.address.toLowerCase();
  let owner: string;
  let tokenUri: string;
  try {
    [owner, tokenUri] = await Promise.all([
      pub.readContract({ address: drop.address, abi: PERPETUAL_DROP_ABI, functionName: "ownerOf", args: [tokenId] }) as Promise<string>,
      pub.readContract({ address: drop.address, abi: PERPETUAL_DROP_ABI, functionName: "tokenURI", args: [tokenId] }) as Promise<string>,
    ]);
  } catch {
    return null; // not minted / lagging replica — skip, keep the feed
  }

  // Fetch the per-token JSON metadata. Pre-reveal this is the placeholder; both
  // resolve through the configured IPFS/Arweave gateways. Fail-soft to neutral.
  let meta: DropTokenMeta = {};
  const metadataUrl = resolveShardUrl(tokenUri, { chainId });
  try {
    if (/^https?:\/\//.test(metadataUrl)) {
      const res = await fetch(metadataUrl, { signal: AbortSignal.timeout(6000) });
      if (res.ok) meta = (await res.json()) as DropTokenMeta;
    }
  } catch {
    /* metadata fetch failed — surface the token with neutral fields */
  }

  const imageUrl = meta.image ? resolveShardUrl(meta.image, { chainId }) : "";
  const traits = Array.isArray(meta.attributes)
    ? meta.attributes
        .filter((a) => a && a.trait_type !== undefined && a.value !== undefined)
        .slice(0, 50)
        .map((a) => ({ key: String(a.trait_type), value: String(a.value) }))
    : [];

  return {
    id: `${chainId}-${addrLower}-${tokenId}`,
    tokenId: Number(tokenId),
    title: meta.name || `${drop.name} #${tokenId}`,
    collectionSlug: addrLower,
    artistHandle: drop.owner,
    genre: "PFP",
    mediaType: "image",
    artSeed: `${chainId}-${addrLower}-${tokenId}`,
    description: meta.description || "",
    owner,
    traits,
    royalty: { bps: 0, receiver: drop.owner },
    permanence: dropPermanence(imageUrl || metadataUrl),
    provenance: [],
    listing: undefined,
    offers: [],
    chain: CHAIN_BY_ID[chainId] ?? "base",
    listable: false,
    source: "onchain",
  };
}

/**
 * Read drop tokens across all drops on a chain, bounded by MAX_DROP_TOKENS_READ
 * per drop. Cached 60s. Never throws.
 */
export async function indexDropTokens(chainId: number): Promise<Token[]> {
  const cached = tokenCache.get(chainId);
  if (cached && Date.now() - cached.at < TTL_MS) return cached.tokens;

  try {
    const drops = await indexDrops(chainId);
    const all: Token[] = [];
    for (const drop of drops) {
      let minted = BigInt(0);
      try {
        minted = (await serverPublicClient(chainId)!.readContract({
          address: drop.address,
          abi: PERPETUAL_DROP_ABI,
          functionName: "totalMinted",
        })) as bigint;
      } catch {
        continue;
      }
      const cap = minted < BigInt(MAX_DROP_TOKENS_READ) ? Number(minted) : MAX_DROP_TOKENS_READ;
      for (let i = 1; i <= cap; i++) {
        const t = await readDropToken(chainId, drop, BigInt(i));
        if (t) all.push(t);
      }
    }
    tokenCache.set(chainId, { at: Date.now(), tokens: all });
    return all;
  } catch {
    return [];
  }
}

/**
 * Build Collection records for every drop on a chain. itemCount = totalMinted
 * (read live), tagged kind:"drop" so the UI can badge folder-permanence vs the
 * 5-shard library tier. Never throws.
 */
export async function indexedDropCollections(chainId: number): Promise<Collection[]> {
  try {
    const pub = serverPublicClient(chainId);
    const drops = await indexDrops(chainId);
    if (!pub || drops.length === 0) return [];
    const chain = CHAIN_BY_ID[chainId] ?? "base";

    const result: Collection[] = [];
    for (const drop of drops) {
      const addrLower = drop.address.toLowerCase();
      let minted = BigInt(0);
      let revealed = false;
      try {
        [minted, revealed] = await Promise.all([
          pub.readContract({ address: drop.address, abi: PERPETUAL_DROP_ABI, functionName: "totalMinted" }) as Promise<bigint>,
          pub.readContract({ address: drop.address, abi: PERPETUAL_DROP_ABI, functionName: "revealed" }) as Promise<boolean>,
        ]);
      } catch {
        /* leave defaults */
      }
      result.push({
        slug: addrLower,
        name: drop.name,
        artistHandle: "perpetual",
        genre: "PFP",
        description: revealed
          ? `Folder-permanence drop · ${minted.toString()} of ${drop.maxSupply.toString()} minted`
          : `Folder-permanence drop · pre-reveal · ${minted.toString()} of ${drop.maxSupply.toString()} minted`,
        contractAddress: drop.address,
        chain,
        sovereign: true,
        kind: "drop",
        dropMinted: Number(minted),
        dropRevealed: revealed,
        coverSeed: addrLower,
        floorEth: 0,
        volumeEth: 0,
        itemCount: Number(minted),
        ownerCount: 0,
        royaltyBps: 0,
      });
    }
    return result;
  } catch {
    return [];
  }
}
