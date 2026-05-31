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
closes that gap: every work keeps parallel, immutable copies across **onchain (ethfs), IPFS,
Arweave, and Irys**, backstopped by a mandatory onchain proof shard that lasts as long as
Ethereum itself.

> The operator can vanish entirely and every token remains owned, resolving to its artwork,
> with full provenance. Anyone can re-index the public contracts and storage networks and
> rebuild the marketplace. That invariant is the product.

This repository is a complete, production-grade **frontend** implementing the full product,
backed by a typed data layer that faithfully models the domain, plus published architecture
artifacts (smart-contract interfaces and the indexer specification).

---

## Features

**Marketplace (OpenSea-style IA, in a near-black + parchment-pink theme)**
- Home with a featured hero, category rails, and a live **trending-collections rankings table**
- Explore with a collapsing filter rail, sort, density toggle, and full-text + trait search
- Collections index and rich collection pages (banner, avatar, stats bar, Items / Activity)
- A dedicated **Rankings** page with time-window, chain, and category filters
- Token item pages with a sticky buy box, accordion detail sections, and offers / activity
- Profile with Collected / Created / Activity / Sovereign-contract management
- A guided **mint** flow with shard configuration, royalty, and optional locking

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
| Data | Deterministic in-memory layer (`src/lib/mock-data.ts`) implementing the indexer spec |
| Contracts | Forever Library (ERC-721 + ERC-2981 + URI sharding), Seaport-compatible settlement with NFT-for-NFT + criteria barter, and a cross-chain escrow bridge (reference scaffold) |
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

A complete frontend and domain model proving the core trading + permanence loop end to end.
Contracts are a reference scaffold and are **not** audited or deployed; the wallet, orderbook,
and indexer are represented by the typed in-memory layer and the published spec. Wiring real
wallets (wagmi/viem) and a live indexer requires no component changes, since the interfaces
are already in place.

---

<div align="center">
<sub>Built with care. The art cannot die.</sub>
</div>
