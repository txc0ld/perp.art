# Perpetual - Architecture & PRD Traceability

A permanence-first NFT marketplace. **Core promise:** *Every other marketplace's NFTs break
when storage fails. Ours can't.* (PRD §1)

This document maps the four-layer architecture (PRD §6) to what is implemented in this
repository, and records which parts are real code vs. reference scaffold.

---

## The four layers (PRD §6)

| Layer | Function | Decentralization | In this repo |
|---|---|---|---|
| **Asset & Provenance** | Artwork, metadata, ownership, provenance, URI sharding | Fully permanent (Forever Library, the 6 EVM chains) | `contracts/` interfaces + reference impl (scaffold) |
| **Settlement** | Trades, royalty enforcement, NFT-for-NFT + criteria barter, cross-chain escrow | On-chain (the EVM chains) + escrow bridge for cross-chain swaps | `contracts/PerpetualSettlement.sol` (scaffold) |
| **Orderbook & Indexer** | Listings, offers, swaps, discovery, search, permanence verification, across 9 chains | Centralized, **rebuildable from public data** | `docs/INDEXER_SPEC.md` + lite live implementation (`/api/indexer/tokens`, `/api/orders`) + `src/lib/mock-data.ts` (demo gallery) |
| **Frontend** | Web app | Centralized hosting | `src/app/**`, `src/components/**` (production Next.js app) |

### Multi-chain (one-stop shop)

Perpetual indexes and trades across **nine networks**, presented as a single marketplace.
Chain metadata is authoritative in `src/lib/mock-data.ts` (`CHAINS` / `getChainMeta` / `getChains`).

| Group | Networks | Permanence | Native currency |
|---|---|---|---|
| **Permanence-native (EVM)** | Ethereum, Base, Polygon, Arbitrum, Optimism, Zora | Native: Forever Library deploys here; mandatory onchain proof shard | ETH / POL (Polygon) |
| **Indexed + traded (non-EVM)** | Solana, Tezos, Flow | Indexed and traded with native storage | SOL / XTZ / FLOW |

Discovery (explore, rankings, stats) filters across all chains at once; prices render in each
chain's native currency rather than a normalized unit. Ownership and settlement remain
chain-native; the marketplace is the unifying index, not a custodian.

### The architectural invariant (PRD §6.1, §18)
> If the operator vanishes, every NFT remains owned, resolving to its artwork via the onchain
> proof shard, with full provenance. A third party can re-index the public contracts + storage
> networks and rebuild a marketplace with zero operator cooperation.

Every design decision is tested against this. Concretely it is preserved by: (a) the mandatory
onchain proof shard, (b) royalty + settlement living entirely on-chain, and (c) the **published**
indexer spec (`docs/INDEXER_SPEC.md`) that reads only public data.

---

## What is built here

### Frontend (complete, production-grade)
Next.js 16 (App Router) + React 19 + Tailwind v4. Dark-mode-first, near-black, hairline-bordered,
mono-labeled "digital conservatory" per the design prompt.

Screens (PRD §10, design prompt §4):
- **Home** `/` - hero with ambient WebGL field, community-curated featured, genre rails, permanence explainer band, market stats.
- **Explore** `/explore` - art-forward grid, pill filter rail (genre/chain/storage/locked/price), sort, search.
- **Collections** `/collections`, `/collections/[slug]` - collection index + detail with sovereign/chain badges.
- **Token** `/token/[id]` - the signature screen: large artwork, buy/offer with pre-confirmation fee + royalty breakdown, **Permanence Status panel**, provenance timeline, traits, offers.
- **Mint** `/mint` - guided multi-step flow with the four shard cards (onchain proof locked-on), royalty, optional lock, review + mint.
- **Profile** `/profile` - Owned / Created / Activity tabs + sovereign-contract management.
- **Connect** `/connect` - focused, engineered, non-custodial wallet-connect access flow.
- **Permanence** `/permanence` - the thesis made visible: the storage-failure problem, the four-shard model, the verification service, the invariant, the published indexer spec, enforced royalties.

The **Permanence Status panel** (`src/components/token/PermanencePanel.tsx`) is the defining UI
moment (PRD §10.4, design prompt §5): one row per shard, live status glyphs, each row links to
the raw public source for independent verification, staggered verify-on-view animation, closing
on *"This artwork survives even if Perpetual disappears."*

