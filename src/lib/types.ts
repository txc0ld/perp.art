/**
 * PERPETUAL DOMAIN MODEL
 * Faithfully mirrors the PRD - Permanence-First NFT Marketplace.
 * These types are the contract between the mock data layer and every screen.
 *
 *  - Forever Library: ERC-721 + ERC-2981, per-token external rendering, URI sharding (PRD §7)
 *  - Settlement: Seaport-compatible, royalty-enforced (PRD §8)
 *  - Indexer / Orderbook: listings, offers, sales history (PRD §9)
 *  - Permanence verification service: per-shard resolution + hash match (PRD §9.4)
 */

// ---------------------------------------------------------------------------
// Storage shards (PRD §7.2)
// ---------------------------------------------------------------------------

export type ShardBackend = "onchain" | "log" | "ipfs" | "arweave" | "irys" | "cdn";

/** Live status reported by the permanence verification service (PRD §9.4). */
export type ShardStatus = "verified" | "resolving" | "failed" | "not-configured";

export interface StorageShard {
  index: number;               // Shard 0..N. Shard 0 is the mandatory onchain proof.
  backend: ShardBackend;
  label: string;               // e.g. "Onchain (ethfs)"
  status: ShardStatus;
  /** Human-verifiable detail, e.g. "24 KB stored onchain" or "CID matches hash". */
  detail: string;
  /** Raw public source the collector can open to verify the claim independently. */
  sourceUrl: string;
  /** Bytes stored (onchain proof shard surfaces this). */
  bytes?: number;
  /** Content identifier / tx id for content-addressed backends. */
  locator?: string;
  /** Does the returned content hash match the onchain-recorded hash? */
  hashMatches: boolean;
  /** Mandatory for every token (Shard 0). */
  mandatory: boolean;
  /** Consensus-guaranteed: bytes live in contract state and cannot be pruned
   *  (the STATE/SSTORE2 proof). LOG and off-chain shards are false. */
  guaranteed?: boolean;
  /** For retention-monitored shards (LOG): last time it was confirmed
   *  reconstructable from public nodes, ISO string. */
  retentionCheckedAt?: string;
}

export interface PermanenceStatus {
  /** True only if shard0Configured && proof hash matches (PRD §9.6 gate). */
  onchainProofConfigured: boolean;
  shards: StorageShard[];
  /** Aggregate content hash recorded onchain at mint (PRD §7.3). */
  contentHash: string;
  contentHashMatches: boolean;
  /** isLocked(tokenId) - shards immutable (PRD §7.3). */
  locked: boolean;
  /** Index returned by selectedShardIndex(tokenId) for external display. */
  selectedShardIndex: number;
  /** Last time the verification service ran, ISO string. */
  lastVerified: string;
}

// ---------------------------------------------------------------------------
// Provenance (PRD §7.4)
// ---------------------------------------------------------------------------

export type ProvenanceKind = "created" | "minted" | "listed" | "offer" | "sale" | "transfer";

export interface ProvenanceEvent {
  kind: ProvenanceKind;
  timestamp: string;   // ISO
  blockNumber?: number;
  txHash?: string;
  from?: string;       // address
  to?: string;         // address
  priceEth?: number;
}

// ---------------------------------------------------------------------------
// Royalty + settlement (PRD §8)
// ---------------------------------------------------------------------------

export interface RoyaltyConfig {
  /** ERC-2981 royalty, basis points. Enforced at settlement (PRD §8.2). */
  bps: number;
  receiver: string;    // address
}

/**
 * Supported networks. Perpetual is a one-stop shop across the major NFT chains.
 * Permanence is native where Forever Library is deployed (Ethereum + EVM L2s);
 * other chains are indexed and traded with their native storage, and any pair
 * can settle a cross-chain swap via the escrow bridge.
 */
export type Chain =
  | "ethereum"
  | "base"
  | "polygon"
  | "arbitrum"
  | "optimism"
  | "zora"
  | "shape"
  | "solana"
  | "tezos"
  | "flow";

export interface Listing {
  /** Signed Seaport order id (gasless). */
  orderId: string;
  priceEth: number;
  chain: Chain;
  expiresAt: string;   // ISO
  seller: string;      // address
}

export interface Offer {
  orderId: string;
  priceEth: number;
  chain: Chain;
  expiresAt: string;
  from: string;        // address
  /** Collection or trait offer scope (PRD §9.2). */
  scope: "token" | "collection" | "trait";
  traitKey?: string;
  traitValue?: string;
}

// ---------------------------------------------------------------------------
// Token + Collection + Artist
// ---------------------------------------------------------------------------

export type Genre =
  | "Generative"
  | "AI"
  | "PFP"
  | "Photography"
  | "Illustration"
  | "3D"
  | "Pixel"
  | "Voxel"
  | "Glitch"
  | "Vector"
  | "Motion"
  | "Fractal"
  | "Collage"
  | "Audio"
  | "Abstract";

