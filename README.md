# Perpetual

**Art, engineered to outlast everything.**

A permanence-first NFT marketplace, comparable to leading marketplaces in speed and UX, built on
one non-negotiable guarantee: **the artwork is permanent and provable, independent of the
marketplace operator.** Every artwork maintains parallel immutable copies across onchain storage
(ethfs), IPFS, Arweave, and Irys, backstopped by an onchain proof shard that survives as long as
Ethereum itself.

> Every other marketplace's NFTs break when storage fails. Ours can't.

This repository is a complete, production-grade **frontend** implementing the entire product
design, backed by a **typed data layer that faithfully models the PRD domain**, plus **published
architecture artifacts** (smart-contract interfaces and the indexer specification).

---

## Quick start

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # optimized production build
npm start        # serve the production build
```

Stack: **Next.js 16** (App Router) · **React 19** · **Tailwind v4** · **TypeScript**. Fonts: Inter +
JetBrains Mono. No external image assets - all artwork is deterministic, SSR-safe generative SVG.

---

## What's inside

| Path | What |
|---|---|
| `src/app/**` | All screens: Home, Explore, Collections, Token, Mint, Profile, Connect, Permanence |
| `src/components/**` | UI primitives, generative art, the Permanence Status panel, wallet, ambient WebGL field |
| `src/lib/types.ts` | The full PRD domain model |
| `src/lib/mock-data.ts` | Deterministic data layer implementing the indexer/orderbook accessor shapes |
| `contracts/**` | Forever Library + settlement contract interfaces & reference scaffold (unaudited) |
| `docs/ARCHITECTURE.md` | Four-layer architecture + PRD traceability |
| `docs/INDEXER_SPEC.md` | The **published** indexer schema (rebuildable from public data) |

See [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) for the full mapping to the PRD and the
deliberate scope boundaries.

---

## The signature feature

Every token page carries a **Permanence Status panel** - one row per storage shard with live,
independently verifiable status, each row linking to the raw public source. It closes on the
product's whole thesis:

> *This artwork survives even if Perpetual disappears.*

---

## Design system

Near-black canvas (`#050505`), hairline borders (`#27272A`), JetBrains Mono for every verifiable
value (hashes, addresses, ids, prices), and a single surgical parchment-gold accent (`#E8D8A0`)
reserved for permanence-verified states and the one primary action per view. Dark-mode-first,
WCAG-AA contrast, full keyboard nav, `prefers-reduced-motion` honored. See the design source of
truth at `../vellum_frontend_design_prompt.md` and the product spec at `../PRD_vellum.md`.

---

*Brand: **Perpetual**. The on-disk folder name (`vellum`) is retained for path stability; all
product surfaces are branded Perpetual.*
