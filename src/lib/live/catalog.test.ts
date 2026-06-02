/**
 * Unit tests for the live-catalog listing enrichment (no network).
 *
 * We mock the two server-only dependencies catalog.ts loads at import time:
 *   - web3/contracts  → so LIVE_CHAIN_IDS resolves to [84532] without env.
 *   - web3/orderbook  → so listAllOpenOrders returns fixtures, never hitting Blob.
 *   - web3/indexer    → so getLiveTokens has a deterministic token set.
 *
 * ES2017: BigInt() constructor only, no BigInt literals.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SignedOrder } from "@/lib/web3/orders";
import type { Token } from "@/lib/types";

// --- mock contracts so LIVE_CHAIN_IDS = [84532] -----------------------------
vi.mock("@/lib/web3/contracts", () => ({
  getContracts: (chainId?: number) =>
    chainId === 84532
      ? { foreverLibrary: "0x000000000000000000000000000000000000fee1" }
      : {},
}));

// --- mock orderbook: tests set the fixture per case --------------------------
const listAllOpenOrders = vi.fn<(chainId: number) => Promise<SignedOrder[]>>();
vi.mock("@/lib/web3/orderbook", () => ({
  listAllOpenOrders: (chainId: number) => listAllOpenOrders(chainId),
}));

// --- mock indexer: deterministic token set ----------------------------------
const indexAllTokens = vi.fn<(chainId: number) => Promise<Token[]>>();
vi.mock("@/lib/web3/indexer", () => ({
  indexAllTokens: (chainId: number) => indexAllTokens(chainId),
  indexedCollections: async () => [],
  indexCollections: async () => [],
}));

// --- mock drops indexer: folder-permanence tier (default empty) --------------
const indexDropTokens = vi.fn<(chainId: number) => Promise<Token[]>>();
vi.mock("@/lib/web3/drops-indexer", () => ({
  indexDropTokens: (chainId: number) => indexDropTokens(chainId),
  indexedDropCollections: async () => [],
}));

const NFT = "0x00000000000000000000000000000000000000aa";

function order(tokenId: number, priceWei: bigint, seller: string, hash: string): SignedOrder {
  return {
    order: {
      seller: seller as `0x${string}`,
      nft: NFT as `0x${string}`,
      tokenId: BigInt(tokenId),
      paymentToken: "0x0000000000000000000000000000000000000000",
      price: priceWei,
      startTime: BigInt(0),
      endTime: BigInt(0),
      counter: BigInt(0),
      salt: BigInt(tokenId),
      minSellerProceeds: BigInt(0),
    },
    signature: "0xdead",
    chainId: 84532,
    orderHash: hash as `0x${string}`,
    createdAt: 1_700_000_000 + tokenId,
  };
}

function fakeToken(tokenId: number): Token {
  return {
    id: `84532-${NFT}-${tokenId}`,
    tokenId,
    chain: "base",
    listing: undefined,
  } as Token;
}

/** A 5-shard library token with explicit permanence flags for stats tests. */
function libraryToken(
  tokenId: number,
  perm: { onchainProofConfigured: boolean; contentHashMatches: boolean; verifiedShards?: number },
): Token {
  const verified = perm.verifiedShards ?? 0;
  return {
    ...fakeToken(tokenId),
    permanence: {
      onchainProofConfigured: perm.onchainProofConfigured,
      contentHashMatches: perm.contentHashMatches,
      shards: Array.from({ length: verified }, (_, i) => ({ index: i, status: "verified" })),
    },
  } as Token;
}

/** A folder-permanence drop token: never onchain-proof configured by design. */
function dropToken(tokenId: number, verifiedShards = 0): Token {
  return {
    ...fakeToken(tokenId),
    permanence: {
      onchainProofConfigured: false,
      contentHashMatches: false,
      shards: Array.from({ length: verifiedShards }, (_, i) => ({ index: i, status: "verified" })),
    },
  } as Token;
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: no drops. Stats tests override per case.
  indexDropTokens.mockResolvedValue([]);
});

describe("getOpenListings", () => {
  it("keys by `${chainId}-${nft}-${tokenId}` and keeps the lowest-priced order", async () => {
    listAllOpenOrders.mockResolvedValue([
      order(1, BigInt(5), "0xseller1", "0xh1"),
      order(1, BigInt(3), "0xseller2", "0xh2"), // cheaper → wins for token 1
      order(2, BigInt(9), "0xseller3", "0xh3"),
    ]);

    const { getOpenListings } = await import("./catalog");
    const map = await getOpenListings();

    expect(map.size).toBe(2);
    const k1 = `84532-${NFT}-1`;
    const k2 = `84532-${NFT}-2`;
    expect(map.get(k1)?.priceWei).toBe(BigInt(3));
    expect(map.get(k1)?.orderHash).toBe("0xh2");
    expect(map.get(k1)?.seller).toBe("0xseller2");
    expect(map.get(k2)?.priceWei).toBe(BigInt(9));
  });

  it("returns an empty map when there are no open orders", async () => {
    listAllOpenOrders.mockResolvedValue([]);
    const { getOpenListings } = await import("./catalog");
    const map = await getOpenListings();
    expect(map.size).toBe(0);
  });
});

