# Log Ledger — Plan 3: Resolver, Render Integration & Retention

> Builds on Plan 1 (contracts), 2a (shared module), 2b (pipeline, live). Executed inline/subagent with TDD + on-chain verification.

**Goal:** Serve the high-res LOG copy from chain logs (reconstruct → verify → cache → serve), expose a `resolveShardUrl` so the app renders `log://` shards, and add a retention-availability check.

## Key decisions
- **Route:** `GET /api/shard/log/[ledger]/[fileId]` (nodejs runtime). Reconstructs via the shared `reconstructFile`, **verifies the Merkle root before serving**, caches the verified bytes in Vercel Blob (immutable once sealed), and **302-redirects to the public Blob URL** (CDN-served; avoids streaming large bytes through the function). Commitment headers (`X-Content-Root`, `X-Codec`, `X-Size`) on the redirect; authoritative root always comes from chain, never the backend.
- **Chain selection:** the `log://<ledger>/<fileId>` URI has no chain. Map `ledger` → chainId via the deployed-address registry (`getContracts`), since each chain has a distinct LogLedger address. `?chainId=` query overrides.
- **MIME:** LogLedger stores `codec`, not MIME. Resolver sniffs magic bytes (PNG/JPEG/WEBP/GIF/MP4/SVG) for `Content-Type`; `?mime=` query (frontend has it from metadata) overrides; fallback `application/octet-stream`.
- **Multi-RPC:** read the on-chain `root` from each available provider (configured RPC + viem chain default) and require agreement; reconstruct from the first provider with complete, root-verifying logs. Missing/disagree → `unavailable` (502 + a header), frontend falls back to the STATE shard. (Dedup duplicate FileChunk events by index, keep-last — reconstruct precondition.)
- **Retention:** a `checkLogAvailability(ledger, fileId)` helper + `GET /api/cron/log-retention` (Vercel cron in `vercel.json`). Honest limitation: enumerating all minted Log shards needs the indexer (not built); v1 accepts a `?fileIds=` list / known set and records availability, logging what it can't enumerate.

## File structure
- `src/lib/logledger/resolve-url.ts` — `resolveShardUrl(uri, opts?)`: `log://`→`/api/shard/log/…`, `ipfs://`→gateway, `ar://`/`irys://`→gateways. Pure. (+ test)
- `src/lib/logledger/resolve.ts` — server: `chainIdForLedger`, `sniffMime`, `loadAndVerifyLogShard`, `checkLogAvailability`. (+ tests for pure `chainIdForLedger`/`sniffMime`; on-chain integration test for load)
- `src/app/api/shard/log/[ledger]/[fileId]/route.ts` — the resolver (Blob cache + redirect).
- `src/app/api/cron/log-retention/route.ts` — retention cron.
- `vercel.json` — cron schedule.
- `src/components/mint/MediaPreview.tsx` — accept already-resolved URLs (no change to API) and `src/components/mint/MintSuccess.tsx` — show the high-res LOG via `resolveShardUrl`.

## Tasks
1. `resolveShardUrl` util + tests (pure).
2. `resolve.ts`: `chainIdForLedger` + `sniffMime` (pure, tested) + `loadAndVerifyLogShard` (multi-RPC reconstruct, reuses shared module) + `checkLogAvailability`.
3. Resolver route with Blob cache + 302 redirect + commitment headers + STATE-fallback signal.
4. On-chain integration test (gated RUN_LOGLEDGER_E2E): resolve the fixture sealed in Plan 2b, assert bytes + root + content-type.
5. Wire `resolveShardUrl` into MintSuccess so the minted token's LOG renders (and offchain ipfs/ar/irys links resolve through gateways).
6. Retention helper + cron route + `vercel.json`.
7. Verify: vitest + tsc + build; curl the deployed resolver against a real sealed fileId; deploy.

## Verification gates
- vitest green (resolve-url, chainIdForLedger, sniffMime); on-chain test resolves the real sealed fixture.
- `tsc` + `next build` clean.
- `curl` the live resolver for a sealed `(ledger,fileId)` → 302 → bytes match the original; `X-Content-Root` == on-chain root.
