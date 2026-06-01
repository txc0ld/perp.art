import "server-only";

/**
 * Live data layer. Aggregates the on-chain indexer across the chains where
 * Forever Library is deployed (the live/testnet chains). Returns ONLY real
 * indexed data — empty arrays / zeroed stats when there is none. Never throws:
 * the indexer already fails soft to [], so every accessor degrades to empty.
 *
 * Caching is delegated to the indexer (60s TTL); we add none here.
 */
import type { Token, Collection } from "@/lib/types";
import { indexAllTokens, indexedCollections } from "@/lib/web3/indexer";
import { getContracts } from "@/lib/web3/contracts";

/** Chain ids in the contracts REGISTRY that have a deployed Forever Library. */
export const LIVE_CHAIN_IDS: number[] = [84532, 11155111].filter(
  (id) => getContracts(id).foreverLibrary !== undefined,
);

export interface LiveMarketStats {
  works: number;
  collections: number;
  verifiedShards: number;
  permanenceIntegrity: number;
  onchainProofRate: number;
}

export async function getLiveTokens(): Promise<Token[]> {
  const batches = await Promise.all(LIVE_CHAIN_IDS.map((id) => indexAllTokens(id)));
  return batches.flat();
}

export async function getLiveToken(id: string): Promise<Token | undefined> {
  const tokens = await getLiveTokens();
  return tokens.find((t) => t.id === id);
}

export async function getLiveTokensByOwner(address: string): Promise<Token[]> {
  const a = address.toLowerCase();
  const tokens = await getLiveTokens();
  return tokens.filter((t) => t.owner.toLowerCase() === a);
}

export async function getLiveTokensByCreator(address: string): Promise<Token[]> {
  const a = address.toLowerCase();
  const tokens = await getLiveTokens();
  // The creator is recorded as the royalty receiver (read-token sets
  // royalty.receiver = mint.creator).
  return tokens.filter((t) => t.royalty.receiver.toLowerCase() === a);
}

export async function getLiveCollections(): Promise<Collection[]> {
  const batches = await Promise.all(LIVE_CHAIN_IDS.map((id) => indexedCollections(id)));
  return batches.flat();
}

export async function getLiveCollection(contract: string): Promise<Collection | undefined> {
  const c = contract.toLowerCase();
  const collections = await getLiveCollections();
  // indexedCollections sets slug = lowercased contract address; contractAddress
  // is the checksummed/hex form. Match against either.
  return collections.find(
    (col) => col.slug.toLowerCase() === c || col.contractAddress.toLowerCase() === c,
  );
}

export async function getLiveMarketStats(): Promise<LiveMarketStats> {
  const tokens = await getLiveTokens();
  if (tokens.length === 0) {
    return { works: 0, collections: 0, verifiedShards: 0, permanenceIntegrity: 0, onchainProofRate: 0 };
  }
  const collections = await getLiveCollections();
  const verifiedShards = tokens.reduce(
    (n, t) => n + t.permanence.shards.filter((s) => s.status === "verified").length,
    0,
  );
  const withOnchainProof = tokens.filter((t) => t.permanence.onchainProofConfigured).length;
  const onchainProofRate = Math.round((withOnchainProof / tokens.length) * 100);
  const integrityOk = tokens.filter(
    (t) => t.permanence.onchainProofConfigured && t.permanence.contentHashMatches,
  ).length;
  const permanenceIntegrity = Math.round((integrityOk / tokens.length) * 100);
  return {
    works: tokens.length,
    collections: collections.length,
    verifiedShards,
    permanenceIntegrity,
    onchainProofRate,
  };
}

/**
 * The real "joined" signal: the earliest mint timestamp across the tokens an
 * address created or owns. null when the address has no on-chain history.
 */
export async function getFirstActivityDate(address: string): Promise<string | null> {
  const [created, owned] = await Promise.all([
    getLiveTokensByCreator(address),
    getLiveTokensByOwner(address),
  ]);
  const seen = new Set<string>();
  const tokens: Token[] = [];
  for (const t of [...created, ...owned]) {
    if (!seen.has(t.id)) {
      seen.add(t.id);
      tokens.push(t);
    }
  }

  let earliest: number | null = null;
  for (const t of tokens) {
    for (const ev of t.provenance) {
      if (ev.kind !== "minted" && ev.kind !== "created") continue;
      const ts = Date.parse(ev.timestamp);
      if (Number.isNaN(ts)) continue;
      if (earliest === null || ts < earliest) earliest = ts;
    }
  }
  return earliest === null ? null : new Date(earliest).toISOString();
}

export async function searchLiveTokens(query: string): Promise<Token[]> {
  const tokens = await getLiveTokens();
  const q = query.trim().toLowerCase();
  if (!q) return tokens;
  return tokens.filter((t) => {
    const hay = [t.title, t.collectionSlug, t.genre, t.artistHandle].join(" ").toLowerCase();
    return hay.includes(q);
  });
}