### Domain model & data layer (complete)
- `src/lib/types.ts` - the full PRD domain (shards, permanence, provenance, royalty, listings/offers, sovereign contracts).
- `src/lib/mock-data.ts` - a deterministic, internally-consistent dataset that implements the
  `docs/INDEXER_SPEC.md` accessor shapes in-memory. Stands in for the indexer + orderbook +
  verification service so the app is fully functional offline. Swap for live API calls with no
  component changes.
- `src/components/art/GenerativeArt.tsx` - deterministic, SSR-safe SVG artwork (no external image
  assets); every token renders reproducible per-genre generative art.

### Trading & swaps (complete UX over the typed layer)

Beyond gasless fixed-price listings and offers, Perpetual restores barter (PRD §8, the
NFT-for-NFT trading OpenSea abandoned):

- **NFT-for-NFT swaps** - the maker offers token(s), the request is specific token(s), with an
  optional `ethTopUp` on either side to balance value. Modeled as `SwapOrder` with `offer` /
  `request` `SwapSide`s (`src/lib/types.ts`).
- **Criteria swaps** - the request is a `SwapCriteria` (collection, optionally a trait) rather
  than a specific id: "any token from this collection, optionally with this trait, for mine." The
  counterparty chooses which qualifying token fills it (`tokenMatchesCriteria`,
  `tokensMatchingCriteria`).
- **Lifecycle** - every proposal is `open`, `accepted`, `declined`, `expired`, or `countered`. A
  counter re-opens the terms; nothing moves until both sides have signed. Surfaced on a dedicated
  Swaps desk (`/swaps`), per token (`getSwapsForToken`), and on the profile Swaps tab
  (`getSwapsForUser`).

### Cross-chain settlement (escrow bridge)

A swap whose two sides span different chains (`offer.chain !== request.chain`, recorded as
`SwapOrder.crossChain`) settles atomically through an escrow bridge: **lock** the asset on chain A,
**release** the counter-asset on chain B, **rollback** on any failure. There is no intermediate
state where one side has parted with value and the other has not. A flat bridge fee
(`BRIDGE_FEE_ETH`) is surfaced at the point of trade, alongside the protocol fee and royalty,
before the user confirms (`src/components/chain/CrossChainRoute.tsx`).

### Identities, scoring, and verification-backed features

These all read from the same public verification path; none weakens an onchain guarantee.

- **ENS identities** - addresses resolve to ENS names across profiles, swaps, provenance, offers,
  and activity (`resolveEns` / `displayName`, the `Identity` component), with a short-address
  fallback. Resolution is presentational only; the address remains the source of truth for
  ownership and settlement.
- **Permanence Score** - a data-backed grade per token (`permanenceScore`, up to `A+`) from the
  verified onchain proof, content-hash match, redundant permanent copies, and lock state. Shown as
  a badge + detail card; a portfolio **Permanence Report** (`portfolioPermanence`) aggregates a
  wallet's holdings on the profile.
- **The Vanish Test** - an interactive proof on each token page that takes the operator layers
  (indexer, CDN, IPFS pin) offline in turn while shard 0 keeps resolving the artwork from Ethereum,
  reduced-motion safe (`src/components/token/VanishTest.tsx`).
- **Certificate of Permanence** - a downloadable, deterministic SVG certificate per token carrying
  the title, artist, token id, content hash, shard list, mint date, and grade
  (`src/components/token/CertificateOfPermanence.tsx`).

### On-chain layer (deployed to testnet - unaudited)

`contracts/` contains the Solidity interfaces and reference implementations for the full on-chain
surface. The core contracts are **deployed to Base Sepolia and Ethereum Sepolia** and verified
end-to-end on the live site (tryperpetual.art):

- **ForeverLibrary** — ERC-721 + ERC-2981 + URI sharding. The mandatory **STATE shard (Shard 0)**
  stores a low-res canonical image directly in contract bytecode via **SSTORE2**, written atomically
  at mint and immutable thereafter. Content hash is computed on-chain. A token cannot exist without
  its STATE shard, and `shard0Configured(tokenId)` gates listing eligibility (PRD §7.3, §9.6). The
  `ShardBackend` enum includes a `Log` variant for the LogLedger shard. `mintEdition(N, ...)` mints
  N ERC-721 copies that share one SSTORE2 STATE pointer, one LOG file, and one off-chain copy;
  each token carries `editionSize` / `editionIndex` fields and is individually owned and tradeable.
