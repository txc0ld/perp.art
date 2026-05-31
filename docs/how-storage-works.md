# How Perpetual Stores Art — Five Independent Shards

This explains, in detail, what actually happens to your artwork when you mint on Perpetual: what
goes **on-chain**, what goes to **permanent off-chain networks**, and how anyone can
**independently prove** the piece is authentic and unaltered — forever, even if Perpetual disappears.

---

## TL;DR

When you mint, Perpetual:
1. Computes a **cryptographic fingerprint** of your exact file (`keccak256` hash).
2. Stores a **full-resolution copy in Ethereum event logs** via the LogLedger contract
   (Merkle-tree chunked, ~8 gas/byte).
3. Pins **three permanent off-chain copies** — IPFS (Pinata), Arweave, and Irys — in parallel.
4. Writes a **mandatory on-chain STATE shard** into the ForeverLibrary contract: a low-res
   canonical image stored directly in contract bytecode via **SSTORE2**. The content hash is
   computed on-chain at write time. This is the consensus-guaranteed permanence backstop.

The result: **five parallel, independently verifiable shards** — all locators and Merkle roots
recorded on-chain, verifiable by anyone, requiring no trust in Perpetual.

---

## The five shards

| # | Name | What lives there | Guarantee | Survives if… |
|---|------|------------------|-----------|--------------|
| **0** | **STATE (mandatory)** | Low-res canonical image: image downscale / video poster / SVG cover-card (≤24 KB), stored as contract bytecode via **SSTORE2** in ForeverLibrary. Content hash computed on-chain. | Consensus-guaranteed — contract state is unprunable | …as long as the chain exists |
| **1** | **LOG (high-res primary)** | Full-resolution media, chunked into Ethereum event logs via the **LogLedger** contract (~8 gas/byte). Only the Merkle root + file size live in contract state. | Root-verifiable by anyone; **retention-monitored** (EIP-4444 — nodes may prune historical logs). Backstopped by STATE. | …archival nodes retain historical logs |
| **2** | **IPFS** (Pinata) | Full artwork bytes, content-addressed | Retention-monitored (any node keeps pinning it). Backstopped by STATE. | …any node keeps pinning it |
| **3** | **Arweave** | Full artwork bytes, pay-once endowment | Backstopped by STATE | …the Arweave network exists |
| **4** | **Irys** | Full artwork bytes (settles onto Arweave) | Backstopped by STATE | …Arweave exists |

No single one of the off-chain copies is controlled by Perpetual's servers. **Permanence doesn't
depend on us staying online.** Even if every off-chain copy disappears, the STATE shard always
resolves via Ethereum.

> **On the LOG shard's permanence:** cost-efficient and Merkle-verifiable, but not
> consensus-guaranteed. EIP-4444 allows nodes to prune historical event logs over time.
> The STATE shard is the guaranteed backstop; the LOG shard is the cost-efficient high-res
> primary that's expected to be available for a long time but may require archival access eventually.

---

## On-chain vs off-chain: what goes where

A full-resolution image or video is far too large to store entirely in blockchain state at
reasonable cost. Perpetual splits it across two tiers:

- **STATE shard (consensus-guaranteed):** A compact representation of the work — a downscaled
  image, a video poster frame, or an SVG cover-card, ≤24 KB — is written to contract bytecode
  via **SSTORE2** (bytes-as-contract-bytecode pattern). It lives in consensus-guaranteed Ethereum
  state: no pruning, no expiry, as long as the chain exists. The content hash is computed on-chain
  at write time and recorded in ForeverLibrary's shard registry.

- **LOG shard (cost-efficient high-res):** The full-resolution file is chunked into Ethereum
  event logs via the **LogLedger** contract. Only the Merkle root and file size are stored in
  contract state; the chunks live in the transaction log. Anyone can reconstruct the file from
  the logs, compute the Merkle root, and verify it matches the root in contract state — without
  trusting Perpetual. The resolver at `/api/shard/log/[ledger]/[fileId]` does this automatically:
  it paginates `getLogs`, verifies the Merkle root against multiple RPCs, caches to Vercel Blob,
  and serves via CDN.