describe("getLiveTokens listing enrichment", () => {
  it("sets token.listing from the matching open order (priceEth via formatEther)", async () => {
    indexAllTokens.mockResolvedValue([fakeToken(1), fakeToken(2)]);
    listAllOpenOrders.mockResolvedValue([
      // 1 ETH for token 1, no order for token 2
      order(1, BigInt("1000000000000000000"), "0xseller1", "0xh1"),
    ]);

    const { getLiveTokens } = await import("./catalog");
    const tokens = await getLiveTokens();

    const t1 = tokens.find((t) => t.tokenId === 1)!;
    const t2 = tokens.find((t) => t.tokenId === 2)!;
    expect(t1.listing).toBeDefined();
    expect(t1.listing?.priceEth).toBe(1);
    expect(t1.listing?.orderId).toBe("0xh1");
    expect(t1.listing?.seller).toBe("0xseller1");
    expect(t1.listing?.chain).toBe("base");
    expect(t2.listing).toBeUndefined();
  });
});

describe("getLiveListedTokens", () => {
  it("returns only tokens that have an open listing", async () => {
    indexAllTokens.mockResolvedValue([fakeToken(1), fakeToken(2), fakeToken(3)]);
    listAllOpenOrders.mockResolvedValue([
      order(2, BigInt("500000000000000000"), "0xseller", "0xh2"),
    ]);

    const { getLiveListedTokens } = await import("./catalog");
    const listed = await getLiveListedTokens();
    expect(listed).toHaveLength(1);
    expect(listed[0].tokenId).toBe(2);
    expect(listed[0].listing?.priceEth).toBe(0.5);
  });
});

describe("getLiveMarketStats permanence scoping", () => {
  it("does NOT let folder-permanence drops drag library permanence to 0%", async () => {
    // Two fully-verified library tokens + three drops (folder-permanence, never
    // onchain-proof configured). Old behaviour averaged over all 5 → 40%.
    indexAllTokens.mockResolvedValue([
      libraryToken(1, { onchainProofConfigured: true, contentHashMatches: true, verifiedShards: 5 }),
      libraryToken(2, { onchainProofConfigured: true, contentHashMatches: true, verifiedShards: 5 }),
    ]);
    indexDropTokens.mockResolvedValue([dropToken(10, 1), dropToken(11, 1), dropToken(12, 1)]);
    listAllOpenOrders.mockResolvedValue([]);

    const { getLiveMarketStats } = await import("./catalog");
    const stats = await getLiveMarketStats();

    // Library tier is 100% — drops don't dilute it.
    expect(stats.permanenceIntegrity).toBe(100);
    expect(stats.onchainProofRate).toBe(100);
    // Counts still cover everything.
    expect(stats.works).toBe(5);
    expect(stats.verifiedShards).toBe(10 + 3); // 5+5 library, 1 each drop
  });

  it("reports 0% honestly when there are only drop tokens (no library tier)", async () => {
    indexAllTokens.mockResolvedValue([]);
    indexDropTokens.mockResolvedValue([dropToken(10), dropToken(11)]);
    listAllOpenOrders.mockResolvedValue([]);

    const { getLiveMarketStats } = await import("./catalog");
    const stats = await getLiveMarketStats();

    expect(stats.permanenceIntegrity).toBe(0); // honest 0, never faked 100
    expect(stats.onchainProofRate).toBe(0);
    expect(stats.works).toBe(2);
  });

  it("computes library integrity over the library tier (partial)", async () => {
    indexAllTokens.mockResolvedValue([
      libraryToken(1, { onchainProofConfigured: true, contentHashMatches: true }),
      libraryToken(2, { onchainProofConfigured: true, contentHashMatches: false }),
      libraryToken(3, { onchainProofConfigured: false, contentHashMatches: false }),
      libraryToken(4, { onchainProofConfigured: true, contentHashMatches: true }),
    ]);
    indexDropTokens.mockResolvedValue([dropToken(10)]);
    listAllOpenOrders.mockResolvedValue([]);

    const { getLiveMarketStats } = await import("./catalog");
    const stats = await getLiveMarketStats();

    // 2 of 4 library tokens fully intact → 50%; 3 of 4 onchain-proof → 75%.
    expect(stats.permanenceIntegrity).toBe(50);
    expect(stats.onchainProofRate).toBe(75);
  });

  it("returns all-zero when there are no tokens at all", async () => {
    indexAllTokens.mockResolvedValue([]);
    indexDropTokens.mockResolvedValue([]);
    listAllOpenOrders.mockResolvedValue([]);

    const { getLiveMarketStats } = await import("./catalog");
    const stats = await getLiveMarketStats();
    expect(stats).toEqual({
      works: 0,
      collections: 0,
      verifiedShards: 0,
      permanenceIntegrity: 0,
      onchainProofRate: 0,
    });
  });
});
