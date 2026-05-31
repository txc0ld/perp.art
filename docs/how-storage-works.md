# How Perpetual Stores Art — On-Chain Proof + 4 Permanent Shards

This explains, in detail, what actually happens to your artwork when you mint on Perpetual: what goes **on-chain**, what goes to **permanent off-chain networks**, and how anyone can **independently prove** the piece is authentic and unaltered — forever, even if Perpetual disappears.

---

## TL;DR

When you mint, Perpetual:
1. Computes a **cryptographic fingerprint** of your exact file (`keccak256` hash).
2. Stores the artwork **bytes** in up to **3 independent permanent networks** (IPFS, Arweave, Irys).
3. Writes an **on-chain proof** into the NFT contract — the provenance, the fingerprint, and pointers to every copy — plus **records each storage location on-chain**.

The pixels live on permanent storage; the **proof of what those pixels are** lives on the blockchain itself. Anyone can re-download the file from any shard, hash it, and check it against the number recorded on-chain.

---

## The four shards

A "shard" is one independent copy/record of the work. Every token has a mandatory **Shard 0** (the on-chain proof) plus any of three off-chain permanent copies:

| # | Shard | What lives there | Controlled by | Survives if… |
|---|-------|------------------|---------------|--------------|
| **0** | **On-chain proof** | Provenance + content hash + pointers (a compact JSON record in contract storage) | Ethereum / Base | …as long as the chain exists |
| 1 | **IPFS** (via Pinata) | The full artwork bytes | Content-addressed network | …any node keeps pinning it |
| 2 | **Arweave** | The full artwork bytes | Arweave network (pay-once, store-forever endowment) | …the Arweave network exists |
| 3 | **Irys** | The full artwork bytes (settles onto Arweave) | Irys / Arweave | …Arweave exists |

No single one of these is controlled by Perpetual's servers. That's the point: **permanence doesn't depend on us staying online.**

---

## On-chain vs off-chain: what goes where

A full-resolution image or video is far too large to store directly in blockchain state (it would cost a fortune in gas). So Perpetual splits it:

- **Off-chain (the bytes):** the actual file is uploaded to IPFS, Arweave, and Irys. Each returns a permanent locator — an IPFS CID (`ipfs://Qm…`), an Arweave tx id (`ar://…`), an Irys id (`irys://…`).
- **On-chain (the proof):** the contract stores, in permanent Ethereum/Base state:
  - **Who/what/when** — creator address, artist name, title, media type, mint timestamp + block number.
  - **The content hash** — `keccak256` of the exact file bytes. This is the anchor.
  - **The locators** — the URI of every shard, so the work is findable from chain data alone.
  - **The royalty** — ERC-2981, enforced at sale.

> **Honest scope note:** In the current build, Shard 0 stores a compact JSON **proof record** (provenance + hash + pointer) directly in contract storage — not the full pixels. Writing the *entire* file as raw bytes on-chain (via an `ethfs` FileStore) is the design intent and is stubbed in the contract (`// ...` in `ForeverLibrary.sol`). So today: the *proof* is fully on-chain; the *bytes* live on the three permanent off-chain networks.

---

## The content hash — the anchor of trust

Everything hinges on one number. Before uploading, we compute:

```
contentHash = keccak256(fileBytes)
```

This 32-byte fingerprint is:
- **Deterministic** — the same file always produces the same hash.
- **Tamper-evident** — change a single pixel and the hash changes completely.
- **Recorded on-chain** — stored against the token and against each shard.

Because the hash is on-chain, **anyone** can verify authenticity without trusting Perpetual: download the file from IPFS/Arweave/Irys, hash it themselves, and confirm it equals the on-chain `contentHash`. If it matches, it's provably the original work.

---

## The mint sequence, step by step

When you click **Mint onchain**, this happens (see `src/components/mint/useOnchainMint.ts`):

1. **Upload** — your file is uploaded directly from the browser to temporary storage, then the server pins it to the off-chain shards. (`POST /api/store`)
2. **Hash + store** — the server computes `keccak256(fileBytes)` and pins the bytes to **IPFS**, **Arweave**, and **Irys** in parallel, getting back a permanent locator for each.
3. **Build the proof** — the client assembles Shard 0: a small JSON record `{ name, artist, image-pointer, contentHash }`, encoded as a `data:` URI, plus `metadataHash = keccak256(metadata)`.
4. **Mint (1 transaction)** — calls `ForeverLibrary.mint(...)`, which **atomically**:
   - writes the immutable provenance record (`MintData`),
   - sets the ERC-2981 royalty,
   - writes **Shard 0** (the mandatory on-chain proof),
   - mints the ERC-721 to you,
   - emits `TokenMinted`.
   A token can therefore **never exist without its proof**.
5. **Record each off-chain shard (1 transaction each)** — for every backend that stored successfully, calls `ForeverLibrary.configureShard(tokenId, index, backend, uri, contentHash)`, writing that copy's locator + hash on-chain and emitting `ShardConfigured`.

So a fully-replicated mint is: **1 mint tx + up to 3 shard-record txs.**

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
    ShardBackend backend;    // Onchain | IPFS | Arweave | Irys | CDN
    bytes32      contentHash;// keccak256 of the content (verification)
    string       uri;        // the resolvable locator
}
```

`mapping(uint256 => Shard[])` holds the ordered shards per token; index 0 is always the on-chain proof.

---

## Resolving the artwork (`tokenURI`)

External platforms (our indexer, OpenSea, wallets) call `tokenURI(tokenId)`. It returns the **selected shard's** locator (the creator can pick which copy to display), and **always falls back to Shard 0** — the on-chain proof — if the selected shard is ever out of range. The permanence backstop must always resolve.

---

## Immutability — edit window + lock

- **Edit window:** for a configured period after mint, the creator can add/replace off-chain shards. Shard 0 (the proof) is **never** rewritable after mint.
- **Lock:** the creator can call `lockShards(tokenId)` to **permanently freeze** all shards. A token can only be locked once its on-chain proof exists, so a locked token is always permanence-complete. Locking is irreversible.

---

## Why this means "endures even if Perpetual does not"

- The **proof** (who made it, when, and the exact fingerprint) is in Ethereum/Base state — it outlives any company.
- The **bytes** are replicated across three independent permanent networks, none of which Perpetual controls.
- The **hash** lets anyone, forever, prove a given file is the authentic, unaltered work — no need to trust Perpetual, a database, or a website.

If every Perpetual server vanished tomorrow, your token, its provenance, its royalty, and a verifiable path to its bytes would all still be there.

---

## Reference

- **Contract:** `contracts/src/ForeverLibrary.sol` — ERC-721 + ERC-2981 + URI sharding.
- **Storage route:** `src/app/api/store/route.ts` — hashing + IPFS/Arweave/Irys pinning.
- **Mint orchestration:** `src/components/mint/useOnchainMint.ts`.
- **Deployed (testnet):**
  - Base Sepolia — ForeverLibrary `0xD2C84ccD2b471882165903D2B07C39f77bc33C9E`
  - (See `.env.local` / Vercel for Settlement + Ethereum Sepolia addresses.)

> These are **testnet** deployments and are **unaudited** — do not treat them as production-secure until a full audit.