- **Off-chain permanent copies:** IPFS, Arweave, and Irys receive the full-resolution bytes in
  parallel. Their locators are recorded on-chain as shard descriptors alongside content hashes.

---

## The content hash — the anchor of trust

Everything hinges on one number. For the off-chain shards and the LOG shard, we compute:

```
contentHash = keccak256(fileBytes)
```

For the STATE shard, the content hash is computed on-chain at SSTORE2 write time and stored
in the ForeverLibrary shard registry. For the LOG shard, the Merkle root of all chunks is stored
in LogLedger contract state and is independently verifiable.

The content hash is:
- **Deterministic** — the same file always produces the same hash.
- **Tamper-evident** — change a single pixel and the hash changes completely.
- **Recorded on-chain** — stored against the token and against each shard.

Because the hash is on-chain, **anyone** can verify authenticity without trusting Perpetual:
download the file from any shard, hash it themselves, and confirm it equals the on-chain record.
If it matches, it's provably the original work. Clients are expected to verify the Merkle root
from chain state directly — they should never trust the backend's word alone.

---

## The mint sequence, step by step

When you click **Mint onchain**:

1. **Upload** — your file is uploaded directly to Vercel Blob (bypassing the old ~4.5 MB
   serverless cap; supports files up to ~100 MB).
2. **Hash + store** — the server computes `keccak256(fileBytes)` and pins the bytes to
   **IPFS**, **Arweave**, and **Irys** in parallel, getting back a permanent locator for each.
3. **Relayer publishes LOG shard** — a relayer calls LogLedger `open(fileId, totalChunks)`,
   uploads the file in chunks as event-log transactions, then calls `seal(fileId)`. The Merkle
   root is computed and stored in LogLedger state. The LOG shard locator is recorded on-chain.
4. **Generate STATE proof image** — the client generates the compact STATE representation:
   - Image: downscaled to ≤24 KB
   - Video: extracts a poster frame
   - SVG/interactive: generates a cover-card
5. **Mint (1 transaction)** — calls `ForeverLibrary.mint(...)`, which **atomically**:
   - writes the immutable provenance record (`MintData`),
   - sets the ERC-2981 royalty,
   - writes **Shard 0** (the STATE shard) via SSTORE2 — the image bytes become contract
     bytecode at a deterministic address; the content hash is computed on-chain,
   - mints the ERC-721 to you,
   - emits `TokenMinted`.
   A token can therefore **never exist without its STATE shard**.
6. **Record each shard on-chain** — for every backend that stored successfully, calls
   `ForeverLibrary.configureShard(tokenId, index, backend, uri, contentHash)`, writing that
   copy's locator + hash on-chain and emitting `ShardConfigured`.

A fully-replicated mint results in five shard descriptors recorded on-chain.

---

## What's literally in contract storage

From `contracts/src/ForeverLibrary.sol`:

```solidity
struct MintData {            // immutable provenance, per token
    address creator;
    uint64  timestamp;
    uint64  blockNumber;
    string  artistName;
    string  title;
    string  mediaType;
    uint96  royaltyBps;
    bytes32 metadataHash;
}

struct Shard {               // one per storage location
    ShardBackend backend;    // Onchain (SSTORE2) | Log (LogLedger) | IPFS | Arweave | Irys | CDN
    bytes32      contentHash;// keccak256 of the content, or Merkle root for Log shard
    string       uri;        // the resolvable locator
}
```

`mapping(uint256 => Shard[])` holds the ordered shards per token; index 0 is always the STATE
shard (SSTORE2), index 1 is the LOG shard (LogLedger).

---

## The LOG resolver

