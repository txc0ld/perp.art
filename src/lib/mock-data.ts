/**
 * PERPETUAL MOCK DATA LAYER
 * A deterministic, internally-consistent dataset that models the PRD domain.
 * Stands in for the indexer + orderbook + permanence verification service so the
 * frontend is fully functional offline. Swap these accessors for real API calls later.
 *
 * Everything is generated from seeds (no external assets, no randomness at runtime),
 * so the same token always renders the same art, hashes, and history.
 */

import type {
  Artist, Collection, Token, Genre, StorageShard, PermanenceStatus,
  ProvenanceEvent, Offer, ShardOption, FeaturedEntry, Chain, MediaType,
  SwapOrder, SwapSide, SwapStatus,
} from "./types";
import { seededRandom, hashSeed } from "./utils";

// ---------------------------------------------------------------------------
// Deterministic helpers
// ---------------------------------------------------------------------------

function pseudoAddress(seed: string): string {
  const r = seededRandom("addr:" + seed);
  let s = "0x";
  for (let i = 0; i < 40; i++) s += Math.floor(r() * 16).toString(16);
  return s;
}

function pseudoHash(seed: string): string {
  const r = seededRandom("hash:" + seed);
  let s = "0x";
  for (let i = 0; i < 64; i++) s += Math.floor(r() * 16).toString(16);
  return s;
}

function pseudoCid(seed: string): string {
  const r = seededRandom("cid:" + seed);
  const alphabet = "abcdefghijklmnopqrstuvwxyz234567";
  let s = "bafybei";
  for (let i = 0; i < 45; i++) s += alphabet[Math.floor(r() * alphabet.length)];
  return s;
}

function pseudoTx(seed: string): string {
  return pseudoHash("tx:" + seed);
}

function isoDaysBefore(days: number): string {
  const base = Date.parse("2026-05-30T00:00:00Z");
  return new Date(base - days * 24 * 3600 * 1000).toISOString();
}

// ---------------------------------------------------------------------------
// Artists (PRD §4.1, §7.5)
// ---------------------------------------------------------------------------

const ARTIST_SEED: Array<Omit<Artist, "address" | "contractAddress" | "avatarColor">> = [
  { handle: "claudewren", name: "Claude Wren", bio: "Generative systems that erode and re-form. Obsessed with what survives a thousand years.", verified: true, sovereign: true, joinedAt: isoDaysBefore(420) },
  { handle: "marisotto", name: "Mara Isotto", bio: "Glitch as geology. Corrupted scans of places that no longer exist.", verified: true, sovereign: false, joinedAt: isoDaysBefore(310) },
  { handle: "kenjiao", name: "Kenji Ao", bio: "Long-exposure photography of light that has already left.", verified: true, sovereign: true, joinedAt: isoDaysBefore(265) },
  { handle: "pixelmonk", name: "Pixel Monk", bio: "Hand-placed pixels. Patience as a medium. Nothing here is procedural.", verified: false, sovereign: false, joinedAt: isoDaysBefore(190) },
  { handle: "novaarchive", name: "Nova Archive", bio: "Latent-space cartography. Machine dreams, pinned to permanence.", verified: true, sovereign: true, joinedAt: isoDaysBefore(140) },
  { handle: "elmsong", name: "Elm Song", bio: "Quiet abstractions. Color fields meant to outlast their walls.", verified: false, sovereign: false, joinedAt: isoDaysBefore(95) },
];

export const ARTISTS: Artist[] = ARTIST_SEED.map((a) => {
  const palette = ["#fe93ed", "#9EE6B4", "#A1A1AA", "#C4B5FD", "#FDA4AF", "#7DD3FC"];
  return {
    ...a,
    address: pseudoAddress(a.handle),
    contractAddress: pseudoAddress("contract:" + a.handle),
    avatarColor: palette[hashSeed(a.handle) % palette.length],
  };
});

// ---------------------------------------------------------------------------
// Collections (PRD §9.3)
// ---------------------------------------------------------------------------

