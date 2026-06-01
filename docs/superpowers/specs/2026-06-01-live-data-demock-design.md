# Site-wide De-Mock — Live/Testnet Data Everywhere

**Date:** 2026-06-01
**Goal:** Remove the fabricated demo catalog site-wide. Every surface renders only real
live/testnet data (on-chain indexer + real ENS), with honest empty states where there is
no data yet. Genuine logic/metadata is kept, not deleted.

## Decisions (locked with user)
1. **Sparsity:** Accept sparse + design polished empty states. No fake content to fill pages.
2. **Identity:** Real ENS resolved on **Ethereum mainnet** (ENS only lives there); fall back to
   shortened address. The profile reflects the **connected wallet**.
3. **Joined date:** Derived from the address's **first on-chain activity** on Perpetual
   contracts (first mint / first tx); the line is **omitted** when there's no history.
4. **Swaps:** Keep the page + nav but show an honest **"coming soon" / no live swaps** state
   (no fabricated swap data) until a real swap backend exists.

## Keep vs. remove (in `src/lib/mock-data.ts`)
**Remove (fabricated data):** `ARTIST_SEED`/`ARTISTS`, `getAllTokens`, `getToken`,
`getTokensByCollection|Artist|Genre|Owner`, `getCollections`, `getCollection`, `getArtists`,
`getArtist`, `getListedTokens`, `getFeatured(Tokens)`, `searchTokens`, `CURRENT_USER`,
`getMarketStats`, `getTrendingCollections`, `getTopMovers`, `getCriteriaSwaps`, `getOpenSwaps`,
`getSwapsForToken|User`, `getSwap`, `getSwappableTokens`, `resolveEns`, `displayName`.

**Keep (real logic/metadata) — extract into clean, non-"mock" modules:**
- `permanenceScore`, `PermanenceScore`, `portfolioPermanence` → `src/lib/permanence.ts`
- `ChainMeta`, `CHAINS`, `CHAIN_ORDER`, `getChainMeta`, `getChains`, `BRIDGE_FEE_ETH` → `src/lib/chains.ts`
- `GENRES`, `SHARD_OPTIONS` → `src/lib/catalog-constants.ts`
- `RankWindow`, `CollectionRanking`, `tokenMatchesCriteria`, `tokensMatchingCriteria`,
  `SwapCriteria` → `src/lib/swap-criteria.ts` (logic retained for when swaps go live)

After extraction, `mock-data.ts` is deleted.

## Architecture

### Foundation (built first, before any surface is rewired)
- **`src/lib/ens.ts`** — real ENS via a mainnet viem `PublicClient` (RPC from
  `NEXT_PUBLIC_RPC_ETHEREUM`, fallback public). `resolveEnsName(address): Promise<string|null>`,
  `displayName(address, ens?)`. Short-TTL in-memory cache; isomorphic (server + client).
- **`src/lib/live/catalog.ts`** — server-only live data layer wrapping the indexer
  (`indexAllTokens`, `indexedCollections`) across supported chains. Returns ONLY live data;
  empty arrays / zeroed stats when none:
  - `getLiveTokens()`, `getLiveToken(id)`, `getLiveTokensByOwner(addr)`,
    `getLiveTokensByCreator(addr)`, `getLiveCollections()`, `getLiveCollection(contract)`,
    `getLiveMarketStats()` (from settlement events; zeros if none),
    `getFirstActivityDate(addr)` (joined date), `searchLiveTokens(q)`.
- **`src/components/ui/EmptyState.tsx`** — reusable, on-brand empty state (icon/eyebrow/title/
  body/optional CTA) for the sparse surfaces.
- The indexer's `mergeForExplore(live, mock)` loses its `mock` arg (live-only).

### Surfaces (rewired in waves; each keeps the build green)
- **Home** (`app/page.tsx`, `components/home/*`): featured/trending/top-movers from live; if
  empty, a focused hero + "be the first to mint" empty state instead of tables of fake rows.
- **Explore** (`app/explore/page.tsx`, `components/explore/*`): live tokens + working filters;
  EmptyState when none. Search uses `searchLiveTokens`.
- **Collections** (`app/collections/*`): live collections (incl. sovereign); EmptyState when none.
- **Stats** (`app/stats/page.tsx`, `components/stats/*`): live market stats / rankings; zeros +
  EmptyState honestly when there's no volume.
- **Swaps** (`app/swaps/page.tsx`, `components/swap/*`, `components/profile/ProfileSwaps.tsx`):
  "coming soon" state; keep swap-criteria logic for later.
- **Token** (`app/token/[id]` mock route retired or redirected; `token/onchain/*` already live):
  ENS via real resolver; `CertificateOfPermanence`, identity, permanence cards use kept logic +
  real ENS.
- **Profile** (`app/profile/page.tsx`, `components/profile/*`): keyed to the **connected wallet**;
  real owned (indexer), real created (indexer by creator), real collections, real ENS, joined =
  first activity; stats computed from live holdings. Server profile overrides (name/bio/avatar/
  banner) from `/api/profile`.

## Error handling
- All live reads already fail soft (indexer returns `[]`). ENS resolution failures fall back to
  the short address. No surface throws on empty/unavailable data — it renders an empty state.

## Testing
- `tsc` + `npm run build` green after each wave.
- Unit: `ens.ts` fallback (no RPC → short address), `live/catalog.ts` empty-data shapes,
  `EmptyState` render. Existing indexer/read-token tests stay green.
- Manual: every page returns 200 and shows live data or a correct empty state on testnet.

## Out of scope (noted, not built here)
- Seeding real testnet content to populate the sparse site (user chose "accept sparse"; seeding
  is a later follow-up, pairs with the bulk-PFP-mint feature still pending design approval).
- A real swaps backend.
- SIWE auth on `/api/profile` writes (flagged in that route; needed before mainnet).
