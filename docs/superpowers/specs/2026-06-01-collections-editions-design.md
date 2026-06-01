# Collections, Editions & 1-of-1s — Design Spec

**Date:** 2026-06-01
**Goal:** Mint **collections** (sovereign per-collection `ForeverLibrary` contracts via a factory), **editions** (N copies of one artwork sharing storage), **1-of-1s**, and **PFP drops** (N distinct artworks under a collection). All on the existing permanence pipeline (SSTORE2 STATE + LogLedger LOG + IPFS/Arweave/Irys).

## Approved decisions
1. **Editions = shared-storage `mintEdition`** on `ForeverLibrary`: write the SSTORE2 STATE proof ONCE, mint N ERC-721 tokens that all share it + one LOG `fileId` + one IPFS/Arweave/Irys copy; each token tagged `editionIndex 1..N` / `editionSize`. Tokens are individually tradeable.
2. **Collection = a sovereign `ForeverLibrary` instance**, created through a **`ForeverLibraryFactory`** (`createCollection` deploys the contract, owner = artist, and emits an event for global discovery).

## Architecture
- **`ForeverLibraryFactory`** (new contract): `createCollection(string name, string symbol, uint64 editWindow) returns (address)` → `new ForeverLibrary(name, symbol, msg.sender, editWindow)`; pushes to `collections[]`; emits `CollectionCreated(address indexed collection, address indexed owner, string name, string symbol)`. Views: `collectionsCount()`, `collectionAt(uint256)`, `isCollection(address)`. Lets the browser create a collection in ONE tx (factory holds the bytecode) and lets the indexer enumerate every collection by scanning `CollectionCreated`.
- **`ForeverLibrary.mintEdition(to, artistName, title, mediaType, royaltyBps, metadataHash, bytes proofData, uint16 hostingFeeBps_, uint32 editionSize)`** (new): one SSTORE2 write of `proofData` → one pointer; loop `editionSize` times minting sequential tokenIds that all reference that pointer + the shared `keccak256(proofData)` content hash; each token records `editionSize` + its `editionIndex` (1..N); per-token provenance/royalty/edit-window/`TokenMinted`; hosting/storage fee charged ONCE for the edition (not ×N). `editionSize` capped (e.g. ≤ 100) for gas. The existing `mint` stays for the simple path (it becomes `mintEdition` size-1 internally or remains).
- **MintData / token model:** add `editionSize` (uint32, 1 for 1-of-1) + `editionIndex` (uint32) to the per-token record (struct field or parallel mapping) + a getter. Add the same to the app `Token` type.
- **Sovereign deploy (real):** `DeployContractModal` calls `factory.createCollection(...)` via the connected wallet (replacing the fabricated address); on confirm, record the new collection (address, name, owner) so it appears immediately.
- **Multi-contract indexer/read-layer:** the indexer enumerates collections from the factory (`CollectionCreated`) + the canonical FL, scans each contract's `TokenMinted`, and groups tokens by their collection contract → real collections in `/collections` + per-collection pages. Token addressing gains the contract: the live token route becomes `/token/onchain/[chainId]/[contract]/[tokenId]` (the canonical FL is just one contract); `Token.id` = `${chainId}-${contract}-${tokenId}`. `readOnchainToken`/`readOwnedTokenIds` take a contract address.
- **Mint UX:** the wizard gains (a) a **collection selector** — pick one of your collections (from `factory` enumeration filtered to owner) or "Default (open) collection" (the canonical FL) or "+ New collection" (deploy via factory); (b) a **mint type** — 1-of-1 / Edition (size N) / PFP drop (batch N distinct files); (c) edition + batch wiring (`mintEdition` for editions; loop the single pipeline per file for PFP, all into the chosen collection contract). The LOG relayer publishes once per distinct artwork (editions reuse one fileId).

## Honest scope / implications
- Another `ForeverLibrary` redeploy (adds `mintEdition`/edition fields) + a new `ForeverLibraryFactory` deploy on Base Sepolia + Eth Sepolia. The current FL's throwaway test tokens orphan (fine on testnet). The canonical FL becomes the "Default (open) collection."
- `editionSize` capped for gas; each collection deploy is a real contract (gas). Testnet + unaudited throughout.
- The indexer/read-layer/trading become multi-contract — addressing changes (contract in the path/id). Mock catalog still coexists.
- ERC-721 throughout (editions are individual tokens) — no ERC-1155.

## Decomposition (build order; each its own plan)
1. **Contracts** — `mintEdition` + edition fields on `ForeverLibrary`; `ForeverLibraryFactory`; Foundry tests (edition shares one SSTORE2 pointer, N tokens, indices; factory deploys + enumerates + ownership); deploy factory + redeploy FL on both testnets. *(foundation)*
2. **Real sovereign deploy** — `DeployContractModal` → real `createCollection`; collection registry/record; ABIs + factory addresses wired.
3. **Multi-contract indexer + read-layer** — enumerate collections via factory; contract-addressed token reads + routes (`/token/onchain/[chainId]/[contract]/[tokenId]`); group by collection; per-collection pages; explore/collections show real collections.
4. **Mint UX** — collection selector + create, mint-type selector (1-of-1 / edition / PFP batch), edition (`mintEdition`) + batch wiring through `useOnchainMint`.

## Testing
- Foundry: `mintEdition` (size N → N tokens, all `shardURI(id,0)` resolve to the SAME bytes, shared content hash, editionIndex 1..N, fee charged once, cap enforced); factory (createCollection deploys an FL owned by caller, emits event, enumerable, isCollection true); existing FL tests still pass.
- On-chain (gated): factory.createCollection → mint an edition into it → read tokens back per contract; indexer enumerates the new collection.
- vitest: pure helpers (edition/collection mapping, multi-contract id parsing).