const COLLECTION_SEED: Array<{
  slug: string; name: string; artistHandle: string; genre: Genre;
  description: string; chain: Chain; floorEth: number; royaltyBps: number; count: number;
}> = [
  { slug: "perpetual-strata", name: "Strata", artistHandle: "claudewren", genre: "Generative", description: "Sedimentary generative fields. Each layer a thousand-year deposit, computed once and fixed forever.", chain: "ethereum", floorEth: 1.8, royaltyBps: 750, count: 8 },
  { slug: "decay-atlas", name: "Decay Atlas", artistHandle: "marisotto", genre: "Glitch", description: "Maps of corrupted territory. The signal degraded; the record is permanent.", chain: "ethereum", floorEth: 0.9, royaltyBps: 1000, count: 7 },
  { slug: "afterlight", name: "Afterlight", artistHandle: "kenjiao", genre: "Photography", description: "Light that has already gone, held still. Long exposures of the briefly eternal.", chain: "base", floorEth: 1.2, royaltyBps: 800, count: 6 },
  { slug: "handset", name: "Handset", artistHandle: "pixelmonk", genre: "Pixel", description: "Every pixel placed by hand. Slowness as proof of care.", chain: "base", floorEth: 0.45, royaltyBps: 600, count: 6 },
  { slug: "latent-cartography", name: "Latent Cartography", artistHandle: "novaarchive", genre: "AI", description: "Cross-sections of a model's imagination, anchored to immutable storage.", chain: "ethereum", floorEth: 2.4, royaltyBps: 900, count: 7 },
  { slug: "quiet-fields", name: "Quiet Fields", artistHandle: "elmsong", genre: "Abstract", description: "Color meant to outlast the wall it hangs on. Restraint as permanence.", chain: "base", floorEth: 0.6, royaltyBps: 500, count: 6 },
];

// ---------------------------------------------------------------------------
// Shard + permanence generation (PRD §7.2, §9.4, §10.4)
// ---------------------------------------------------------------------------

function buildShards(seed: string, opts: { locked: boolean; cdn: boolean; failIpfs?: boolean }): StorageShard[] {
  const r = seededRandom("shard:" + seed);
  const bytes = 18_000 + Math.floor(r() * 30_000);
  const shards: StorageShard[] = [
    {
      index: 0, backend: "onchain", label: "Onchain (ethfs)", status: "verified",
      detail: `${Math.round(bytes / 1024)} KB stored onchain`, bytes,
      sourceUrl: `https://etherscan.io/address/${pseudoAddress("ethfs:" + seed)}#code`,
      hashMatches: true, mandatory: true,
    },
    {
      index: 1, backend: "ipfs", label: "IPFS",
      status: opts.failIpfs ? "failed" : "verified",
      detail: opts.failIpfs ? "pin lapsed - onchain proof backstops" : "CID matches hash",
      locator: pseudoCid(seed),
      sourceUrl: `https://ipfs.io/ipfs/${pseudoCid(seed)}`,
      hashMatches: !opts.failIpfs, mandatory: false,
    },
    {
      index: 2, backend: "arweave", label: "Arweave", status: "verified",
      detail: "confirmed permanent", locator: pseudoHash("ar:" + seed).slice(2, 45),
      sourceUrl: `https://arweave.net/${pseudoHash("ar:" + seed).slice(2, 45)}`,
      hashMatches: true, mandatory: false,
    },
    {
      index: 3, backend: "irys", label: "Irys", status: "verified",
      detail: "confirmed", locator: pseudoHash("irys:" + seed).slice(2, 45),
      sourceUrl: `https://gateway.irys.xyz/${pseudoHash("irys:" + seed).slice(2, 45)}`,
      hashMatches: true, mandatory: false,
    },
  ];
  if (opts.cdn) {
    shards.push({
      index: 4, backend: "cdn", label: "CDN (high-res)", status: "verified",
      detail: "performance mirror", sourceUrl: `https://cdn.perpetual.art/${seed}.webp`,
      hashMatches: true, mandatory: false,
    });
  }
  return shards;
}

function buildPermanence(seed: string): PermanenceStatus {
  const r = seededRandom("perm:" + seed);
  const locked = r() > 0.35;
  const cdn = r() > 0.5;
  // A small share have a lapsed IPFS pin - demonstrates onchain backstop, still 100% permanent.
  const failIpfs = r() > 0.85;
  const shards = buildShards(seed, { locked, cdn, failIpfs });
  return {
    onchainProofConfigured: true,
    shards,
    contentHash: pseudoHash("content:" + seed),
    contentHashMatches: true,
    locked,
    selectedShardIndex: cdn ? 4 : 2,
    lastVerified: isoDaysBefore(r() * 2),
  };
}

// ---------------------------------------------------------------------------
// Provenance + offers
// ---------------------------------------------------------------------------

