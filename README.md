<div align="center">

# tryperpetual.art

### Art, engineered to outlast everything.

A permanence-first NFT marketplace with OpenSea-grade trading UX, built on a single
guarantee: **the artwork is provably permanent and survives even if the operator disappears.**

[**Live demo**](https://tryperpetual.art) · [Features](./docs/FEATURES.md) · [Architecture](./docs/ARCHITECTURE.md) · [Indexer spec](./docs/INDEXER_SPEC.md) · [Contracts](./contracts/README.md) · [Go-live checklist](./docs/GO-LIVE.md)

`Next.js 16` · `React 19` · `Tailwind v4` · `TypeScript`

</div>

---

## The thesis

Every other marketplace's NFTs break when storage fails. IPFS pins lapse, metadata servers
go offline, hosting companies fold, and the token is left pointing at nothing. tryperpetual.art
closes that gap: every work keeps five parallel, independently-verifiable copies — a mandatory
**STATE shard** (low-res image stored on-chain via SSTORE2 in ForeverLibrary, consensus-guaranteed),
a **LOG shard** (full-res media in event logs via LogLedger, Merkle-verifiable, cost-efficient),
plus **IPFS, Arweave, and Irys** — backstopped by the STATE shard that lasts as long as Ethereum itself.

> The operator can vanish entirely and every token remains owned, resolving to its artwork,
> with full provenance. Anyone can re-index the public contracts and storage networks and
> rebuild the marketplace. That invariant is the product.

The contracts (ForeverLibrary with SSTORE2 + LogLedger + PerpetualSettlement + ForeverLibraryFactory)
are **deployed to Base Sepolia and Ethereum Sepolia**. The mint pipeline — real uploads, real on-chain
storage, relayer, and resolver — is **live on tryperpetual.art**. Collections are sovereign contracts:
`ForeverLibraryFactory.createCollection(name, symbol)` deploys an artist-owned `ForeverLibrary` in one
transaction and emits an event for discovery. Editions (`mintEdition`) mint N ERC-721 copies of one
artwork that share a single on-chain STATE proof, one LOG shard, and one IPFS/Arweave/Irys copy;
each token is individually owned and tradeable. Minted tokens have real live pages at
`/token/onchain/[chainId]/[contract]/[tokenId]`; per-collection pages at
`/collections/onchain/[chainId]/[contract]`; a connected wallet's owned works are listed on the
profile; explore and collections surface real on-chain tokens (all factory collections) merged with
the demo gallery; and fixed-price ETH trading (EIP-712 signed listings, on-chain fulfillment via
PerpetualSettlement) is live. The system is verified end-to-end on testnet; it is **unaudited** and
**not yet on mainnet**. This repository also contains the full production-grade frontend, published
architecture artifacts, and the indexer specification.

---

## Features

**Marketplace (OpenSea-style IA, in a near-black + parchment-pink theme)**
- Home with a featured hero, category rails, and a live **trending-collections rankings table**
- Explore with a collapsing filter rail, sort, density toggle, and full-text + trait search
- Collections index and rich collection pages (banner, avatar, stats bar, Items / Activity)
- A dedicated **Rankings** page with time-window, chain, and category filters
- Token item pages with a sticky buy box, accordion detail sections, and offers / activity
- Profile with Collected / Created / Activity / Sovereign-contract management
- A guided **mint** flow with collection picker (Default / your sovereign contract / create new via ForeverLibraryFactory), mint-type selector (1-of-1 or edition of N, editions share one STATE/LOG/off-chain copy), shard configuration, royalty, and optional locking (live on testnet — real uploads, real on-chain SSTORE2 + LogLedger storage)

**One-stop, multi-chain**
- **Nine networks** indexed and traded as one marketplace: **Ethereum, Base, Polygon, Arbitrum,
  Optimism, Zora** (EVM, permanence-native: Forever Library deploys here) plus **Solana, Tezos,
  Flow** (indexed and traded with native storage). Discovery (explore, rankings, stats) filters
  across every chain; prices render in each chain's native currency (`ETH` / `POL` / `SOL` /
  `XTZ` / `FLOW`).

**Differentiators (what OpenSea does not do)**
- **NFT-for-NFT swaps**: propose a barter trade of your token(s), optionally with ETH on either
  side to balance value, with an atomic settlement breakdown. Browse open swaps, manage incoming
  and outgoing offers (accept / decline / counter) on a dedicated **Swaps desk** (`/swaps`), with
  per-token swap interest and a profile Swaps tab.
