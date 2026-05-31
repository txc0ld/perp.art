# Log Ledger Shard — Design Spec

**Date:** 2026-05-31
**Project:** Perpetual (Forever Library–based permanence-first NFT marketplace)
**Source brief:** `log_ledger_implementation.md`
**Status:** Approved design → ready for implementation plan.

This spec adapts the source brief to Perpetual's *actual* codebase and records the
four design decisions made during brainstorming:

1. **Main/STATE shard = real on-chain bytes via SSTORE2** (not a hash-only pointer, not a base64 data-URI in storage).
2. **LOG shard = first-class `ShardBackend.Log` enum value** on `ForeverLibrary`.
3. **Full spec end-to-end** (contracts → pipeline → resolver → frontend → re-emission).
4. **LogLedger chunk uploads are signed by a backend relayer**, not the artist.

---

## 0. The one rule that must not be broken

Event-log data is committed to by consensus (receipts root) but its **availability is
not protocol-guaranteed** (EIP-4444). Therefore every token using a LOG shard MUST also
have a STATE proof shard holding a low-res/compressed canonical copy in *contract storage*.

- The LOG shard is the high-fidelity primary.
- The STATE shard is the consensus-guaranteed backstop and the **only** shard that
  satisfies listing eligibility. A LOG shard never satisfies the gate.

## 1. Current-state facts this design depends on

- `ForeverLibrary.sol` Shard 0 ("Onchain proof") today stores only `(backend, contentHash, uri)`
  in storage — the ethfs/SSTORE2 byte persistence is a stub (`ForeverLibrary.sol:343-346`).
  So the "consensus-guaranteed bytes on-chain" backstop does **not** exist yet; this spec creates it.
- `ShardBackend` enum (`IForeverLibrary.sol:40-46`): `Onchain, IPFS, Arweave, Irys, CDN`.
- `mint(...)` signature currently ends `... bytes32 metadataHash, string proofURI, bytes32 proofContentHash, uint16 hostingFeeBps`.
- `configureShard(tokenId, index, backend, uri, contentHash)` is `onlyCreator` + `whileEditable`; appends at `index == shardCount`.
- `PerpetualSettlement` (`0xD2d3…` Base Sepolia) reads `hostingFeeBps` via try/catch and is **unaffected** by shard changes.
- No SSTORE2/solady lib is installed (only `forge-std` + `@openzeppelin/contracts@5.6.1`). SSTORE2 must be vendored.
- ABI + addresses live in `src/lib/web3/{abis.ts,config.ts,contracts.ts}`. Permanence UI in
  `src/components/token/CertificateOfPermanence.tsx` + `src/components/permanence/*`.
  Eligibility concept in `src/lib/types.ts` (`listable`) + `mock-data.ts:277`.

## 2. `ForeverLibrary` changes

### 2.1 Enum
Add `Log` to `ShardBackend`. To preserve existing ordinals and avoid reshuffling, append it:
```
enum ShardBackend { Onchain, IPFS, Arweave, Irys, CDN, Log }  // Log = 5
```

