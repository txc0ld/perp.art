# Perpetual — Contract Upgrade Roadmap

Status as of 2026-06-01. Contracts are **testnet, unaudited (internal adversarial audit only)**.
Audit findings live in this doc's "Deferred" section; the spec for drops is
`docs/superpowers/specs/2026-06-01-bulk-pfp-drops-design.md`.

## Done (built + internally audited, awaiting redeploy)
- **OpenSea compatibility**: `ForeverLibrary.tokenURI` now returns on-chain JSON metadata
  (`name`/`description`/`image`/`attributes`) + `contractURI()` (collection name, image,
  `seller_fee_basis_points`, `fee_recipient`). The image string is `escapeJSON`-wrapped and
  `mediaType` is charset-validated at mint (closes the 2 critical JSON-injection findings).
- **PerpetualDrop** (new): ERC-721 + manual ERC-2309 batch mint + ERC-2981, provenance commit,
  one-way reveal, `tokenURI = baseURI + id` (OpenSea-native folder metadata), `contractURI`.
  Hardened: batch cap ≤5000, reveal requires committed provenance, `maxSupply ≤ uint96`, no burn
  path (documented).
- **Factory.createDrop** + drop enumeration; deployment extracted to linked libraries
  (CollectionDeployer/DropDeployer) to stay under EIP-170 (delegatecall ownership verified correct).
- **PerpetualSettlement** hardening: royalty clamped to ≤10% (anti-grief), `price==0` rejected,
  **pull-payments** (failed transfers escrow to `withdrawable` + `withdraw()`) so a reverting
  recipient can't brick fills.

## Deferred from the audit (do next, by priority)
1. **Settlement — seller-signed fee bound (HIGH).** The seller currently signs no fee/royalty
   acknowledgment; protocol fee + NFT hosting fee are read live at fill. Add `minSellerProceeds`
   (or a full fee schedule) to the EIP-712 `Order` struct and enforce it on fill. Touches the
   order struct + frontend signing (`TradePanel`) + `/api/orders` validation. `// AUDIT:` TODO is
   in `PerpetualSettlement.fulfillOrder`.
2. **LogLedger — fileId author-binding + root integrity (MED).** `open` is first-come on a
   predictable `fileId` (squattable); the sealed Merkle root is author-asserted, not validated
   against uploaded chunks. Bind storage to `(author, fileId)` (or `fileId = keccak(msg.sender,…)`)
   and/or accumulate a chunk hash on-chain to validate the root at `seal`. Changes the relayer's
   fileId computation + the LOG resolver — coordinate together. `// AUDIT:` TODOs are in
   `LogLedger.open`/`seal`.
3. **PerpetualDrop — burn safety.** No burn path exists today (safe). If burns are ever added,
   port OZ's `_sequentialBurn` bitmap into the manual ERC-2309 `_ownerOf`, or ownership of
   never-transferred batch tokens will resurrect after burn.
4. **ERC-2309 indexer caveat.** Post-construction batch mint emits only `ConsecutiveTransfer`
   (no per-token `Transfer`). OpenSea supports it; verify each target marketplace/indexer before
   relying on it, and keep batches ≤5000 (enforced).

## Drops infra (to scale past low-thousands)
- **IPFS directory pinning at 7,000 scale**: current path issues one Pinata multipart request per
  folder — reliable for hundreds/low-thousands, not guaranteed for 7,000 within serverless limits.
  Move to Pinata **CAR upload** or a chunked pinning queue. (TODO in `/api/drops/process`.)
- **Job durability**: the drop-processing job store is in-memory. Back it with Redis/KV (`REDIS_URL`
  is already in env) before multi-instance production.
- **Arweave folder mirroring**: deferred (per-file Arweave txs cost-prohibitive at drop scale) —
  add an Irys/Arweave path manifest so drops get a permanent Arweave copy too.

## Upgradeability strategy (the core question)
Today every contract is **immutable** (no proxy). Each fix → redeploy → old tokens orphaned on the
old contract. Recommended path, not a blanket proxy:
- **Swappable metadata renderer (recommended for FL/Drop):** point `tokenURI`/`contractURI` at an
  owner-settable `IMetadataRenderer` so metadata can evolve (new marketplace fields, fixes) WITHOUT
  touching the token contract or migrating tokens. Low blast radius; the token/ownership/permanence
  core stays immutable.
- **UUPS proxy for PerpetualSettlement only:** the money contract benefits most from bug-fix agility.
  Accept the admin-key trust tradeoff; gate the proxy admin behind a multisig + timelock.
- **Keep ForeverLibrary's permanence core immutable** (its value is immutability) — use the renderer
  for the mutable metadata layer only.
- **Migration tooling:** if a non-renderer core change is ever needed, ship a migration that
  re-points the indexer + (optionally) lets holders re-mint into the new contract.

## Feature backends (currently "coming soon")
- **Offers/bids:** extend the orderbook with bid orders + a Settlement `acceptOffer` (signed buy
  orders, escrowed/allowance-based). Mirrors the existing sell-order flow.
- **Swaps (barter):** a dedicated swap-settlement contract (NFT↔NFT + ETH top-up, optional
  cross-chain). The off-chain `tokenMatchesCriteria` logic is already kept in `@/lib/swap-criteria`.
- **Per-token permanence upgrade for drop tokens:** let a drop holder optionally promote a single
  token to the full 5-shard ForeverLibrary permanence tier.

## Before mainnet (gate)
- Professional third-party audit of all contracts.
- SIWE/signature gate on `/api/profile` writes (currently unauthenticated on testnet).
- Multisig + timelock for contract owner/treasury/proxy-admin roles.
- Re-run the full deploy on mainnet with verified sources + the renderer/proxy decisions above.
