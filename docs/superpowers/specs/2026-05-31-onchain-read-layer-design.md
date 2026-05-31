# On-Chain Read Layer (Lite Indexer) — Design Spec

**Date:** 2026-05-31
**Goal:** Make minted tokens real and viewable — read on-chain so a freshly minted piece has a live token page (real shards + the high-res LOG rendering via the resolver) and a wallet's owned works are listed — with **no new backend infrastructure** (RPC reads only).

Builds on the live Log Ledger pipeline. This is the bridge between "live minting" and "live product."

## Approved decisions
1. **Addressing:** a dedicated route `/token/onchain/[chainId]/[tokenId]` reading the canonical ForeverLibrary for that chain. The mock catalog keeps its string slugs (`/token/[id]`); no collision. Sovereign per-artist contracts are a later extension.
2. **Profile scope:** **owned (incl. purchased)** — reconstruct current holdings by scanning `Transfer(to=owner)` events and filtering by current `ownerOf`.
3. **Fetch:** **server-side (RSC)** via a server viem client on the server RPC (the one the resolver already uses). Proper SSR + OG; the LOG resolver is already server-side.

## Components

### `src/lib/web3/read-token.ts` (server-only)
- `readOnchainToken(chainId, tokenId): Promise<Token | null>` — reads `getMintData`, `ownerOf` (null if it reverts → not minted), `shardCount` + per-index `shardBackend`/`shardURI`/`shardContentHash`, `hostingFeeBps`, `royaltyInfo`, `isLocked`, `selectedShardIndex`. Maps into the existing `Token` + `PermanenceStatus` shape so current components render unchanged. Each shard becomes a `StorageShard`; its display/source URL runs through `resolveShardUrl` (STATE → on-chain data URI from `shardURI(id,0)`; LOG → `/api/shard/log/...?contentHash=`; IPFS/Arweave/Irys → gateways). `guaranteed` true only for the STATE shard.
- `readOnchainProvenance(chainId, tokenId)` — the mint event + `Transfer` events for the token → a real provenance timeline (created/minted/transfer).
- `readOwnedTokenIds(chainId, owner): Promise<bigint[]>` — paginated `getLogs` of `Transfer` with `to == owner` (bounded windows + a cap, like the resolver), dedupe tokenIds, then filter by current `ownerOf(tokenId) == owner`. Captures mints + purchases, drops sold-away.

### Routes
- `src/app/token/onchain/[chainId]/[tokenId]/page.tsx` — RSC: `readOnchainToken` → render the existing token-detail layout (reuse the components used by `/token/[id]`); `notFound()` if null; real `generateMetadata` (title/artist/STATE-proof image). `dynamic = "force-dynamic"`.
- `src/app/api/onchain/owned/route.ts` — `GET ?chainId=&owner=` → `readOwnedTokenIds` + light per-token metadata (title, STATE preview URI) for the profile grid. `runtime=nodejs`.

### Profile integration
- `OwnedTab` gains a "Your on-chain works" section that fetches `/api/onchain/owned` for the connected wallet and renders cards linking to `/token/onchain/[chainId]/[tokenId]`. Mock owned items remain as the demo gallery, clearly separate.

### Mint success
- `MintSuccess` "view token" link → `/token/onchain/${chainId}/${tokenId}`.

## Data mapping notes
On-chain gives: creator, title, artistName, mediaType, royaltyBps, metadataHash, mint timestamp/block, shards (backend/uri/contentHash), hostingFee, owner, locked, selectedShardIndex. The `Token` shape's trading/collection/trait fields that have **no on-chain source** are omitted or neutral on the live page (no fake data):
- **price/listing/offers:** none (no live trading yet — next stage). The live page shows "not listed."
- **collection/traits/description:** live in the off-chain metadata JSON whose CID isn't recorded on-chain → omitted this pass (can be added later by recording the metadata CID at mint or fetching from a known shard).
- **provenance:** real, from mint + `Transfer` events.
- **permanence:** fully real, from on-chain shard data — the signature surface is genuine.

## Error handling
- `ownerOf` reverts / unminted id / unsupported chain → `notFound()` (page) or `404`/empty (API).
- RPC failure on a shard read → degrade that shard's status rather than failing the page.
- `getLogs` respects the public-RPC block-range cap (paginate, bounded windows + cap), mirroring the resolver.

## Testing
- Unit: the on-chain→`Token`/`PermanenceStatus` mapping with a mocked reader (shard mapping, `guaranteed` flag, `resolveShardUrl` results, null on unminted); chain/contract resolution.
- On-chain (gated `RUN_LOGLEDGER_E2E`): `readOnchainToken` against a real minted Base Sepolia token → correct owner/shards/provenance; `readOwnedTokenIds(minter)` includes that token.

## Out of scope (later phases)
Full indexer (explore/collections/search/rankings live from chain), live trading (PerpetualSettlement wiring), sovereign per-artist contract addressing, recording the metadata CID on-chain for traits.
