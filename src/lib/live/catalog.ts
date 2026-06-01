import "server-only";

/**
 * Live data layer. Aggregates the on-chain indexer across the chains where
 * Forever Library is deployed (the live/testnet chains). Returns ONLY real
 * indexed data — empty arrays / zeroed stats when there is none. Never throws:
 * the indexer already fails soft to [], so every accessor degrades to empty.
 *
 * Caching is delegated to the indexer (60s TTL); we add none here.
 */
import { formatEther } from "viem";
import type { Token, Collection, Chain } from "@/lib/types";
import { indexAllTokens, indexedCollections, indexCollections } from "@/lib/web3/indexer";
import { indexDropTokens, indexedDropCollections } from "@/lib/web3/drops-indexer";
import { getContracts } from "@/lib/web3/contracts";
import { listAllOpenOrders } from "@/lib/web3/orderbook";

/** Map a numeric chain id to the Token `chain` tag (mirrors read-token.ts). */
const CHAIN_BY_ID: Record<number, Chain> = { 84532: "base", 11155111: "ethereum" };

/** A single open listing aggregated from the orderbook, keyed by token id. */
export interface OpenListing {
  priceWei: bigint;
  seller: string;
  orderHash: string;
  chainId: number;
  /** endTime (unix seconds) from the order, 0 = no expiry. */
  endTime: bigint;
}

/** Token-id key matching read-token.ts: `${chainId}-${nft.toLowerCase()}-${tokenId}`. */
function listingKey(chainId: number, nft: string, tokenId: bigint): string {
  return `${chainId}-${nft.toLowerCase()}-${tokenId}`;
}

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

/**
 * Aggregate every open listing across the live chains, keyed by token id
 * (`${chainId}-${nft.toLowerCase()}-${tokenId}`). When a token has multiple
 * open orders, the lowest-priced one wins (the marketplace floor for it).
 * Never throws: an orderbook failure on one chain degrades to no listings.
 */
export async function getOpenListings(): Promise<Map<string, OpenListing>> {
  const map = new Map<string, OpenListing>();
  const batches = await Promise.all(
    LIVE_CHAIN_IDS.map(async (chainId) => {
      try {
        return await listAllOpenOrders(chainId);
      } catch {
        return [];
      }
    }),
  );

  for (const orders of batches) {
    for (const signed of orders) {
      const { chainId, orderHash } = signed;
      const { nft, tokenId, price, seller, endTime } = signed.order;
      const key = listingKey(chainId, nft, tokenId);
      const existing = map.get(key);
      // Keep the lowest-priced open order for each token.
      if (!existing || price < existing.priceWei) {
        map.set(key, {
          priceWei: price,
          seller,
          orderHash,
          chainId,
          endTime,
        });
      }
    }
  }
  return map;
}

/**
 * All live on-chain tokens across the live chains, enriched with their open
 * marketplace listing (`token.listing`) when one exists. Tokens with no open
 * order keep `listing: undefined`. This is the base accessor every surface
 * (explore / home / collections) consumes, so listings are populated once here.
 */
export async function getLiveTokens(): Promise<Token[]> {
  const [{ all }, listings] = await Promise.all([getLiveTokensSplit(), getOpenListings()]);
  return enrichWithListings(all, listings);
}

/**
 * PURE. Attach each token's open marketplace listing (`token.listing`) when one
 * exists in the supplied listings map; tokens with no open order pass through
 * unchanged. Exported so surfaces that already hold both tokens and listings can
 * enrich without re-fetching.
 */
export function enrichWithListings(tokens: Token[], listings: Map<string, OpenListing>): Token[] {
  if (listings.size === 0) return tokens;
  return tokens.map((t) => {
    const open = listings.get(t.id);
    if (!open) return t;
    const chain = CHAIN_BY_ID[open.chainId] ?? t.chain;
    return {
      ...t,
      listing: {
        orderId: open.orderHash,
        priceEth: Number(formatEther(open.priceWei)),
        chain,
        seller: open.seller,
        // endTime 0 means "no expiry"; surface a far-future ISO so the
        // Listing shape (which requires expiresAt) stays well-formed.
        expiresAt:
          open.endTime > BigInt(0)
            ? new Date(Number(open.endTime) * 1000).toISOString()
            : new Date(8640000000000000).toISOString(),
      },
    };
  });
}

/** Live tokens that currently have an open listing — the active marketplace. */
export async function getLiveListedTokens(): Promise<Token[]> {
  const tokens = await getLiveTokens();
  return tokens.filter((t) => t.listing !== undefined);
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
  const [libBatches, dropBatches] = await Promise.all([
    Promise.all(LIVE_CHAIN_IDS.map((id) => indexedCollections(id))),
    Promise.all(LIVE_CHAIN_IDS.map((id) => indexedDropCollections(id))),
  ]);
  // Tag library collections explicitly so the UI can distinguish the
  // 5-shard tier from folder-permanence drops (drops already carry kind:"drop").
  const libraries = libBatches.flat().map((c) => ({ ...c, kind: c.kind ?? ("library" as const) }));
  return [...libraries, ...dropBatches.flat()];
}