- **ForeverLibraryFactory** — deploys and enumerates sovereign ForeverLibrary instances.
  `createCollection(name, symbol, editWindow)` deploys a new `ForeverLibrary` owned by `msg.sender`
  in one transaction and emits `CollectionCreated(address collection, address owner, ...)` for indexer
  discovery. `collectionsCount()` / `collectionAt(i)` enumerate all deployed collections. Tokens are
  addressed as `[chainId]/[contract]/[tokenId]`; the canonical "Default (open) collection" is the
  ForeverLibrary deployed without the factory.
- **LogLedger** — a standalone contract that stores full-resolution media in Ethereum **event logs**
  (~8 gas/byte). Only a Merkle root + file size live in contract state. The LOG shard is
  cost-efficient and root-verifiable by anyone; availability is retention-monitored under EIP-4444
  (nodes may prune historical logs). Backstopped by the STATE shard. For editions, one LOG file is
  shared across all N tokens in the edition.
- **PerpetualSettlement** — Seaport-compatible settlement with **mandatory ERC-2981 royalty
  enforcement** (PRD §8.2) and NFT-for-NFT + criteria barter. Supports a hosting-fee model:
  artists pre-pay a flat storage fee (fee-exempt on resale), or Perpetual hosts and earns ≤1.5%
  per sale, enforced on-chain.

**Do not deploy with value before a security audit** (PRD §12). Still unaudited; no mainnet value.

---

## Current state and scope boundaries

- **Mint pipeline is live** on testnet. Real artist uploads go direct-to-Vercel-Blob (past the old
  ~4.5 MB serverless cap, up to ~100 MB). The server pins to IPFS/Arweave/Irys and a relayer
  publishes the full-res LOG shard to LogLedger (open → upload → seal). The client generates the
  on-chain STATE proof image (image downscale / video poster / SVG cover-card, ≤24 KB) and the mint
  transaction writes provenance + the SSTORE2 STATE shard. LOG + off-chain shard locators are
  recorded on-chain as shard descriptors. A resolver at `/api/shard/log/[ledger]/[fileId]`
  reconstructs + Merkle-verifies the LOG from chain logs (paginated getLogs, multi-RPC root
  agreement), caches to Blob, and serves via CDN. Clients verify the Merkle root from chain state
  — they never trust the backend.
- **Contracts deployed to Base Sepolia + Ethereum Sepolia.** Verified end-to-end on testnet.
  Still **unaudited**; **no mainnet value**.
- **Collections and sovereign contracts are live.** `ForeverLibraryFactory.createCollection` deploys artist-owned ForeverLibrary instances on testnet; the factory enumerates all collections via `CollectionCreated` events. Token addressing is `[chainId]/[contract]/[tokenId]`; per-collection pages at `/collections/onchain/[chainId]/[contract]`.
- **Editions are live.** `mintEdition(N, ...)` mints N ERC-721 tokens sharing one STATE/LOG/off-chain copy. Edition size capped at 10 in the UI (contract allows up to 100).
- **On-chain read layer is live.** Minted tokens have real pages at
  `/token/onchain/[chainId]/[contract]/[tokenId]` (real shards, LOG resolver, provenance, permanence
  panel). A connected wallet's owned works are listed on the profile (`/api/onchain/owned`).
- **Lite indexer is live.** `/explore` and `/collections` surface real on-chain tokens
  (scanned from `TokenMinted` events across all factory-discovered collections, cached) merged with the mock demo gallery. Live tiles
  are tagged "on-chain". Catalog text-search still covers the mock index only — a known
  lite-indexer limitation; a DB-backed indexer is the remaining stage.
- **Fixed-price trading is live.** EIP-712 signed ETH listings stored in a Blob orderbook;
  on-chain fulfillment via `PerpetualSettlement` (royalties + hosting fee enforced). Offers,
  auctions, NFT-for-NFT barter, and cross-chain swaps remain design targets.
- **Wallet is mocked** (`src/lib/wallet.ts`). Swap for wagmi/viem; the UI contract is in place.
- **Community curation** (PRD §11) is surfaced as the featured surface; full Sybil-resistant voting is
  a Phase 2 fast-follow.

These boundaries reflect the PRD's intended phasing (PRD §15): the **core minting + storage
pipeline**, **on-chain read layer**, **lite indexer**, and **fixed-price trading** are all live
on testnet. A full DB-backed indexer, real wallet integration (wagmi/viem), security audit, and
mainnet deployment are the remaining stages.

---

## Run it

```bash
cd perpetual        # the app directory
npm install
npm run dev          # http://localhost:3000
npm run build        # production build (56 static/SSG routes)
```

> all UI, metadata, and copy are branded **Perpetual** throughout.