function buildProvenance(seed: string, artistAddr: string, ownerAddr: string, mintedDaysAgo: number): ProvenanceEvent[] {
  const r = seededRandom("prov:" + seed);
  const events: ProvenanceEvent[] = [
    { kind: "created", timestamp: isoDaysBefore(mintedDaysAgo + 2) },
    { kind: "minted", timestamp: isoDaysBefore(mintedDaysAgo), blockNumber: 21_000_000 + Math.floor(r() * 900_000), txHash: pseudoTx(seed + ":mint"), to: artistAddr },
  ];
  let last = artistAddr;
  let price = 0.5 + r() * 2;
  const sales = Math.floor(r() * 3);
  let day = mintedDaysAgo - 5;
  for (let i = 0; i < sales; i++) {
    const buyer = pseudoAddress(seed + ":buyer:" + i);
    events.push({
      kind: "sale", timestamp: isoDaysBefore(Math.max(1, day)),
      blockNumber: 21_500_000 + Math.floor(r() * 900_000),
      txHash: pseudoTx(seed + ":sale:" + i), from: last, to: buyer, priceEth: +price.toFixed(3),
    });
    last = buyer;
    price *= 1 + r() * 0.8;
    day -= 8 + Math.floor(r() * 20);
  }
  return events.reverse(); // newest first
}

function buildOffers(seed: string, floorEth: number, chain: Chain): Offer[] {
  const r = seededRandom("offer:" + seed);
  const n = Math.floor(r() * 4);
  const offers: Offer[] = [];
  for (let i = 0; i < n; i++) {
    offers.push({
      orderId: "0x" + pseudoHash(seed + ":offer:" + i).slice(2, 18),
      priceEth: +(floorEth * (0.6 + r() * 0.35)).toFixed(3),
      chain,
      expiresAt: isoDaysBefore(-(1 + Math.floor(r() * 14))),
      from: pseudoAddress(seed + ":bidder:" + i),
      scope: r() > 0.6 ? "collection" : "token",
    });
  }
  return offers.sort((a, b) => b.priceEth - a.priceEth);
}

// ---------------------------------------------------------------------------
// Token title fragments (deterministic, evocative)
// ---------------------------------------------------------------------------

const TITLE_A = ["Strata", "Perpetual", "Afterlight", "Residue", "Cairn", "Palimpsest", "Sediment", "Ember", "Halftone", "Drift", "Lattice", "Aurora", "Glyph", "Relic", "Tessellate", "Umbra"];
const TITLE_B = ["No. ", "§", "Study ", "Fragment ", "Plate ", "Field ", "Index ", "Variation "];

function titleFor(seed: string, n: number): string {
  const a = TITLE_A[hashSeed(seed) % TITLE_A.length];
  const b = TITLE_B[hashSeed("b:" + seed) % TITLE_B.length];
  return `${a} ${b}${n}`;
}

const TRAIT_POOL: Record<string, string[]> = {
  Palette: ["Parchment", "Obsidian", "Verdigris", "Ash", "Gilt", "Indigo"],
  Texture: ["Eroded", "Crystalline", "Woven", "Scanned", "Burnished", "Raw"],
  Density: ["Sparse", "Measured", "Dense", "Saturated"],
  Edition: ["Unique", "1 of 1", "Artist Proof"],
  Process: ["Generative", "Hand-placed", "Captured", "Latent", "Composited"],
};

function buildTraits(seed: string): Token["traits"] {
  const r = seededRandom("trait:" + seed);
  return Object.entries(TRAIT_POOL).map(([key, values]) => {
    const value = values[Math.floor(r() * values.length)];
    return { key, value, rarity: +(0.05 + r() * 0.5).toFixed(2) };
  });
}

// ---------------------------------------------------------------------------
// Build the world
// ---------------------------------------------------------------------------

