import "server-only";
import type { Hex } from "viem";
import { parseAbiItem } from "viem";
import type { Token, Collection } from "@/lib/types";
import { serverPublicClient } from "./server-client";
import { getContracts } from "./contracts";
import { FOREVER_LIBRARY_ABI } from "./abis";
import { readOnchainToken, scanStartBlock, LOG_WINDOW, MAX_WINDOWS } from "./read-token";

const MINTED_EVENT = parseAbiItem(
  "event TokenMinted(uint256 indexed tokenId, address indexed creator, bytes32 metadataHash, uint96 royaltyBps, uint64 timestamp, uint64 blockNumber)",
);

const MAX_TOKENS = 200;

// ---------------------------------------------------------------------------
// Module-level TTL cache — avoids unstable_cache (AGENTS.md: Next 16 differs).
// ---------------------------------------------------------------------------
const cache = new Map<number, { at: number; tokens: Token[] }>();
const TTL_MS = 60_000;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Scan TokenMinted logs for a chain and return deduplicated, sorted tokenIds. */
async function enumerateTokenIds(chainId: number): Promise<bigint[]> {
  const pub = serverPublicClient(chainId);
  const fl = getContracts(chainId).foreverLibrary;
  if (!pub || !fl) return [];

  const latest = await pub.getBlockNumber();
  let from = scanStartBlock(chainId, latest);
  const seen = new Set<string>();

  for (let w = 0; w < MAX_WINDOWS && from <= latest; w++) {
    const rawTo = from + LOG_WINDOW - BigInt(1);
    const to = rawTo > latest ? latest : rawTo;
    try {
      const logs = await pub.getLogs({
        address: fl as Hex,
        event: MINTED_EVENT,
        fromBlock: from,
        toBlock: to,
      });
      for (const l of logs) {
        if (l.args.tokenId !== undefined) {
          seen.add((l.args.tokenId as bigint).toString());
        }
      }
    } catch {
      // A single window failure is not fatal — continue scanning.
    }
    from = to + BigInt(1);
  }

  const ids = [...seen].map((s) => BigInt(s));
  ids.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return ids.slice(0, MAX_TOKENS);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch all on-chain tokens for a chain, with a 60 s TTL cache.
 * Never throws — returns [] on any RPC failure so pages never 500.
 */
export async function indexAllTokens(chainId: number): Promise<Token[]> {
  const cached = cache.get(chainId);
  if (cached && Date.now() - cached.at < TTL_MS) {
    return cached.tokens;
  }

  try {
    const tokenIds = await enumerateTokenIds(chainId);
    const results = await Promise.all(
      tokenIds.map((id) => readOnchainToken(chainId, id)),
    );
    const tokens = results.filter((t): t is Token => t !== null);
    cache.set(chainId, { at: Date.now(), tokens });
    return tokens;
  } catch {
    return [];
  }
}

/**
 * Build a synthetic Collection record from the live on-chain tokens.
 * Never throws — returns [] on any failure.
 */
export async function indexedCollections(chainId: number): Promise<Collection[]> {
  try {
    const tokens = await indexAllTokens(chainId);
    if (!tokens.length) return [];

    const chain = chainId === 84532 ? "base" : chainId === 11155111 ? "ethereum" : "base";
    const genre = tokens[0].genre;
    const contractAddress = getContracts(chainId).foreverLibrary ?? "";

    const ownerSet = new Set<string>();
    for (const t of tokens) ownerSet.add(t.owner.toLowerCase());

    const collection: Collection = {
      slug: `onchain-${chainId}`,
      name: "On-chain · Perpetual",
      artistHandle: "perpetual",
      genre,
      description: "Live on-chain works minted on Perpetual.",
      contractAddress,
      chain,
      sovereign: false,
      coverSeed: `onchain-${chainId}`,
      floorEth: 0,
      volumeEth: 0,
      itemCount: tokens.length,
      ownerCount: ownerSet.size,
      royaltyBps: 0,
    };

    return [collection];
  } catch {
    return [];
  }
}

/**
 * PURE. Merge live on-chain tokens with mock demo tokens for the explore feed.
 * Live tokens come first. Any mock token missing `source` is tagged "mock".
 * Does not mutate input arrays or objects.
 */
export function mergeForExplore(live: Token[], mock: Token[]): Token[] {
  const mockTagged = mock.map((t) =>
    t.source !== undefined ? t : { ...t, source: "mock" as const },
  );
  return [...live, ...mockTagged];
}
