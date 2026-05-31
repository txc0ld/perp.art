# Log Ledger Shard — Implementation Spec

**For:** perpetual.art (Forever Library–based marketplace, already deployed)
**Purpose:** Add event-log storage as a primary store for large/high-resolution media, backstopped by a small on-chain **state** proof shard.
**Integration model:** New shard type plugged into the existing Forever Library renderer.
**Render path:** Backend indexes + caches; frontend independently verifies against the on-chain Merkle root.
**Status:** Build spec. Afternoon-scale PoC, then hardening.

---

## 0. The one rule that must not be broken

Event-log data is committed to by consensus (via the receipts root) but its **availability is not guaranteed by the protocol** — historical receipts/logs can be dropped by nodes (see EIP-4444). Therefore:

> **Every token using a Log Ledger shard MUST also have a `state` proof shard (SSTORE2/ethfs) holding a low-resolution or compressed canonical version.** The Log shard is the high-fidelity primary; the state shard is the consensus-guaranteed backstop that makes the "forever" claim honest.

The marketplace listing-eligibility gate already requires an on-chain proof shard. **Log shards do not satisfy that gate.** Only the state shard does. This rule is enforced in Section 5.

---

## 1. Architecture overview

```
Forever Library token
        │
        ├── Shard: STATE  (SSTORE2 / ethfs)   ← consensus-guaranteed backstop (low-res / compressed)
        ├── Shard: LOG    (event logs)         ← PRIMARY high-res media  [this spec]
        ├── Shard: IPFS                         (optional redundancy)
        └── Shard: ARWEAVE                      (optional redundancy)

LOG shard components:
  1. LogLedger registry contract  — emits chunk events, stores Merkle root + size in state
  2. Upload pipeline              — chunk → compress → emit → seal
  3. Backend indexer              — eth_getLogs → reassemble → verify → cache → serve
  4. Frontend verifier            — re-fetch logs OR verify cached bytes against on-chain root
```

The Log shard stores bytes in `FileChunk` event logs. The **only** things that live in contract **state** for the Log shard are the Merkle root and total size — these are cheap, permanent, and are what every client verifies against.

---

## 2. The registry contract

A standalone `LogLedger` contract. Forever Library tokens reference it by `(ledgerAddress, tokenId)` through the external renderer. Keeping it standalone means it is reusable across collections and sovereign artist contracts, and it never needs to be upgraded in lockstep with the marketplace.