- **Criteria swaps**: offer against a collection or trait rather than a specific token ("any token
  from this collection, optionally with this trait, for mine"); the counterparty picks which
  qualifying token fills it.
- **Cross-chain trades**: when the two sides span different chains, the swap settles atomically
  across an escrow bridge (lock on chain A, release on chain B, rollback on failure), with a flat
  bridge fee shown at the point of trade.
- A **Permanence Status panel** on every token: per-shard live verification, each row linking to
  its raw public source, closing on *"This artwork survives even if tryperpetual.art disappears."*
- A **Permanence Score**: a data-backed A+ grade per token (badge + detail card), plus a portfolio
  **Permanence Report** on the profile.
- **The Vanish Test**: an interactive proof on each token page that takes the operator layers
  (indexer / CDN / IPFS) offline while the onchain proof keeps resolving the art.
- A downloadable **Certificate of Permanence**: an archival SVG certificate per token.
- **ENS identities**: addresses resolve to ENS names across profiles, swaps, provenance, offers,
  and activity, with a short-address fallback.

**Feel**
- Tasteful CSS-3D throughout: pointer-tilt artwork cards with specular sheen, a 3D **coverflow** of
  featured drops, a signature 3D **shard stack** that makes layered permanence tangible,
  scroll-driven depth reveals, and a floating brand medallion. All reduced-motion aware; the art is
  always the brightest element.

**Engineering**
- Deterministic, SSR-safe **generative SVG artwork** (no external image assets)
- A raw-WebGL ambient field (reduced-motion aware, pauses offscreen, graceful fallback)
- Working interactions throughout: buy, make offer, edit profile, deploy sovereign contract,
  copy / share, filters, sorting, and wallet connect (mocked, ready to wire to wagmi/viem)
- WCAG AA pass: skip link, focus-visible rings, semantic tables / tabs / dialogs, keyboard nav
- Fully responsive, mobile-optimized to 360px with comfortable tap targets

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, RSC) |
| UI | React 19, Tailwind CSS v4 |
| Language | TypeScript (strict) |
| Type faces | Inter, JetBrains Mono, Plus Jakarta Sans |
| Data | Mint, on-chain read layer, lite indexer (all factory collections enumerated), and fixed-price trading are live on testnet; mock gallery (`src/lib/mock-data.ts`) coexists as demo content |
| Contracts | ForeverLibrary (ERC-721 + ERC-2981 + SSTORE2 STATE shard + Log enum + `mintEdition`), ForeverLibraryFactory (`createCollection` → sovereign FL per artist), LogLedger (event-log high-res shard), PerpetualSettlement (Seaport-compatible, NFT-for-NFT + criteria barter + royalty enforcement) — deployed to Base Sepolia + Ethereum Sepolia, unaudited |
| Networks | 9 chains: Ethereum, Base, Polygon, Arbitrum, Optimism, Zora (EVM) + Solana, Tezos, Flow |

No external image assets, no UI dependencies beyond the framework. All artwork is generated.

---

## Getting started

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # optimized production build (57 routes)
npm start        # serve the production build
npm run lint     # eslint
```

---

## Project structure

```
src/
  app/                 Routes: home, explore, collections, stats, token, mint, profile, connect, permanence
  components/
    ui/                Primitives: Button, Surface, Badge, MonoLabel, StatusGlyph, Section, SectionHeader
    chrome/            Header, footer, brand mark + wordmark, search
    art/               Deterministic generative artwork + the marketplace tile
    token/ mint/ ...   Feature components per surface
    visual/            WebGL ambient field
  lib/
    types.ts           The full domain model
    mock-data.ts       Indexer / orderbook / verification stand-in (swap for live APIs)
    wallet.ts          Mock wallet session (swap for wagmi/viem)