function buildWorld() {
  const collections: Collection[] = [];
  const tokens: Token[] = [];

  for (const c of COLLECTION_SEED) {
    const artist = ARTISTS.find((a) => a.handle === c.artistHandle)!;
    let volume = 0;
    const owners = new Set<string>();

    for (let i = 1; i <= c.count; i++) {
      const tokenId = i;
      const seed = `${c.slug}-${tokenId}`;
      const r = seededRandom("tok:" + seed);
      const mintedDaysAgo = 30 + Math.floor(r() * 300);
      const permanence = buildPermanence(seed);
      const provenance = buildProvenance(seed, artist.address, artist.address, mintedDaysAgo);
      const owner = provenance.find((e) => e.kind === "sale")?.to ?? artist.address;
      owners.add(owner);
      const lastSale = provenance.find((e) => e.kind === "sale")?.priceEth;
      const listed = r() > 0.45;
      const priceEth = +(c.floorEth * (1 + r() * 1.6)).toFixed(3);
      const mediaType: MediaType = c.genre === "Generative" || c.genre === "AI" ? (r() > 0.7 ? "interactive" : "image") : "image";

      const token: Token = {
        id: seed,
        tokenId,
        title: titleFor(seed, tokenId),
        collectionSlug: c.slug,
        artistHandle: c.artistHandle,
        genre: c.genre,
        mediaType,
        artSeed: seed,
        description: c.description,
        owner,
        traits: buildTraits(seed),
        royalty: { bps: c.royaltyBps, receiver: artist.address },
        permanence,
        provenance,
        offers: buildOffers(seed, c.floorEth, c.chain),
        chain: c.chain,
        listable: permanence.onchainProofConfigured && permanence.contentHashMatches,
        listing: listed
          ? {
              orderId: "0x" + pseudoHash(seed + ":listing").slice(2, 18),
              priceEth,
              chain: c.chain,
              expiresAt: isoDaysBefore(-(3 + Math.floor(r() * 21))),
              seller: owner,
            }
          : undefined,
      };
      tokens.push(token);
      volume += lastSale ?? 0;
    }

    const floor = Math.min(
      ...tokens.filter((t) => t.collectionSlug === c.slug && t.listing).map((t) => t.listing!.priceEth),
      c.floorEth,
    );

    collections.push({
      slug: c.slug,
      name: c.name,
      artistHandle: c.artistHandle,
      genre: c.genre,
      description: c.description,
      contractAddress: artist.sovereign ? artist.contractAddress : pseudoAddress("perpetual-shared"),
      chain: c.chain,
      sovereign: artist.sovereign,
      coverSeed: `${c.slug}-1`,
      floorEth: +floor.toFixed(3),
      volumeEth: +volume.toFixed(2),
      itemCount: c.count,
      ownerCount: owners.size,
      royaltyBps: c.royaltyBps,
    });
  }

  return { collections, tokens };
}

const WORLD = buildWorld();

// ---------------------------------------------------------------------------
// Public accessors (mirror an eventual indexer/orderbook API)
// ---------------------------------------------------------------------------

export const GENRES: Genre[] = ["Generative", "Glitch", "Photography", "Pixel", "AI", "Abstract"];

export function getAllTokens(): Token[] {
  return WORLD.tokens;
}

export function getToken(id: string): Token | undefined {
  return WORLD.tokens.find((t) => t.id === id);
}

export function getTokensByCollection(slug: string): Token[] {
  return WORLD.tokens.filter((t) => t.collectionSlug === slug);
}

export function getTokensByArtist(handle: string): Token[] {
  return WORLD.tokens.filter((t) => t.artistHandle === handle);
}

export function getTokensByGenre(genre: Genre): Token[] {
  return WORLD.tokens.filter((t) => t.genre === genre);
}

export function getTokensByOwner(address: string): Token[] {
  return WORLD.tokens.filter((t) => t.owner.toLowerCase() === address.toLowerCase());
}

export function getCollections(): Collection[] {
  return WORLD.collections;
}

export function getCollection(slug: string): Collection | undefined {
  return WORLD.collections.find((c) => c.slug === slug);
}

export function getArtists(): Artist[] {
  return ARTISTS;
}

export function getArtist(handle: string): Artist | undefined {
  return ARTISTS.find((a) => a.handle === handle);
}

/** Active listings sorted by recency - feeds Explore + activity. */
export function getListedTokens(): Token[] {
  return WORLD.tokens.filter((t) => t.listing);
}

/** Community-curated featured surface (PRD §11) - deterministic vote counts. */
export function getFeatured(): FeaturedEntry[] {
  return WORLD.tokens
    .map((t) => ({
      tokenId: t.id,
      genre: t.genre,
      votes: 40 + (hashSeed("vote:" + t.id) % 460),
    }))
    .sort((a, b) => b.votes - a.votes)
    .slice(0, 8);
}

export function getFeaturedTokens(): Token[] {
  return getFeatured()
    .map((f) => getToken(f.tokenId))
    .filter((t): t is Token => Boolean(t));
}

