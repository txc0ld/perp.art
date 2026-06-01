# Bulk PFP / Generative Drops — Design

**Date:** 2026-06-01
**Goal:** Let a creator release a large collection (up to ~7,000 distinct works) by uploading
one archive, deploying a dedicated batch-mint contract, committing a provenance hash, minting
the supply cheaply, and revealing — all OpenSea-compatible.

## Decisions (locked with user)
- **Permanence model:** folder + on-chain provenance hash (standard PFP). One IPFS + Arweave
  folder holds the art; the contract stores ONE `provenanceHash` (covers the ordered asset-hash
  set) + a `baseURI`. No per-token SSTORE2/LOG at mint (would be ~7,000× cost). Per-token
  "upgrade to full permanence" is a later, opt-in path.
- **Upload:** a single ZIP (images + OpenSea-style `metadata.json`), validated server-side.
- **Reveal:** pre-reveal + provenance commit — mint against a placeholder `baseURI`, commit the
  provenance hash before mint, `reveal(realBaseURI)` later (one-way).
- **Contract type:** a NEW dedicated `PerpetualDrop` contract (NOT ForeverLibrary). Deployed by
  the existing `ForeverLibraryFactory` via a new `createDrop(...)`.
- **v1 mint scope:** creator pre-mints the supply to themselves (airdrop-style). A public
  claim/allowlist sale is a later feature.

## Contract: `PerpetualDrop.sol`
- **ERC-721 + OZ `ERC721Consecutive` (ERC-2309)** for cheap batch minting — one
  `ConsecutiveTransfer` range event instead of N `Transfer`s. Mint the supply in chunks
  (e.g. ≤2,000/tx) to the creator. + **ERC-2981** royalties (creator-set bps).
- **Provenance:** `bytes32 public provenanceHash` set once via `commitProvenance(hash)` before
  mint; immutable after. The off-chain ordered per-asset hash manifest is published alongside
  (anchored by this hash) so collectors can verify post-reveal.
- **Reveal:** `string baseURI` (placeholder at deploy) + `reveal(string realBaseURI)` (owner-only,
  one-way: sets a `revealed` flag, after which `baseURI` is frozen).
- **OpenSea-compatible metadata (REQUIRED):**
  - `tokenURI(id)` = `string.concat(baseURI, id.toString())` → resolves to per-token JSON
    metadata in the IPFS/Arweave folder (`{name, description, image, attributes}`). Pre-reveal it
    points at the placeholder.
  - `contractURI()` → collection-level JSON (name, description, image, `seller_fee_basis_points`,
    `fee_recipient`) for OpenSea collection display + royalties.
- Owner = creator (msg.sender at createDrop). Standard `ownerOf`/`balanceOf`/enumeration via
  ERC721Consecutive. Size must stay under EIP-170 24,576 B (`via_ir=true`).
- **Factory:** `ForeverLibraryFactory.createDrop(name, symbol, royaltyBps, maxSupply, placeholderURI)
  returns address`; pushes into a `drops[]` list; emits `DropCreated(drop indexed, owner indexed,
  name, symbol, maxSupply)`. The indexer enumerates drops alongside FL collections.

## Upload + processing pipeline
1. Client uploads the ZIP to Vercel Blob (multipart; GB-scale ok).
2. **Background processing job** (chunked + status-polled — a single serverless call can't pin
   thousands of files): `POST /api/drops/process` kicks it off, `GET /api/drops/status?id=`
   polls. Steps: validate ZIP (entry count ≤ MAX, every metadata entry has a matching image,
   schema-check attributes) → hash each asset → compute `provenanceHash = keccak256(concat(ordered
   assetHashes))` → pin the image folder to IPFS (one directory CID) + mirror to Arweave (Irys
   folder/manifest) → upload the per-token metadata JSON folder (image URLs point into the pinned
   media folder) → return `{ mediaCID, metadataBaseURI, arweaveManifest, provenanceHash, count }`.
3. Honest cap: enforce `MAX_DROP_SIZE` (7,000) and surface partial-failure clearly.

## UI — "Drop" mode in the mint flow
- Mint type gains **"Collection drop"** (alongside single / edition). Drop flow: ZIP dropzone →
  validation preview (count, sample thumbnails, trait summary) → processing-progress (polls
  status) → on-chain steps: deploy `PerpetualDrop` (factory) → `commitProvenance` → batch-mint in
  chunks (progress) → optional `reveal` now or later. Clear per-step wallet confirmations.

## Indexer / live data
- `indexer.ts` enumerates `DropCreated` from the factory; drops appear in `getLiveCollections()`
  and their tokens in `getLiveTokens()` (read via standard ERC-721 `tokenURI`/`ownerOf`). Drops
  are tagged as folder-permanence (distinct badge from 5-shard works).

## Honesty / framing
- Drops are an explicit **folder-permanence tier** (IPFS + Arweave folder + on-chain provenance
  hash), clearly distinct from the 5-shard per-token guarantee of 1-of-1s/editions. Copy says so.

## Testing
- Foundry: PerpetualDrop (consecutive batch mint, provenance commit-once, reveal one-way,
  tokenURI/contractURI shape, royalties, EIP-170 size) + factory createDrop/enumeration.
- Web: pipeline unit tests (provenance hash, ZIP validation) with fixtures; an integration test
  gated behind an env flag (real Blob/IPFS).

## Out of scope (later)
- Public claim/allowlist sale; per-token full-permanence upgrade; on-chain metadata for FL
  (tracked in the contract upgrade roadmap).
