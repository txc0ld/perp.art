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

## Fixed in source (lands at mainnet redeploy)
These audit findings are FIXED in `contracts/src` + covered by Foundry tests on `main`, but are
NOT yet deployed: the live testnet stays on the current verified contracts and these land at the
mainnet redeploy. (Source-only; no testnet redeploy was performed.)

1. **ForeverLibrary — storage-fee overpayment refund (Med).** `mint`/`mintEdition` previously
   forwarded the ENTIRE `msg.value` to the treasury on the fee-exempt path, so an artist who
   overpaid lost the excess. Now they forward exactly `storageFeeWei` to the treasury and refund
   `msg.value - storageFeeWei` to the payer (`_settleStorageFee`, CEI + `nonReentrant`).
   `HostingConfigured.storagePaidWei` now reports the actual fee charged, not `msg.value`.
   Tests: `test_MintRefundsStorageOverpay`, `test_MintEditionRefundsStorageOverpay`,
   `test_MintExactFeeNoRefund`, plus the updated `test_HostingConfiguredReportsStoragePaid`.
2. **ForeverLibrary — mint royalty bounded to 10% (Low).** Royalty is capped at mint to
   `MAX_ROYALTY_BPS = 1000` (10%), matching the Settlement payout clamp, reverting `RoyaltyTooHigh`
   above it (previously only bounded to 100% via `_feeDenominator`). Tests:
   `test_MintRejectsRoyaltyAboveCap`, `test_MintAcceptsRoyaltyAtCap`,
   `test_MintEditionRejectsRoyaltyAboveCap`. **Frontend follow-up (other agent):** the royalty
   input should also cap at 10% so users don't hit a revert.
3. **ForeverLibrary — free-text metadata length caps (Low DoS).** `artistName ≤ 64`,
   `title ≤ 128`, `mediaType ≤ 64` bytes (reverts `MetadataTooLong`), so the per-view-call
   base64+escape in `tokenURI`/`contractURI` can't be gas-bricked. Tests:
   `test_MintRejectsTooLong{Title,ArtistName,MediaType}`, `test_MintAcceptsMetadataAtCaps`,
   `test_MintEditionRejectsTooLongTitle`.
4. **PerpetualSettlement — hosting fee clamped (Med).** `hostingFee` read from the NFT is now
   clamped to `MAX_HOSTING_FEE_BPS = 150` (1.5%, mirroring ForeverLibrary), so a hostile/buggy
   NFT reporting a huge `hostingFeeBps()` can no longer brick every sale (`RoyaltyExceedsPrice`).
   Mirrors the existing royalty clamp. Test: `test_HostileHostingFeeClampedToMax`.
5. **PerpetualDrop — no-burn enforced in code (mainnet landmine).** `_update` now reverts
   `BurnNotSupported` when `to == address(0)`, so a future burn path can't silently resurrect
   tokens through the manual ERC-2309 `_ownerOf` (which has no burn bitmap). Mints and ordinary
   transfers are unaffected. Tests: `test_BurnViaUpdateRevertsBurnNotSupported`,
   `test_MintAndTransferStillWorkWithBurnGuard`, plus the existing `test_NoBurnEntrypoint`.
6. **PerpetualDrop — contractURI escapes baseURI (Low).** `_baseTokenURI` is now wrapped in
   `LibString.escapeJSON` in `contractURI` so a `"` in an owner-set URI can't break the JSON.
   Test: `test_ContractURIEscapesBaseURI`.
7. **PerpetualDrop — multi-recipient batch coverage.** Added `test_MintBatchMultipleRecipients`:
   interleaved batches to two recipients (Alice 1..5, Bob 6..10) resolve `ownerOf`/`balanceOf`
   correctly across both anchor ranges, including after a cross-range transfer.

## Deferred — formal PRE-MAINNET batch (redeploy / frontend-coupled, do next by priority)
These three are NOT yet implemented in source: each changes the order struct / relayer / resolver
or otherwise couples to the frontend + a redeploy, so they are batched for the pre-mainnet work.
1. **Settlement — seller-signed fee bound (HIGH).** The seller currently signs no fee/royalty
   acknowledgment; protocol fee + NFT hosting fee are read live at fill. Add `minSellerProceeds`
   (or a full fee schedule) to the EIP-712 `Order` struct and enforce it on fill. Touches the
   order struct + frontend signing (`TradePanel`) + `/api/orders` validation. `// AUDIT:` TODO is
   in `PerpetualSettlement.fulfillOrder`. (Order struct deliberately left UNCHANGED in this batch.)
2. **Settlement — escrow rescue escape hatch (MED).** Add a `withdrawTo`/owner-rescue path for
   escrow (`withdrawable`) that can never otherwise be claimed (e.g. a recipient that can neither
   receive a push nor call `withdraw`). Money-contract change; pairs with the UUPS-proxy decision.
3. **LogLedger — fileId author-binding + root integrity (MED).** `open` is first-come on a
   predictable `fileId` (squattable); the sealed Merkle root is author-asserted, not validated
   against uploaded chunks. Bind storage to `(author, fileId)` (or `fileId = keccak(msg.sender,…)`)
   and/or accumulate a chunk hash on-chain to validate the root at `seal`. Changes the relayer's
   fileId computation + the LOG resolver — coordinate together. `// AUDIT:` TODOs are in
   `LogLedger.open`/`seal`. (LogLedger logic deliberately left UNCHANGED in this batch.)

## ERC-2309 indexer caveat (informational)
Post-construction batch mint emits only `ConsecutiveTransfer` (no per-token `Transfer`). OpenSea
supports it; verify each target marketplace/indexer before relying on it, and keep batches ≤5000
(enforced).

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