contracts/             Forever Library + settlement interfaces and reference implementations
docs/                  ARCHITECTURE.md, INDEXER_SPEC.md
```

---

## Architecture

Four layers; only the bottom two are onchain and must be permanent. The top two are
centralized for performance, and their failure harms nothing permanent.

| Layer | Responsibility | Posture |
|---|---|---|
| Asset & provenance | Artwork, metadata, ownership, URI sharding | Permanent (Forever Library, the 6 EVM chains) |
| Settlement | Trades, royalty enforcement, barter, cross-chain escrow | Onchain (EVM chains) + escrow bridge for cross-chain swaps |
| Orderbook & indexer | Listings, offers, swaps, search, permanence verification, across 9 chains | Centralized, rebuildable from public data |
| Frontend | This app | Centralized hosting |

Full detail and PRD traceability in [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md). The indexer
reads only public data and its schema is published in [`docs/INDEXER_SPEC.md`](./docs/INDEXER_SPEC.md)
so any third party can reconstruct it.

---

## Design system

A near-black digital conservatory: precise, calm, materially serious. The art is always the
brightest element; the interface is the quiet frame.

- **Canvas** `#050505` · **surface** `#18181B` · **hairline** `#27272A`
- **Accent** parchment pink `#fe93ed`, used surgically (primary actions, active states, verified marks)
- **Mono everywhere it matters**: hashes, addresses, ids, prices, and timestamps render in
  JetBrains Mono. This is the brand's machine-truth fingerprint.
- Dark-mode-first, AA contrast, reduced-motion honored, 8px spacing rhythm.

The full design context lives in [`.impeccable.md`](./.impeccable.md).

---

## Configuration

The app runs fully on the deterministic in-memory data layer, so **no configuration is required
for local development**. To wire live infrastructure, every variable you need is documented in
[`.env.example`](./.env.example): per-chain RPCs (all 9 networks), WalletConnect, deployed
contracts, the cross-chain bridge, the indexer + database, the four storage providers, the
verification service, and ENS. Copy it to `.env.local` (gitignored) and fill in real values.

```bash
cp .env.example .env.local
```

---

## Deployment

Deploys to Vercel with zero configuration (framework auto-detected; `vercel.json` pins Next.js).
The repository root is the application root.

```bash
vercel --prod
```

Live: **https://tryperpetual.art**

---

## Status

**Collections and sovereign contracts are live** on testnet. `ForeverLibraryFactory.createCollection(name, symbol)` deploys a new artist-owned `ForeverLibrary` contract in one transaction and emits a `CollectionCreated` event; the factory enumerates every collection. The canonical contract is the "Default (open) collection." Deploying a collection from the Profile page is a real on-chain deploy.

**Editions are live.** `mintEdition` mints N ERC-721 tokens of one artwork that share one on-chain SSTORE2 STATE proof, one LogLedger LOG copy, and one IPFS/Arweave/Irys copy (storage written once); each token is tagged `edition X / N` and is individually owned and tradeable. The mint wizard UI caps edition size at 10 (the contract allows up to 100).

**Minting and storage are live** on testnet (Base Sepolia + Ethereum Sepolia). ForeverLibrary
(SSTORE2 STATE shard + Log enum + `mintEdition`), ForeverLibraryFactory, LogLedger, and PerpetualSettlement are deployed and
verified end-to-end: real artist uploads (direct-to-Vercel-Blob, up to ~100 MB), IPFS/Arweave/Irys
pinning, relayer-published LOG shard, on-chain SSTORE2 STATE shard written at mint, and a
Merkle-verifying LOG resolver at `/api/shard/log/[ledger]/[fileId]`.

**On-chain read layer is live.** Minted tokens have real live pages at
`/token/onchain/[chainId]/[contract]/[tokenId]` (live shards, high-res LOG rendered via the resolver,
provenance, permanence panel); per-collection pages at `/collections/onchain/[chainId]/[contract]`. A connected wallet's owned works are listed on the profile
(`/api/onchain/owned`).

**Lite indexer is live.** `/explore` and `/collections` surface real on-chain tokens (scanned
from `TokenMinted` events across all factory collections, cached) merged with the mock demo gallery; live tiles are tagged
"on-chain". Text-search still covers the mock index only — a known lite-indexer limitation.

**Fixed-price trading is live.** ETH listings are signed via EIP-712 and stored in a Blob
orderbook; fulfillment routes through the deployed `PerpetualSettlement` with royalties and
the hosting fee enforced on-chain. List/Buy UI lives on the live token page (`/api/orders`).
Offers, auctions, NFT-for-NFT barter, and cross-chain swaps remain design targets.

The system is **unaudited** and **not on mainnet**. Wiring real wallets (wagmi/viem) and a
full production indexer (DB-backed) requires no component changes, since the interfaces are
already in place.

---

<div align="center">
<sub>Built with care. The art cannot die.</sub>
</div>
