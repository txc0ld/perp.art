# Perpetual - Architecture & PRD Traceability

A permanence-first NFT marketplace. **Core promise:** *Every other marketplace's NFTs break
when storage fails. Ours can't.* (PRD §1)

This document maps the four-layer architecture (PRD §6) to what is implemented in this
repository, and records which parts are real code vs. reference scaffold.

---

## The four layers (PRD §6)

| Layer | Function | Decentralization | In this repo |
|---|---|---|---|
| **Asset & Provenance** | Artwork, metadata, ownership, provenance, URI sharding | Fully permanent (Forever Library) | `contracts/` interfaces + reference impl (scaffold) |
| **Settlement** | Trades, royalty enforcement | On-chain (Ethereum + Base) | `contracts/PerpetualSettlement.sol` (scaffold) |
| **Orderbook & Indexer** | Listings, offers, discovery, search, permanence verification | Centralized, **rebuildable from public data** | `docs/INDEXER_SPEC.md` + `src/lib/mock-data.ts` (typed in-memory implementation) |
| **Frontend** | Web app | Centralized hosting | `src/app/**`, `src/components/**` (production Next.js app) |

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

### On-chain layer (reference scaffold - unaudited)
`contracts/` contains well-documented Solidity interfaces and reference-implementation sketches for
the Forever Library token (ERC-721 + ERC-2981 + URI sharding) and the Seaport-compatible settlement
contract with **mandatory ERC-2981 royalty enforcement** (PRD §8.2) and **mandatory onchain proof**
(PRD §7.3). These are not deployed; they express the on-chain contract surface the frontend and
indexer depend on. **Do not deploy with value before a security audit** (PRD §12).

---

## Deliberate scope boundaries (PRD §3.2 non-goals, and this build)

- **Not deployed to a live chain.** Real deployment needs keys, gas, and an audit - out of scope for
  an autonomous build. The contract surface is specified and scaffolded.
- **Wallet is mocked** (`src/lib/wallet.ts`, a tiny external store). Swap for wagmi/viem to wire real
  wallets; the UI contract is already in place.
- **Orderbook/indexer are represented** by the typed in-memory layer + the published spec rather than
  a running backend service.
- **Community curation** (PRD §11) is surfaced as the featured surface; full Sybil-resistant voting is
  a Phase 2 fast-follow.

These boundaries are exactly the PRD's intended phasing (PRD §15): the **core trading + permanence
loop and its UX** is what this build proves end-to-end.

---

## Run it

```bash
cd perpetual        # the app directory
npm install
npm run dev          # http://localhost:3000
npm run build        # production build (56 static/SSG routes)
```

> all UI, metadata, and copy are branded **Perpetual** throughout.
