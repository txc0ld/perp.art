# Log Ledger — Plan 2b: Pipeline, Relayer & Mint Wiring

> Executed subagent-driven/inline with TDD. Builds on Plan 1 (contracts deployed) + Plan 2a (`src/lib/logledger/` shared module).

**Goal:** Wire the LOG + SSTORE2-STATE pipeline end-to-end: client generates the on-chain STATE proof, the server relayer publishes the high-res copy to `LogLedger`, and `useOnchainMint` mints with `bytes proofData` + records the `Log` shard.

## Key decisions (locked)
- **STATE proof = an image.** Client generates ≤24 KB bytes: raster images → canvas downscale to WEBP; video → poster frame → WEBP; HTML/audio/unknown → a generated SVG cover-card (title + artist + content-hash). Always an image MIME.
- **`mint` mediaType arg = the PROOF's mime** (e.g. `image/webp` / `image/svg+xml`), because the deployed contract builds Shard 0's `data:` URI from `mintData.mediaType`. The artwork's true media type is preserved in the off-chain metadata (IPFS JSON) + the LOG shard, not in the on-chain provenance string. Documented tradeoff.
- **fileId = `keccak256(abi.encode(collection, contentHash, uint32 version=0))`**, collection = the ForeverLibrary address for the chain. Content-bound (not tokenId-bound) so the relayer can publish independent of mint ordering.
- **hostingFeeBps defaults to 0** (artist-pays, fee-exempt; `storageFeeWei` is 0 → `mint` value 0). The hosting-choice UI is a later plan.
- **Relayer publishes inside `/api/store`** reusing the already-loaded bytes; sends `open` → `upload`×N → `seal` sequentially (await each receipt) then returns the sealed commitment. Skipped (`ok:false`) if `LOGLEDGER_RELAYER_PK` / ledger address absent.
- **Codec:** `pickCodec(mime)` — raw for already-compressed (png/webp/jpeg/gif/video), gzip otherwise (brotli reserved).

## Phases
- **2b-i (additive, safe):** ABI (new payable `mint` + `hostingFeeBps` + `LOG_LEDGER_ABI`), `Log` enum=5; `contracts.ts` `logLedger` registry + getter; `env.ts` `logLedgerRelayerPk` + `rpcBaseSepolia`/`rpcSepolia`; `src/lib/logledger/fileId.ts` + `pick-codec.ts` (+ barrel + tests); `src/lib/proof/state-proof.ts` (pure SVG card + cap logic tested in vitest; canvas/video verified in-browser).
- **2b-ii (server, safe):** `src/lib/logledger/relayer.ts` (`publishToLogLedger`); `/api/store` extension (accepts `chainId`, returns `logLedger`); on-chain integration test against Base Sepolia (publish fixture → reconstruct → verify root).
- **2b-iii (flips live mint):** `useOnchainMint` rewrite (generate proof → `mint(bytes,0)` → append `Log` + off-chain shards); full on-chain pipeline test using a server key as minter; then update ABI + addresses on Vercel `perp-art`.

## Verification gates
- vitest green for all pure logic (fileId, pick-codec, state-proof pure parts).
- `npx tsc --noEmit` clean; `next build` clean.
- On-chain: relayer publishes a fixture to LogLedger on Base Sepolia and `reconstructFile` (real chain reads) verifies it; a server-key mint records a Log shard and `tokenURI` returns a valid `data:` URI.
- Browser: `/run` to confirm canvas/video proof generation in the real mint wizard.