### 2.2 STATE shard becomes real on-chain bytes (SSTORE2)
- Vendor `SSTORE2` (Solady) + use OZ `Base64`.
- `mint` signature changes: replace `string proofURI, bytes32 proofContentHash` with
  `bytes calldata proofData`. (`mediaType` already a param; it is the proof's MIME.)
- At mint: `address ptr = SSTORE2.write(proofData);` store `ptr` and set Shard 0's
  `contentHash = keccak256(proofData)` (computed on-chain — trustless).
- New storage: `mapping(uint256 => address) private _statePointer;`
- `shardURI(id, 0)` returns `string.concat("data:", mediaType, ";base64,", Base64.encode(SSTORE2.read(ptr)))`.
  Other shards return their stored `uri` unchanged.
- `shard0Configured` semantics unchanged; the gate now means "low-res canonical bytes are on-chain."
- Guard: `proofData.length` capped (e.g. `<= 24_576` bytes) to keep a single SSTORE2 write within contract-size limits; revert `ProofTooLarge` otherwise.

### 2.3 What does NOT change
Provenance/`MintData`, ERC-2981 royalties, hosting fee, edit window, lock, `configureShard`
append mechanics, `selectedShardIndex`, `PerpetualSettlement`.

## 3. `LogLedger` contract (standalone)

Per source brief §2.1, implemented verbatim:
- State per `fileId`: `{ bytes32 root; uint256 size; uint32 chunks; uint32 deployBlock; uint8 codec; bool sealed; address author; }`
- Events: `FileOpened(fileId, author)`, `FileChunk(fileId indexed, chunkIndex indexed, bytes data)`, `FileSealed(fileId, root, size, chunks, codec)`.
- Flow: `open(fileId)` (claims authorship, records `deployBlock`) → `upload(fileId, i, data)` (author-gated, unsealed-gated, emits chunk) → `seal(fileId, root, size, chunks, codec)` (writes commitment, immutable thereafter).
- No on-chain chunk ordering; order/completeness enforced cryptographically by the Merkle root at verify time.
- Standalone & reusable across collections. FL references it only by `(ledger, fileId)`.
- Full Foundry tests: open/upload/seal happy path, author gate, already-sealed guard, not-opened guard, and a Merkle round-trip fixture matching the shared TS module byte-for-byte.

## 4. fileId binding & signer model (DECISION: relayer)

- `fileId = keccak256(abi.encode(collectionAddress, contentHash, uint32 version))`.
  **Bound to content hash, not `tokenId`** — avoids the mint-ordering chicken/egg
  (tokenId isn't known until mint). `version` lets an artist publish a corrected file
  without overwriting the original immutable `fileId`.
- **Backend relayer** (`LOGLEDGER_RELAYER_PK`, a funded server wallet per chain) performs
  `open/upload/seal`. It becomes the `author` of the fileId. Cost is covered by the existing
  economics: artist-pays storage fee, or Perpetual-hosts @1.5%.
- The artist signs exactly **two** txs: `mint(proofData,…)` and `configureShard(id, 1, Log, "log://<ledger>/<fileId>", root)`.

## 5. Shared TS verification module — `src/lib/logledger/`

ONE module imported by both backend resolver and frontend verifier (byte-identical results — source brief §11 #1):
- `chunk.ts` — fixed chunk size (12 KB) + concat helpers.
- `merkle.ts` — leaf = `keccak256(chunkBytes)`; pair = `keccak256(left ++ right)`; **odd node promoted unchanged** (no duplication); root computed identically everywhere.
- `codec.ts` — `0 raw / 1 gzip / 2 brotli / 3 RLE`; `compress(bytes, codec)` + `decompress(bytes, codec)`; inverse always driven by the sealed on-chain `codec`, never inferred.
- `reconstruct.ts` — `reconstruct(provider, ledger, fileId)`: read `files(fileId)`; guard `sealed`; `eth_getLogs` from `deployBlock`; decode+sort by chunkIndex; assert contiguous `0..chunks-1`; **verify Merkle root before trusting bytes**; assert `size`; `decompress`. Returns `{ bytes, mime }`.

## 6. Upload pipeline & mint sequence

`/api/store` (extends existing Blob-based route) produces, from the artist's uploaded file:
1. **proofData** — low-res/compressed canonical (≤24 KB) for the SSTORE2 STATE shard.
2. **LOG payload** — high-res compressed (codec chosen per source brief §3.3 table) → chunked → Merkle `root`, `size`, `chunks`, `codec`, `fileId`.

Sequence:
1. Artist uploads (existing Blob path).
2. **Artist tx:** `mint(proofData, mediaType, …)` → SSTORE2 STATE shard (Shard 0) + provenance.
3. **Relayer:** `open(fileId)` → `upload(fileId, i, chunk)` per chunk → `seal(fileId, root, size, chunks, codec)`. Seal only after upload txs are well-confirmed (re-org safety, source brief §11).
4. **Artist tx:** `configureShard(tokenId, 1, ShardBackend.Log, "log://<ledger>/<fileId>", root)`.

If the relayer never seals, the resolver falls back to STATE — collector loses nothing.

`useOnchainMint.ts` orchestrates 2+4 (artist wallet via wagmi); a server action / API route triggers 3 (relayer via viem wallet client). `mint` ABI + the `Log` enum + `LogLedger` ABI are added to `src/lib/web3/abis.ts`; new addresses to `config.ts`/`contracts.ts` + `.env.local` + Vercel `perp-art`.

## 7. Backend resolver + retention

- `GET /api/shard/log/[ledger]/[fileId]`:
  - Multi-RPC: fetch logs from ≥2 independent providers (+ archive if available); require agreement. Disagreement/missing ⇒ mark `unavailable`, return STATE.
  - Reconstruct via §5 module; **verify root before serving**.
  - Cache verified bytes keyed by `fileId` in Vercel Blob (immutable once sealed → cache forever).
  - Respond with correct `Content-Type`, `ETag = root`, and commitment headers `X-Content-Root`, `X-Codec`, `X-Size`.
- **Retention job** (Vercel cron): periodically re-reconstruct each LOG shard from a non-archive public RPC; record `logAvailable: bool` + `lastVerified` timestamp for the panel.

## 8. Forever Library renderer integration

- `tokenURI()` unchanged in mechanism (returns selected shard URI). Default `selectedShardIndex` stays 0 (STATE) so OpenSea always gets the zero-dependency on-chain data URI; Perpetual's own UI prefers the LOG resolver URL for the high-res view with STATE as documented fallback.
- Frontend resolves a `log://<ledger>/<fileId>` shard URI to `/api/shard/log/<ledger>/<fileId>`.

## 9. Frontend verification

- **Light verify (default):** fetch bytes from resolver; read `X-Content-Root`; recompute Merkle root client-side (same chunk size + codec) from served bytes; compare to on-chain `root` read via the **user's own** RPC/wallet provider. Green check only on match.
- **Full verify (on demand):** frontend itself calls `eth_getLogs`, reconstructs, verifies — no backend. Offered as "verify independently" on the token page.
- Both read the authoritative `root` from chain state, never from the backend.

## 10. Permanence Status panel (source brief §8)

Add rows to `CertificateOfPermanence.tsx`:
```
STATE   On-chain state (consensus-guaranteed)   ✓ low-res proof · root matches
LOG     On-chain logs (cost-efficient)          ✓ high-res · root matches · retention-checked <date>
IPFS    Content-addressed (optional)            ✓ CID matches
ARWEAVE Pay-once permanent (optional)           ✓ confirmed
HASH    Content root                            ✓ verified client-side
```
- STATE row = verified accent. LOG row, when retention-checked and matching, also verified — but always labeled "cost-efficient / retention-monitored," never "guaranteed."
- `logAvailable == false` ⇒ neutral LOG row: "high-res log copy not currently served by public nodes; cached + re-emittable; state proof intact." No alarm.

## 11. Listing-eligibility gate (source brief §5)

A token is listable **iff**:
1. STATE shard exists (`shard0Configured`) — LOG does NOT satisfy this; and
2. STATE shard `contentHash` (== `keccak256` of the on-chain SSTORE2 bytes) matches the mint record; and
3. If a LOG shard is present, `LogLedger.files[fileId].sealed == true && root != 0`.

LOG-but-no-STATE ⇒ not listable, with the message: *"Add an on-chain proof shard to list.
The high-resolution log copy is cost-efficient but retention-dependent; permanence requires the state proof."*

## 12. Re-emission (resilience capstone)

Because `root` is permanent in state, anyone holding the bytes can re-emit the chunks and they
verify against the original root. Ship a "re-publish high-res copy" tool (artist/collector/marketplace)
that takes cached/owned bytes, re-emits under a republish version, and re-verifies against the original root.
Turns EIP-4444 pruning into a non-issue.

## 13. Build order (sequenced implementation plan)

1. **Contracts** — vendor SSTORE2; FL SSTORE2 STATE + `Log` enum + signature change; `LogLedger`; Foundry tests; **one** FL redeploy (supersedes `0x87e8…` Base Sepolia) + new `LogLedger` deploy on Base Sepolia & Ethereum Sepolia; ABI + addresses into app + `.env.local` + Vercel `perp-art`.
2. **Shared TS module** (`src/lib/logledger/`) + upload pipeline (`/api/store` extension) + mint wiring (`useOnchainMint.ts`, relayer API route, `LOGLEDGER_RELAYER_PK`).
3. **Resolver/indexer** (`/api/shard/log/[ledger]/[fileId]`) + Blob cache + retention cron.
4. **Frontend** — verify module (light+full), Permanence panel rows, eligibility gate enforcement.
5. **Re-emission tool.**

## 14. Pitfalls (carry into implementation)

- Merkle drift between backend & frontend → single shared module (§5).
- Chunks ≤ ~12 KB (block-gas safety); never an unbounded `getLogs` (always `fromBlock = deployBlock`).
- Never trust a single RPC's logs; require multi-provider agreement; missing/unverified ⇒ STATE fallback, never serve unverified bytes.
- LOG is never the proof shard; gate + panel language keep STATE as the guarantee.
- Always read `codec` from sealed state; never infer.
- Seal only after upload txs are well-confirmed (re-org).
- SSTORE2 single-write size limit (~24 KB) → cap `proofData`; downscale aggressively.

## 15. New env / infra

- `LOGLEDGER_RELAYER_PK` — funded relayer wallet (Base Sepolia + Ethereum Sepolia for now), server-only, in `.env.local` + Vercel `perp-art`. Never in `.env.example`.
- `NEXT_PUBLIC_LOG_LEDGER_BASE_SEPOLIA`, `NEXT_PUBLIC_LOG_LEDGER_SEPOLIA` — LogLedger addresses.
- Second RPC provider URL per chain for resolver multi-RPC agreement.
- Vercel cron entry for the retention job.

## 16. Summary

Log Ledger gives Perpetual near-free, verifiable, high-resolution on-chain media (bytes in event
logs, ~8 gas/byte) committing only a Merkle root to state, slotted into Forever Library as a
first-class `Log` shard. A real SSTORE2 on-chain STATE shard is the consensus-guaranteed backstop
and the sole listing-eligibility gate. Backend relayer handles chunk uploads; backend resolver
indexes/verifies/caches; frontend verifies independently against the on-chain root. Because the
root is permanent, the high-res copy is trustlessly re-emittable forever.