/** Full-text + trait search across the indexed catalog (PRD §9.5). */
export function searchTokens(query: string): Token[] {
  const q = query.trim().toLowerCase();
  if (!q) return WORLD.tokens;
  return WORLD.tokens.filter((t) => {
    const artist = getArtist(t.artistHandle);
    const hay = [
      t.title, t.collectionSlug, t.genre, t.artistHandle, artist?.name ?? "",
      ...t.traits.map((tr) => `${tr.key} ${tr.value}`),
    ].join(" ").toLowerCase();
    return hay.includes(q);
  });
}

/** The connected wallet (mock session). */
export const CURRENT_USER = {
  address: pseudoAddress("perpetual-you"),
  handle: "you",
  name: "Your Collection",
};

// ---------------------------------------------------------------------------
// Mint flow shard options (PRD §10.3)
// ---------------------------------------------------------------------------

export const SHARD_OPTIONS: ShardOption[] = [
  { backend: "onchain", label: "Onchain proof (ethfs)", blurb: "The permanent backstop. Survives as long as Ethereum itself.", estCostEth: 0.018, mandatory: true, defaultEnabled: true },
  { backend: "ipfs", label: "IPFS", blurb: "Content-addressed high-resolution media, auto-pinned.", estCostEth: 0.0, mandatory: false, defaultEnabled: true },
  { backend: "arweave", label: "Arweave", blurb: "Pay-once permanent storage. Confirmed forever.", estCostEth: 0.004, mandatory: false, defaultEnabled: true },
  { backend: "irys", label: "Irys (Datachain)", blurb: "Additional permanent redundancy across an independent network.", estCostEth: 0.003, mandatory: false, defaultEnabled: true },
];

/** Marketplace-wide stats for the home explainer band. */
export function getMarketStats() {
  const tokens = WORLD.tokens;
  const verifiedShards = tokens.reduce((n, t) => n + t.permanence.shards.filter((s) => s.status === "verified").length, 0);
  return {
    works: tokens.length,
    artists: ARTISTS.length,
    collections: WORLD.collections.length,
    verifiedShards,
    permanenceIntegrity: 100, // PRD §16 - primary health metric
    onchainProofRate: 100,
  };
}

// ---------------------------------------------------------------------------
// Trending / rankings (OpenSea-style discovery surfaces)
// ---------------------------------------------------------------------------

export type RankWindow = "1h" | "6h" | "24h" | "7d" | "30d";

export interface CollectionRanking {
  rank: number;
  collection: Collection;
  floorEth: number;
  volumeEth: number;     // volume within the window
  changePct: number;     // floor change within the window (can be negative)
  salesCount: number;    // sales within the window
  topOfferEth: number;
}

const WINDOW_SCALE: Record<RankWindow, number> = {
  "1h": 0.04, "6h": 0.18, "24h": 1, "7d": 5.5, "30d": 19,
};

/**
 * Deterministic, internally-consistent ranking rows for a time window.
 * Stands in for the indexer's aggregated collection stats.
 */
export function getTrendingCollections(window: RankWindow = "24h"): CollectionRanking[] {
  const scale = WINDOW_SCALE[window];
  const rows = WORLD.collections.map((c) => {
    const r = seededRandom(`rank:${c.slug}:${window}`);
    const volumeEth = +(c.volumeEth * scale * (0.6 + r() * 0.9)).toFixed(2);
    const changePct = +(((r() - 0.42) * 2) * (window === "30d" ? 60 : window === "7d" ? 38 : 22)).toFixed(1);
    const salesCount = Math.max(1, Math.round(c.itemCount * scale * (0.4 + r())));
    const topOfferEth = +(c.floorEth * (0.7 + r() * 0.25)).toFixed(3);
    return { collection: c, floorEth: c.floorEth, volumeEth, changePct, salesCount, topOfferEth, rank: 0 };
  });
  rows.sort((a, b) => b.volumeEth - a.volumeEth);
  rows.forEach((row, i) => (row.rank = i + 1));
  return rows;
}

/** Top movers by absolute floor change for the given window. */
export function getTopMovers(window: RankWindow = "24h"): CollectionRanking[] {
  return [...getTrendingCollections(window)].sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));
}

// ---------------------------------------------------------------------------
// Chains (cross-chain trading metadata)
// ---------------------------------------------------------------------------

export interface ChainMeta {
  id: Chain;
  label: string;
  short: string;
  color: string;        // accent swatch for the chain
  explorer: string;
}

export const CHAINS: Record<Chain, ChainMeta> = {
  ethereum: { id: "ethereum", label: "Ethereum Mainnet", short: "Ethereum", color: "#9eb8ff", explorer: "https://etherscan.io" },
  base: { id: "base", label: "Base", short: "Base", color: "#7dd3fc", explorer: "https://basescan.org" },
};