/**
 * Live sovereign collections deployed by an address (the on-chain factory
 * `CollectionCreated.owner`). The rich Collection record (item/owner counts,
 * chain) is sourced from indexedCollections; the deployer address comes from
 * indexCollections (CollectionInfo carries `owner`, the domain Collection does
 * not). Returns only sovereign contracts the address actually deployed — the
 * canonical Forever Library (owner 0x0) is never attributed to anyone.
 * Never throws: degrades to [].
 */
export async function getLiveCollectionsByOwner(address: string): Promise<Collection[]> {
  const a = address.toLowerCase();
  try {
    const [infoBatches, collections] = await Promise.all([
      Promise.all(LIVE_CHAIN_IDS.map((id) => indexCollections(id))),
      getLiveCollections(),
    ]);
    const ownedSlugs = new Set<string>();
    for (const infos of infoBatches) {
      for (const info of infos) {
        if (info.owner.toLowerCase() === a) {
          ownedSlugs.add(info.address.toLowerCase());
        }
      }
    }
    return collections.filter(
      (c) => c.sovereign && ownedSlugs.has(c.contractAddress.toLowerCase()),
    );
  } catch {
    return [];
  }
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

/**
 * The library (5-shard) and drop (folder-permanence) token tiers, fetched once.
 * Surfaces that need BOTH the flattened token list AND the per-tier split (e.g.
 * the home page, which renders tokens and also derives market stats) should call
 * this and pass the split into computeMarketStats — avoiding a second index pass.
 * Mirrors getLiveTokens ordering: library tokens first, then drop tokens.
 */
export async function getLiveTokensSplit(): Promise<{
  libraryTokens: Token[];
  dropTokens: Token[];
  all: Token[];
}> {
  const [libBatches, dropBatches] = await Promise.all([
    Promise.all(LIVE_CHAIN_IDS.map((id) => indexAllTokens(id))),
    Promise.all(LIVE_CHAIN_IDS.map((id) => indexDropTokens(id))),
  ]);
  const libraryTokens = libBatches.flat();
  const dropTokens = dropBatches.flat();
  return { libraryTokens, dropTokens, all: [...libraryTokens, ...dropTokens] };
}

/**
 * PURE. Derive the market stats from already-fetched tier-split tokens and
 * collections — no indexing. The home page (and any caller that already holds
 * this data) uses this directly so the indexer isn't run a second time.
 *
 * Permanence integrity / onchain proof are scoped to the 5-shard library tier
 * only: drop tokens are folder-permanence by design (no STATE shard), so
 * including them would force both to ~0% even when every library token is fully
 * verified. Counts (works / collections / shards) cover all tiers.
 */
export function computeMarketStats(
  libraryTokens: Token[],
  dropTokens: Token[],
  collections: Collection[],
): LiveMarketStats {
  const tokens = [...libraryTokens, ...dropTokens];
  if (tokens.length === 0) {
    return { works: 0, collections: 0, verifiedShards: 0, permanenceIntegrity: 0, onchainProofRate: 0 };
  }

  // verifiedShards counts every shard across all tiers (folder-permanence shards
  // can be verified too).
  const verifiedShards = tokens.reduce(
    (n, t) => n + t.permanence.shards.filter((s) => s.status === "verified").length,
    0,
  );

  // Honest 0 when there are no library tokens (never faked to 100).
  const withOnchainProof = libraryTokens.filter((t) => t.permanence.onchainProofConfigured).length;
  const onchainProofRate =
    libraryTokens.length === 0 ? 0 : Math.round((withOnchainProof / libraryTokens.length) * 100);
  const integrityOk = libraryTokens.filter(
    (t) => t.permanence.onchainProofConfigured && t.permanence.contentHashMatches,
  ).length;
  const permanenceIntegrity =
    libraryTokens.length === 0 ? 0 : Math.round((integrityOk / libraryTokens.length) * 100);

  return {
    works: tokens.length,
    collections: collections.length,
    verifiedShards,
    permanenceIntegrity,
    onchainProofRate,
  };
}

/**
 * Market stats for direct callers that don't already hold the token/collection
 * data. Fetches the tier-split tokens + collections (all 60s-cached) and
 * delegates to computeMarketStats. Surfaces that already fetched tokens should
 * call computeMarketStats with their own data instead, to avoid re-indexing.
 */
export async function getLiveMarketStats(): Promise<LiveMarketStats> {
  const { libraryTokens, dropTokens, all } = await getLiveTokensSplit();
  if (all.length === 0) {
    return { works: 0, collections: 0, verifiedShards: 0, permanenceIntegrity: 0, onchainProofRate: 0 };
  }
  const collections = await getLiveCollections();
  return computeMarketStats(libraryTokens, dropTokens, collections);
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
