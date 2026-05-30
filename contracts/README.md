# Perpetual - On-Chain Layer (Reference Scaffold)

> **⚠️ UNAUDITED SCAFFOLD - DO NOT DEPLOY WITH VALUE BEFORE AUDIT.**
> Every `.sol` file here is a reference scaffold expressing the contract
> architecture from the PRD. It has **not** been audited and **must not** hold
> mainnet value until a full security audit is complete (PRD §12). Deep
> encoding details (ethfs persistence, full EIP-712 array hashing, conduit
> transfers) are intentionally stubbed with `// ...` and marked as such.

**Brand:** Perpetual (formerly working title "Vellum"). A permanence-first NFT
marketplace built on a single non-negotiable guarantee: *the artwork is
permanent and provable, independent of the marketplace operator* (PRD §1).

---

## The four-layer model - only two layers are on-chain

The system is four layers (PRD §6). Only the bottom two are on-chain and
operator-independent; the top two are conventional and optimized for speed.

| Layer | On-chain? | Lives here? | PRD |
|---|---|---|---|
| **Asset & Provenance** | ✅ On-chain | ✅ `ForeverLibrary.sol` | §7 |
| **Settlement** | ✅ On-chain | ✅ `PerpetualSettlement.sol` | §8 |
| Orderbook & Indexer | ❌ Centralized | ❌ (off-chain services) | §9 |
| Frontend / Client | ❌ Centralized | ❌ (web app) | §10 |

**Architectural invariant (PRD §18):** if the operator vanishes, every NFT
remains - owned by the correct wallet, resolving to its artwork through the
on-chain proof shard, with full provenance. A third party can index the public
contracts and stand up a replacement marketplace with zero cooperation from the
operator. Everything in this directory is designed to uphold that invariant.

---

## File index

| File | What it is | PRD |
|---|---|---|
| `interfaces/IForeverLibrary.sol` | Interface for the Forever Library token: ERC-721 + ERC-2981 with the URI-sharding surface the frontend/indexer depend on (mandatory on-chain proof gate, selected shard, lock state, shard accessors, mint/provenance record, events, `ShardBackend` enum). | §7 |
| `interfaces/IPerpetualSettlement.sol` | Seaport-compatible settlement interface: signed-order structs, `fulfillOrder`, `cancel`, `getOrderStatus`, counter/nonce replay protection, and the documented ERC-2981 royalty-enforcement guarantee. | §8, §12 |
| `ForeverLibrary.sol` | Reference implementation sketch of `IForeverLibrary`. Immutable provenance on mint, per-token shard config with content-hash recording, **mandatory Shard 0 (ethfs) on-chain proof**, edit windows → immutability, lock, ERC-2981 `royaltyInfo`. Reentrancy-guarded. | §7 |
| `PerpetualSettlement.sol` | Reference implementation sketch of `IPerpetualSettlement`. EIP-712 order hashing, signature verification, nonce/counter cancellation, configurable protocol fee (2.0-2.5%, default 2.25% = 225 bps), and **mandatory ERC-2981 royalty payout enforced in `fulfillOrder`** (reverts if not honored). Non-custodial, reentrancy-guarded. | §8, §12 |
| `LISTING_ELIGIBILITY.md` | Spec of the PRD §9.6 listing-eligibility gate and how the centralized orderbook enforces it off-chain before accepting a signed listing. | §9.6 |
| `README.md` | This file. | §6, §18 |

---

## The two differentiating invariants (make these unmistakable)

1. **Mandatory on-chain proof (PRD §7.3, §9.6).** Shard 0 is an ethfs on-chain
   proof, written atomically at mint and immutable thereafter. No token can
   exist without it, and `shard0Configured(tokenId)` gates listing eligibility.
   It is the permanence backstop that survives as long as Ethereum (PRD §5.1).

2. **Protocol-level royalty enforcement (PRD §8.2).** `fulfillOrder` computes
   the token's ERC-2981 royalty from its own `royaltyInfo` at fill time and
   **reverts** if the order's consideration does not pay that exact royalty to
   the correct receiver. Royalties cannot be bypassed - a hard guarantee, not a
   UI suggestion, and a primary artist-acquisition lever (PRD §2.3, §3.1.3).

---

## How this maps to the PRD

- **PRD §7 - Asset & Provenance / Forever Library:** `IForeverLibrary.sol` +
  `ForeverLibrary.sol`. URI sharding (§7.2), required behaviors incl. mandatory
  on-chain proof, selected shard, locking, edit windows, content hashing
  (§7.3), provenance record (§7.4), sovereign deployment (§7.5, any artist may
  deploy their own instance).
- **PRD §8 - Settlement:** `IPerpetualSettlement.sol` +
  `PerpetualSettlement.sol`. Seaport-compatible signed orders (§8.1), royalty
  enforcement (§8.2), protocol fee 2.0-2.5% (§8.4).
- **PRD §9.6 - Listing eligibility:** `LISTING_ELIGIBILITY.md`, plus the
  on-chain `shard0Configured` gate read by the orderbook.
- **PRD §12 - Security:** royalty-bypass resistance, signature replay
  protection (counter/nonce), reentrancy guards on value-moving functions,
  non-custodial settlement.
- **PRD §18 - Architectural invariant:** all state is on-chain and
  independently readable; events are sufficient for a third party to rebuild
  the indexer.

---

## Assumptions & toolchain notes

- Imports use `@openzeppelin/contracts/...` paths and assume OpenZeppelin would
  be installed. No toolchain is included; these files are **not** compiled here.
- `SPDX-License-Identifier: MIT` and `pragma solidity ^0.8.24;` throughout.
- This scaffold is for review and audit preparation only.