export type MediaType = "image" | "video" | "interactive";

export interface Trait {
  key: string;
  value: string;
  /** Rarity 0..1 (share of collection with this value). */
  rarity?: number;
}

export interface Artist {
  handle: string;          // slug, e.g. "claudewren"
  name: string;
  address: string;
  bio: string;
  avatarColor: string;     // generated swatch (no external avatars)
  verified: boolean;
  /** Artist deployed their own sovereign Forever Library contract (PRD §7.5). */
  sovereign: boolean;
  contractAddress: string;
  joinedAt: string;        // ISO
}

export interface Collection {
  slug: string;
  name: string;
  artistHandle: string;
  genre: Genre;
  description: string;
  contractAddress: string;
  chain: Chain;
  sovereign: boolean;
  /**
   * Permanence tier of the contract behind this collection:
   *  - "library": ForeverLibrary (5-shard, per-token permanence guarantee).
   *  - "drop": PerpetualDrop (folder-permanence — IPFS + Arweave folder anchored
   *    by one on-chain provenance hash). Distinct, weaker per-token guarantee.
   * Defaults to "library" when omitted (every pre-existing collection).
   */
  kind?: "library" | "drop";
  /** Drop-only: total tokens batch-minted so far (`totalMinted()`). */
  dropMinted?: number;
  /** Drop-only: whether the real metadata has been revealed yet. */
  dropRevealed?: boolean;
  /** Cover artwork seed for the generated visual. */
  coverSeed: string;
  floorEth: number;
  volumeEth: number;
  itemCount: number;
  ownerCount: number;
  royaltyBps: number;
}

export interface Token {
  /** Composite id used in routes: `${contractAddress}-${tokenId}` simplified to slug. */
  id: string;
  tokenId: number;
  title: string;
  collectionSlug: string;
  artistHandle: string;
  genre: Genre;
  mediaType: MediaType;
  /** Deterministic seed for the generated artwork visual (no external assets). */
  artSeed: string;
  description: string;
  owner: string;           // address
  traits: Trait[];
  royalty: RoyaltyConfig;
  permanence: PermanenceStatus;
  provenance: ProvenanceEvent[];
  listing?: Listing;
  offers: Offer[];
  chain: Chain;
  /** Listing-eligibility per PRD §9.6 (derived from permanence). */
  listable: boolean;
  /** Provenance of this record in the UI: live on-chain vs the mock demo layer. */
  source?: "onchain" | "mock";
  /** Edition info (only for tokens minted via mintEdition). */
  editionSize?: number;
  editionIndex?: number;
}

// ---------------------------------------------------------------------------
// Community curation (PRD §11)
// ---------------------------------------------------------------------------

export interface FeaturedEntry {
  tokenId: string;
  votes: number;
  genre: Genre;
}

// ---------------------------------------------------------------------------
// Mint flow (PRD §10.3)
// ---------------------------------------------------------------------------

export interface ShardOption {
  backend: ShardBackend;
  label: string;
  blurb: string;
  estCostEth: number;
  /** Onchain proof is locked-on and mandatory. */
  mandatory: boolean;
  defaultEnabled: boolean;
}

// ---------------------------------------------------------------------------
// Swaps: NFT-for-NFT barter + cross-chain settlement (the differentiators)
// Seaport natively supports multi-item / criteria barter orders, so this is
// architecturally honest. Cross-chain legs settle atomically via an escrow
// bridge with rollback (offered side locks on chain A, released on chain B).
// ---------------------------------------------------------------------------

export type SwapStatus = "open" | "accepted" | "declined" | "expired" | "countered";

export interface SwapSide {
  /** Specific tokens committed to this side of the trade. */
  tokenIds: string[];
  /** ETH added to this side to balance value (usually only one side has it). */
  ethTopUp: number;
  chain: Chain;
}

/** Criteria-based request: accept any token matching, not a specific id. */
export interface SwapCriteria {
  collectionSlug?: string;
  traitKey?: string;
  traitValue?: string;
  label: string; // human summary, e.g. "Any Strata + 0.4 ETH"
}

export interface SwapOrder {
  id: string;
  status: SwapStatus;
  maker: string;             // address proposing the swap
  taker?: string;            // directed counterparty (owner of the requested token)
  offer: SwapSide;           // what the maker gives
  request: SwapSide;         // what the maker wants (specific tokens)
  requestCriteria?: SwapCriteria; // OR an open criteria-based request
  /** offer.chain !== request.chain -> settles cross-chain. */
  crossChain: boolean;
  createdAt: string;         // ISO
  expiresAt: string;         // ISO
  /** Primary token this swap targets, for token-page surfacing. */
  targetTokenId?: string;
}
