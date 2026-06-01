# Perpetual - Feature Catalog

A concise reference to what Perpetual does and what makes it different. Permanence-first,
multi-chain, non-custodial. The marketplace can disappear; the art cannot.

For the in-depth account see the on-site docs (`/docs`), [`ARCHITECTURE.md`](./ARCHITECTURE.md),
and [`INDEXER_SPEC.md`](./INDEXER_SPEC.md). Live demo:
https://perpetual-art-tx-build.vercel.app

---

## Permanence (the core)

- **Five storage shards** per token, in parallel, independently verifiable:
  - **STATE (Shard 0, mandatory)** — low-res canonical image stored on-chain via **SSTORE2**
    (bytes-as-contract-bytecode) in the ForeverLibrary contract. Consensus-guaranteed (contract
    state, unprunable); content hash computed on-chain. The permanence backstop and the ONLY shard
    that qualifies a token for listing.
  - **LOG (high-res primary)** — full-res media in Ethereum **event logs** via a standalone
    **LogLedger** contract (~8 gas/byte). Only a Merkle root + size live in contract state.
    Root-verifiable by anyone; availability is retention-monitored (EIP-4444 — nodes may prune
    historical logs); backstopped by STATE. Cost-efficient, not consensus-guaranteed.
  - **IPFS** (via Pinata), **Arweave**, **Irys** — redundant off-chain permanent copies.
- **Read-only verification service** resolves each shard, hashes the bytes, and compares against
  the content hash recorded on-chain at mint. Public data only, so anyone can reproduce it.
- **Permanence Status panel** on every token: one row per shard, live status, each row linking to
  its raw public source.
- **The decoupling:** because the STATE shard carries permanence on its own, IPFS/CDN costs are
  performance optimizations, not permanence obligations. Permanence is decoupled from operator
  solvency.
- **Collections (sovereign contracts):** `ForeverLibraryFactory.createCollection(name, symbol)` deploys an artist-owned `ForeverLibrary` in one transaction; the factory emits a `CollectionCreated` event so the indexer discovers every collection. The canonical contract is the "Default (open) collection." Artists can mint distinct 1-of-1s into a collection one at a time to build a named series, or use the **Collection drop** path (ZIP of art + metadata, validated in-browser, batch-minted) for bulk PFP / generative sets under the lighter folder-permanence tier. Deploying from Profile is a real on-chain deploy.
- **Editions:** `mintEdition` mints N ERC-721 copies of one artwork that share one SSTORE2 STATE proof, one LogLedger LOG copy, and one IPFS/Arweave/Irys copy (storage written once). Each token is tagged `edition X / N`, individually owned, and tradeable. The mint wizard caps edition size at 10 (contract allows up to 100).
- **Live on testnet (Base Sepolia + Ethereum Sepolia):** the mint pipeline, on-chain read layer
  (`/token/onchain/[chainId]/[contract]/[tokenId]`; per-collection at `/collections/onchain/[chainId]/[contract]`), lite indexer (explore/collections surface real
  on-chain tokens from all factory collections), and fixed-price ETH trading
  (EIP-712 listings → PerpetualSettlement on-chain fulfillment) are all live. Every surface reads
  100% live on-chain data — there is no mock catalog; on a sparse testnet, surfaces honestly show
  their empty states. Catalog text-search covers the live token set.

## Multi-chain (one-stop shop)

- **Nine networks**, indexed and traded as one marketplace.
- **Permanence-native (EVM):** Ethereum, Base, Polygon, Arbitrum, Optimism, Zora. Forever Library
  deploys here; the onchain proof shard is native.
- **Indexed + traded (non-EVM):** Solana, Tezos, Flow. Native storage and settlement.
- Discovery (explore, rankings, stats) filters across every chain; prices show the chain's native
  currency (ETH / POL / SOL / XTZ / FLOW).

## Trading

- **Gasless fixed-price listings** - signed EIP-712 orders, settled onchain only when filled; valid
  onchain even if the orderbook is down. **Live.**
- **Collector offers** - signed, gasless bids the holder can accept on their own terms. **Coming
  soon** — the token page and profile surface an honest coming-soon state, not fabricated bids.
- **NFT-for-NFT swaps** - barter your token(s) for theirs, with optional ETH on either side to
  balance value, including criteria swaps against a collection or trait and a swaps desk
  (`/swaps`). **Coming soon** — presented as an honest coming-soon state, not a fabricated composer.
- **Enforced royalties** - ERC-2981, checked at settlement; a sale that does not honor the royalty
  is rejected by the contract, not by the interface. Capped at 10% (protocol bound).

## Cross-chain settlement

- A swap whose two sides span different chains settles **atomically** via an escrow bridge: lock on
  chain A, release on chain B, rollback on failure. No half-settled state.
- A flat **bridge fee** is shown at the point of trade, alongside the protocol fee and royalty,
  before you confirm.
- Ships with swaps — **coming soon**.

## Identity, scoring, and proof

- **ENS identities** - addresses resolve to ENS names across profiles, swaps, provenance, offers,
  and activity, with a short-address fallback. Presentational only; the address stays the source of
  truth.
- **Permanence Score** - a data-backed grade per token (up to A+) from the onchain proof, the
  content-hash match, redundant permanent copies, and lock state. Badge + detail card. A portfolio
  **Permanence Report** aggregates a wallet's holdings on the profile.
- **The Vanish Test** - an interactive proof on each token page: take the operator layers (indexer,
  CDN, IPFS pin) offline in turn while the onchain proof keeps resolving the art. Reduced-motion
  safe.
- **Certificate of Permanence** - a downloadable, archival SVG certificate per token (title,
  artist, token id, content hash, shard list, mint date, grade).

## Sovereignty + rebuildability

- **Sovereign contracts** - artists deploy and own their own `ForeverLibrary` instance outright via `ForeverLibraryFactory.createCollection(name, symbol)` — one transaction, one real on-chain deploy. Perpetual indexes every factory collection as a federated index. If you leave, your contract, tokens, provenance, and permanence leave with you.
- **Published, rebuildable indexer** - reads only public onchain data and public storage networks;
  the schema is published in [`INDEXER_SPEC.md`](./INDEXER_SPEC.md) so any third party can run an
  equivalent index. The marketplace is not a single point of failure for discovery, just as it is
  not one for storage.

## Feel (tasteful 3D)

- Pointer-tilt artwork cards, a 3D coverflow of featured drops, the 3D ShardStack permanence
  visualization, and scroll-driven depth reveals. All reduced-motion safe; the art is always the
  brightest element.

## Configuration

- Minting (including collections and editions), on-chain read layer, lite indexer, and fixed-price trading are live on testnet.
  Every surface reads live on-chain data — no mock catalog. To wire live
  infrastructure, every variable (per-chain RPCs, WalletConnect, contracts including ForeverLibraryFactory, the bridge, the
  indexer + database, storage providers, the verification service, ENS) is documented in
  [`.env.example`](../.env.example).