export function getChainMeta(c: Chain): ChainMeta {
  return CHAINS[c];
}

/** Cross-chain settlement bridge fee (flat, surfaced at point of trade). */
export const BRIDGE_FEE_ETH = 0.0009;

// ---------------------------------------------------------------------------
// Swaps: NFT-for-NFT barter + cross-chain (the differentiators, PRD §8 barter)
// ---------------------------------------------------------------------------

function side(tokenIds: string[], ethTopUp: number, chain: Chain): SwapSide {
  return { tokenIds, ethTopUp: +ethTopUp.toFixed(3), chain };
}

/** Deterministic pool of swap orders referencing real tokens. */
function buildSwaps(): SwapOrder[] {
  const swaps: SwapOrder[] = [];
  const tokens = WORLD.tokens;
  const you = CURRENT_USER.address;
  // A spread of tokens owned by "you" to seed incoming/outgoing swaps.
  const youOwned = tokens.filter((t) => t.owner.toLowerCase() === you.toLowerCase());
  const pick = (seed: string, list: Token[]) => list[hashSeed(seed) % list.length];

  for (let i = 0; i < 16; i++) {
    const r = seededRandom(`swap:${i}`);
    const target = tokens[Math.floor(r() * tokens.length)];
    const offered = tokens[Math.floor(r() * tokens.length)];
    if (!target || !offered || target.id === offered.id) continue;

    // Rotate roles: some made by you (outgoing), some directed to you (incoming), rest open.
    const role = i % 3; // 0 outgoing(you maker), 1 incoming(you taker), 2 open
    let maker = offered.owner;
    let taker: string | undefined = target.owner;
    let offer = side([offered.id], r() > 0.6 ? +(r() * 1.5).toFixed(3) : 0, offered.chain);
    let request = side([target.id], r() > 0.85 ? +(r() * 0.6).toFixed(3) : 0, target.chain);

    if (role === 0 && youOwned.length) {
      const mine = pick(`out:${i}`, youOwned);
      maker = you;
      offer = side([mine.id], r() > 0.5 ? +(r() * 1.2).toFixed(3) : 0, mine.chain);
      taker = target.owner;
      request = side([target.id], 0, target.chain);
    } else if (role === 1 && youOwned.length) {
      const mine = pick(`in:${i}`, youOwned);
      taker = you;
      request = side([mine.id], 0, mine.chain);
      maker = offered.owner;
      offer = side([offered.id], r() > 0.5 ? +(r() * 1.4).toFixed(3) : 0, offered.chain);
    }

    const crossChain = offer.chain !== request.chain;
    const statusRoll = r();
    const status: SwapStatus = statusRoll > 0.82 ? "accepted" : statusRoll > 0.72 ? "countered" : "open";

    swaps.push({
      id: "swap-" + pseudoHash("swap:" + i).slice(2, 12),
      status,
      maker,
      taker,
      offer,
      request,
      crossChain,
      createdAt: isoDaysBefore(1 + Math.floor(r() * 18)),
      expiresAt: isoDaysBefore(-(2 + Math.floor(r() * 20))),
      targetTokenId: role === 1 ? request.tokenIds[0] : target.id,
    });
  }
  return swaps;
}

const SWAPS = buildSwaps();

export function getOpenSwaps(): SwapOrder[] {
  return SWAPS.filter((s) => s.status === "open" || s.status === "countered");
}

export function getSwapsForToken(tokenId: string): SwapOrder[] {
  return SWAPS.filter(
    (s) =>
      s.targetTokenId === tokenId ||
      s.request.tokenIds.includes(tokenId) ||
      s.offer.tokenIds.includes(tokenId),
  );
}

export function getSwapsForUser(address: string): { incoming: SwapOrder[]; outgoing: SwapOrder[] } {
  const a = address.toLowerCase();
  return {
    incoming: SWAPS.filter((s) => s.taker?.toLowerCase() === a && s.maker.toLowerCase() !== a),
    outgoing: SWAPS.filter((s) => s.maker.toLowerCase() === a),
  };
}

export function getSwap(id: string): SwapOrder | undefined {
  return SWAPS.find((s) => s.id === id);
}

/** Tokens the connected user can offer in a swap (their holdings). */
export function getSwappableTokens(address: string): Token[] {
  return WORLD.tokens.filter((t) => t.owner.toLowerCase() === address.toLowerCase());
}