### 2.1 Contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title LogLedger
/// @notice Cheap, verifiable on-chain media storage via event logs.
///         Media bytes live in event data; only the Merkle root + size live in state.
contract LogLedger {
    // --- state (the only consensus-guaranteed, permanent part) ---
    struct File {
        bytes32 root;       // Merkle root over ordered chunk hashes
        uint256 size;       // total byte length of the original (post-compression) file
        uint32  chunks;     // number of chunks
        uint32  deployBlock;// block where first chunk was emitted (indexer lower bound)
        uint8   codec;      // 0 = raw, 1 = gzip, 2 = brotli, 3 = RLE  (see §3.3)
        bool    sealed;     // once true, no further mutation
        address author;     // who may upload/seal this fileId
    }

    mapping(bytes32 => File) public files; // fileId => File

    // --- events: this is the storage layer ---
    event FileChunk(bytes32 indexed fileId, uint32 indexed chunkIndex, bytes data);
    event FileSealed(bytes32 indexed fileId, bytes32 root, uint256 size, uint32 chunks, uint8 codec);
    event FileOpened(bytes32 indexed fileId, address indexed author);

    error NotAuthor();
    error AlreadySealed();
    error NotOpened();
    error BadOrder();

    /// @notice Register intent to upload a file. fileId is caller-chosen and unique.
    ///         Recommended: fileId = keccak256(abi.encode(collection, tokenId, version)).
    function open(bytes32 fileId) external {
        File storage f = files[fileId];
        if (f.author != address(0)) revert AlreadySealed(); // already opened/used
        f.author = msg.sender;
        f.deployBlock = uint32(block.number);
        emit FileOpened(fileId, msg.sender);
    }

    /// @notice Emit one chunk of media. Does nothing but log. ~8 gas/byte.
    /// @dev chunkIndex must be strictly increasing per fileId (enforced off-chain at seal-time
    ///      via Merkle ordering; on-chain we only guard author + unsealed).
    function upload(bytes32 fileId, uint32 chunkIndex, bytes calldata data) external {
        File storage f = files[fileId];
        if (f.author != msg.sender) revert NotAuthor();
        if (f.sealed) revert AlreadySealed();
        emit FileChunk(fileId, chunkIndex, data);
    }

    /// @notice Finalize. Writes the verification commitment to state. One SSTORE-heavy call.
    function seal(
        bytes32 fileId,
        bytes32 root,
        uint256 size,
        uint32 chunks,
        uint8 codec
    ) external {
        File storage f = files[fileId];
        if (f.author != msg.sender) revert NotAuthor();
        if (f.author == address(0)) revert NotOpened();
        if (f.sealed) revert AlreadySealed();
        f.root = root;
        f.size = size;
        f.chunks = chunks;
        f.codec = codec;
        f.sealed = true;
        emit FileSealed(fileId, root, size, chunks, codec);
    }

    function isSealed(bytes32 fileId) external view returns (bool) {
        return files[fileId].sealed;
    }
}
```

### 2.2 Design notes

- **`fileId` instead of bare `tokenId`.** Decouples the ledger from any single NFT contract and makes it reusable. Bind it to a token with `keccak256(abi.encode(collectionAddress, tokenId, version))`. The `version` field lets an artist publish a corrected/replacement file without overwriting the original `fileId` (the original stays immutable and verifiable forever).
- **`open` → `upload`* → `seal`.** Open claims authorship of a `fileId`, uploads emit chunks, seal commits the root. After seal the file is immutable.
- **Author gate.** Only the opener can upload/seal a given `fileId`, preventing chunk injection by third parties.
- **`deployBlock` stored on-chain.** Gives the indexer a tight `fromBlock` so log scans are fast and cheap.
- **`codec`** records how bytes were compressed so reconstruction is deterministic (Section 3.3).
- **No `upload` ordering enforced on-chain** (saves gas). Order and completeness are guaranteed cryptographically by the Merkle root at verification time. A malformed upload simply fails verification and the file is treated as unavailable from the Log shard (falling back to the state shard).

---

## 3. Upload pipeline

Run server-side at mint, or as an artist tool. Produces the transactions that populate the Log shard, and the payload for the state proof shard.

### 3.1 Steps

1. **Compress** the media (Section 3.3). Record `codec`.
2. **Chunk** the compressed bytes into ≤ ~12–16KB pieces. (Stay under the practical calldata/log size that keeps each tx comfortably below block gas limits; 12KB is a safe default.)
3. **Hash each chunk** with `keccak256`.
4. **Build a Merkle tree** over the ordered chunk hashes; compute `root`.
5. `open(fileId)`.
6. For each chunk: `upload(fileId, i, chunk)`. Batch where possible; one chunk per tx is simplest and each is cheap.
7. `seal(fileId, root, size, chunks, codec)`.
8. **Produce the state proof shard**: a low-res or aggressively compressed canonical version, written via the existing SSTORE2/ethfs path your Forever Library renderer already supports.

### 3.2 fileId binding

```
fileId = keccak256(abi.encode(collectionAddress, tokenId, uint32 version))
```
Store the `(ledgerAddress, fileId)` pair in the Forever Library shard descriptor for that token (Section 4).

### 3.3 Compression / codec table

| codec | method | use for |
|---|---|---|
| 0 | raw | already-compressed formats (PNG, WEBP, MP4) where re-compression is pointless |
| 1 | gzip (deflate) | general fallback, universally decodable |
| 2 | brotli | text-like / SVG / generative code; best ratio |
| 3 | RLE | 1-bit / low-palette raster (e.g. ZX-Spectrum-style dithered work) |

Reconstruction must apply the inverse of `codec`. The codec is committed to in state via `seal`, so a client cannot be tricked into mis-decoding.

> Cost note: RLE on 1-bit dithered work routinely takes a 24KB raster to 4–8KB. At ~8 gas/byte that is cents to store the full-resolution piece in logs. The state proof shard for such work can often be the *same* file in SSTORE2 for a few dollars — for tiny pieces you may not need the Log shard at all.

### 3.4 Merkle construction (must match verifier exactly)

- Leaf = `keccak256(chunkBytes)`.
- Pair hash = `keccak256(left ++ right)` (concatenation, left then right).
- Odd node at a level is promoted unchanged (no duplication). **Document this and keep backend + frontend identical** — Merkle mismatches are the most common reconstruction bug.

---

## 4. Forever Library integration (extend, don't replace)

Your renderer already resolves `selectedShardIndex` → a shard URI. Add `LOG` as a new shard type alongside the existing `STATE / IPFS / ARWEAVE`.

### 4.1 Shard descriptor

Each shard entry the renderer stores for a token gains the ability to describe a Log shard:

```
ShardType: LOG
ledger:    address   // LogLedger contract
fileId:    bytes32   // keccak256(collection, tokenId, version)
mime:      string    // e.g. "image/png", "image/svg+xml"
```

For STATE / IPFS / ARWEAVE the descriptor is unchanged.

### 4.2 Resolution & selection policy

- **Default `selectedShardIndex` for display = the LOG shard** (high-res primary), per your "Log Ledger as primary store" decision.
- **Permanence backstop = the STATE shard**, always present, used if the Log shard cannot be reconstructed.
- The renderer's `tokenURI()` returns metadata whose `image` points at the resolver endpoint (Section 6) for the LOG shard, with the STATE shard as the documented fallback. The STATE shard remains a pure on-chain data URI so it resolves with zero external dependency.

### 4.3 What does NOT change

- The mint-record/provenance logic, royalty config, lock/edit windows, and existing shard plumbing are untouched.
- ethfs / SSTORE2 path stays exactly as-is — it is now explicitly the proof shard.

---

## 5. Listing-eligibility gate (enforcement)

Update the marketplace's existing eligibility check so the permanence guarantee stays honest:

A token is listable **iff**:
1. A `STATE` shard exists and is configured (`shard0Configured`-equivalent) **— a LOG shard does NOT satisfy this**; and
2. The STATE shard's content hash matches the on-chain mint record; and
3. If a LOG shard is present, its `LogLedger.files[fileId].sealed == true` and `root != 0`.

If a token has a LOG shard but no STATE shard → **not listable**; surface a clear message: "Add an on-chain proof shard to list. The high-resolution log copy is cost-efficient but retention-dependent; permanence requires the state proof."

---

## 6. Backend indexer + resolver

The backend indexes Log shards, verifies them once, caches the bytes, and serves them fast. It is an availability/performance layer — it is **not** the source of trust (the on-chain root is).

### 6.1 Indexing

```js
// Pseudocode — reconstruct a Log shard file.
async function reconstruct(provider, ledger, fileId) {
  const file = await ledger.files(fileId);           // root, size, chunks, deployBlock, codec, sealed
  if (!file.sealed) throw new Error("not sealed");

  const CHUNK_SIG = id("FileChunk(bytes32,uint32,bytes)");
  const logs = await provider.getLogs({
    address: ledger.address,
    topics: [CHUNK_SIG, fileId],                      // fileId is indexed topic[1]
    fromBlock: file.deployBlock,
    toBlock: "latest",
  });

  // decode (chunkIndex, data); sort by chunkIndex; ensure 0..chunks-1 all present
  const chunks = logs.map(decodeChunk).sort((a, b) => a.index - b.index);
  assertContiguous(chunks, file.chunks);

  // verify Merkle root BEFORE trusting bytes
  const leaves = chunks.map(c => keccak256(c.data));
  if (merkleRoot(leaves) !== file.root) throw new Error("root mismatch");

  const compressed = concat(chunks.map(c => c.data));
  if (compressed.length !== file.size) throw new Error("size mismatch");

  const bytes = decompress(compressed, file.codec);   // inverse of §3.3
  return { bytes, mime: /* from shard descriptor */ };
}
```

### 6.2 Caching & serving

- Cache the verified bytes keyed by `fileId` (immutable once sealed → cache forever; no invalidation needed).
- Serve at a stable resolver URL, e.g. `GET /shard/log/{ledger}/{fileId}` → media with correct `Content-Type` and a strong `ETag` = the on-chain `root`.
- Always include response headers exposing the commitment so the frontend can verify: `X-Content-Root: 0x…`, `X-Codec: n`, `X-Size: n`.
- **Multi-RPC reads.** Fetch logs from ≥2 independent RPC providers (and ideally one archive node) and require agreement. This mitigates a single provider having pruned or lying about history. If providers disagree or logs are missing, mark the Log shard `unavailable` and the resolver returns the STATE shard instead.

### 6.3 Retention monitoring (critical for honesty)

Because logs can be pruned post-EIP-4444, run a periodic job:
- For each Log shard, attempt a fresh reconstruction from a non-archive public RPC.
- Record `logAvailable: true/false` and last-verified timestamp.
- If a Log shard becomes unavailable, the piece is unaffected for the collector (STATE shard backstops, and your cache still holds verified bytes), but the **Permanence Status panel** must reflect reality (Section 8). Optionally trigger re-emission (Section 9).

---

## 7. Frontend verification

The frontend must be able to prove to the user that what they're seeing matches the chain — independently of your backend.

Two modes:

1. **Light verify (default).** Fetch bytes from the resolver. Read `X-Content-Root`. Recompute the Merkle root client-side from the served bytes (re-chunk using the same chunk size + codec metadata) and compare to the on-chain `root` read directly from `LogLedger.files(fileId)` via the user's own RPC/wallet provider. Green check only if they match.
2. **Full verify (on demand / power users).** Frontend itself calls `eth_getLogs` against a public RPC, reconstructs, and verifies — no backend involved at all. Slower; offered as a "verify independently" button on the token page.

Both modes read the authoritative `root` from chain state, never from the backend. The backend can never forge a verified state.

> Implementation: ship the same `merkleRoot`, chunk-size, and `decompress` code in a small shared TS module used by both backend and frontend to guarantee identical results.

---

## 8. Permanence Status panel — new rows

Surface the honest distinction. The panel must never present the Log shard as equivalent to the state shard.

```
PERMANENCE STATUS — <title>
──────────────────────────────────────────────
STATE   On-chain state (consensus-guaranteed)   ✓  low-res proof · root matches
LOG     On-chain logs (cost-efficient)          ✓  high-res · root matches · retention-checked <date>
IPFS    Content-addressed (optional)            ✓  CID matches
ARWEAVE Pay-once permanent (optional)           ✓  confirmed
HASH    Content root                             ✓  verified client-side
──────────────────────────────────────────────
Permanent backstop: STATE shard (cannot be pruned).
High-resolution copy: LOG shard (verifiable; availability monitored).
```

- STATE row uses the verified accent. LOG row, when retention-checked and matching, also verified — but its label always reads "cost-efficient / retention-monitored," never "guaranteed."
- If `logAvailable == false`, LOG row shows a neutral state: "high-res log copy not currently served by public nodes; cached + re-emittable; state proof intact." No alarm — the collector lost nothing.

---

## 9. Optional: re-emission (resilience upgrade)

Because the Merkle root is permanent in state, anyone holding the bytes can **re-emit** the chunks at any time and they will verify against the original root. This is a powerful property:

- Provide a "re-publish high-res copy" tool: takes the cached/owned bytes, re-runs `open`(new version fileId) or re-emits under a republish ledger, re-verifies against the original root.
- A collector, the artist, or the marketplace can restore the Log shard's availability indefinitely without trusting anyone — the root proves authenticity.
- This is the answer to EIP-4444 pruning: the data is cheap enough to re-emit, and the on-chain root makes re-emission trustless.

---

## 10. Build order (PoC → production)

1. **PoC (afternoon).** Deploy `LogLedger` to a testnet. Upload one image (open → upload chunks → seal). Run the reconstruction script. Verify the Merkle root. Confirm bytes round-trip.
2. **Codec layer.** Add gzip + RLE; verify deterministic round-trip for a PNG and a 1-bit dithered piece.
3. **Renderer integration.** Add the `LOG` shard type + descriptor to the Forever Library renderer; default selection to LOG with STATE fallback.
4. **Indexer + resolver.** Multi-RPC reconstruction, verify, cache, serve with commitment headers + retention job.
5. **Frontend verify.** Shared TS verify module; light + full verify; panel rows.
6. **Eligibility gate.** Enforce STATE-shard requirement; LOG never satisfies the gate.
7. **Re-emission tool.** Ship last; it's the resilience capstone.

---

## 11. Pitfalls (read before coding)

- **Merkle algorithm drift.** Backend and frontend MUST use byte-identical leaf hashing, pair ordering, and odd-node handling. Share one module.
- **Chunk size vs block gas.** Keep chunks ≤ ~12KB; very large single chunks can make an upload tx fail or get stuck. Many small chunks are fine and each is cheap.
- **Calling logs without `fromBlock`.** Always use the stored `deployBlock`; an unbounded `getLogs` across all history will time out on public RPCs.
- **Trusting a single RPC's log response.** Require multi-provider agreement; a pruned or malicious provider can omit chunks. Missing/!verified ⇒ fall back to STATE, never serve unverified bytes.
- **Treating LOG as the proof shard.** It is not. The eligibility gate and the panel language must keep STATE as the guarantee. This is the entire reason the design is honest.
- **Codec mismatch.** Always read `codec` from sealed state; never infer it.
- **Re-org during upload.** Seal only after upload txs are well-confirmed; if a chunk tx re-orgs out before seal, re-emit it before sealing.

---

## 12. Summary

Log Ledger gives perpetual.art near-free, verifiable, high-resolution on-chain media by storing bytes in event logs (~8 gas/byte) while committing only a Merkle root to state. It slots into Forever Library as a new `LOG` shard that serves as the **primary high-res store**, while a small **STATE** (SSTORE2/ethfs) shard remains the consensus-guaranteed permanence backstop and the only shard that satisfies listing eligibility. The backend indexes, verifies, and caches; the frontend verifies independently against the on-chain root. Because the root is permanent, the high-res copy is trustlessly re-emittable forever — turning EIP-4444 pruning from a threat into a non-issue.