The `/api/shard/log/[ledger]/[fileId]` endpoint reconstructs the full-res file:

1. Calls `LogLedger.merkleRoot(fileId)` and `LogLedger.fileSize(fileId)` from multiple RPCs
   and requires agreement (multi-RPC root consensus).
2. Paginates `getLogs` for `ChunkWritten` events with the matching `fileId`.
3. Assembles chunks in order, verifies the Merkle root against the on-chain value.
4. Caches the reconstructed file to Vercel Blob and serves via CDN.

Clients that want independent verification should fetch the Merkle root directly from the
LogLedger contract and verify it against the assembled chunks — they should not trust the
resolver's output without checking the root.

---

## Resolving the artwork (`tokenURI`)

External platforms (our indexer, OpenSea, wallets) call `tokenURI(tokenId)`. It returns the
**selected shard's** locator (the creator can pick which copy to display), and **always falls
back to Shard 0** (STATE) if the selected shard is ever out of range. The permanence backstop
must always resolve.

---

## Immutability — edit window + lock

- **Edit window:** for a configured period after mint, the creator can add/replace off-chain shards.
  Shard 0 (STATE) is **never** rewritable after mint.
- **Lock:** the creator can call `lockShards(tokenId)` to **permanently freeze** all shards. A token
  can only be locked once its STATE shard exists, so a locked token is always permanence-complete.
  Locking is irreversible.

---

## Listing eligibility

A token qualifies for listing only if `shard0Configured(tokenId) == true` (the STATE shard
exists and its content hash is on-chain). Tokens without a STATE shard cannot be listed. This
is enforced both in the orderbook's listing-eligibility gate and is verifiable on-chain by anyone.

---

## Why this means "endures even if Perpetual does not"

- The **STATE shard** (who made it, when, and the exact pixels in compact form) is in
  Ethereum/Base contract bytecode — it outlives any company.
- The **LOG shard** Merkle root is in contract state, verifiable forever — even if the log
  data itself requires archival access, the root is there to prove any reconstruction.
- The **bytes** are replicated across three independent permanent networks, none of which
  Perpetual controls.
- The **hash** lets anyone, forever, prove a given file is the authentic, unaltered work —
  no need to trust Perpetual, a database, or a website.

If every Perpetual server vanished tomorrow, your token, its provenance, its royalty, and a
verifiable path to its bytes would all still be there. The STATE shard would resolve the artwork
directly from chain state.

---

## Deployed contracts (testnet)

- **Base Sepolia** — ForeverLibrary `0xfB66D6FDB038FdF335b4068C36d2d9Fef5E4f766` · LogLedger `0x24D3c508A375911eBBF4e2dF7e9587A56d1132e8` · PerpetualSettlement `0xD2d3B1A12CB01f44AaFcD1eb17d86c3C31fE56b9`
- **Ethereum Sepolia** — ForeverLibrary `0x748e330d28dC1f0d96737E09F1335aE9F9Cb4884` · LogLedger `0x3981BFaaf2a79B8F798DAf82433B9Cf7Da4d4ffe` · PerpetualSettlement `0x7Da4933d772815769b50914eBFfD47fe3c196A0B`
- `.env.local` / Vercel `perp-art` remain the source of truth.

> These are **testnet** deployments and are **unaudited** — do not treat them as
> production-secure until a full audit. No mainnet value.

---

## Reference

- **ForeverLibrary:** `contracts/src/ForeverLibrary.sol` — ERC-721 + ERC-2981 + SSTORE2 STATE shard.
- **LogLedger:** `contracts/src/LogLedger.sol` — event-log high-res shard with Merkle verification.
- **Storage route:** `src/app/api/store/route.ts` — hashing + IPFS/Arweave/Irys pinning.
- **LOG resolver:** `src/app/api/shard/log/[ledger]/[fileId]/route.ts` — reconstruction + verification.
- **Mint orchestration:** `src/components/mint/useOnchainMint.ts`.
