# Listing Eligibility Gate - Spec (PRD §9.6)

> **⚠️ Part of the UNAUDITED Perpetual reference scaffold - not for production
> use before audit.**

The listing-eligibility gate is what guarantees that **only permanence-complete
tokens can be listed** on Perpetual. It is the off-chain orderbook's enforcement
of the on-chain permanence invariant (PRD §6, §18). Because the gate reads
exclusively from public on-chain data, any third party can reproduce it - the
gate does not depend on operator-proprietary state (PRD §9.3 rebuildability).

---

## The three conditions (all must hold)

A token is eligible to be listed **only if all three** of the following are true
(PRD §9.6):

1. **On-chain proof exists.**
   `IForeverLibrary(contract).shard0Configured(tokenId) == true`.
   Shard 0 is the mandatory ethfs on-chain proof - the permanence backstop
   (PRD §7.2, §7.3).

2. **Proof content hash matches the mint record.**
   The content hash recorded for Shard 0,
   `shardContentHash(tokenId, 0)`, must match the canonical hash anchored in the
   token's immutable mint record, `getMintData(tokenId).metadataHash` (or the
   proof-specific hash carried alongside it). This proves the on-chain proof
   shard is the genuine artwork the token was minted with, not a swapped
   placeholder (PRD §7.3 content hashing, §7.4 provenance).

3. **Recognized Forever Library instance.**
   The `contract` address must be a recognized Forever Library instance -
   either the native marketplace contract or a **registered sovereign** contract
   (PRD §7.5 sovereign contracts, §9.6, §17.5 sovereign verification). The
   registry confirms the contract genuinely implements the
   `IForeverLibrary` surface (e.g. via ERC-165 `supportsInterface` and the
   registration path) so its `shard0Configured` answer can be trusted.

Tokens failing any condition are **not listable**. The UI explains why and how
to add an on-chain proof shard (PRD §9.6).

---

## How the orderbook enforces it (off-chain, before accepting a signed listing)

Listings are gasless: the seller signs a Seaport-compatible order (EIP-712) and
submits it to the centralized orderbook (PRD §8.1, §9.2). Before the orderbook
**accepts and publishes** that signed order, it runs the gate:

```
on receive signed listing (order, contractAddr, tokenId):
    # 1. recognized Forever Library instance?
    if not registry.isRecognizedForeverLibrary(contractAddr):
        reject("contract is not a recognized Forever Library instance")    # cond 3

    fl = IForeverLibrary(contractAddr)

    # 2. mandatory on-chain proof present?
    if not fl.shard0Configured(tokenId):
        reject("missing mandatory on-chain proof shard - add Shard 0 to list")  # cond 1

    # 3. proof content hash matches the mint record?
    onchainProofHash = fl.shardContentHash(tokenId, 0)
    mintRecordHash   = fl.getMintData(tokenId).metadataHash   # canonical anchor
    if onchainProofHash != expectedProofHash(mintRecordHash):
        reject("on-chain proof hash does not match mint record")           # cond 2

    # 4. standard order validity (signature, counter, ownership, window)
    if not verifyEIP712(order):           reject("bad signature")
    if order.counter != settlement.getCounter(order.offerer):
                                          reject("stale counter")
    if fl.ownerOf(tokenId) != order.offerer:
                                          reject("offerer does not own token")

    accept_and_publish(order)
```

Notes:

- The gate is **advisory at the orderbook layer** but backed by **hard on-chain
  guarantees** at settlement: even if a malformed listing slipped through, the
  on-chain `PerpetualSettlement.fulfillOrder` independently enforces royalties
  (PRD §8.2) and a restricted order's zone can re-check eligibility (PRD §9.6).
  A sophisticated user can also fill a valid order directly against the
  settlement contract if the orderbook is down (PRD §9.2) - the assets and
  guarantees never depend on the orderbook's availability.
- The gate reads only public on-chain values (`shard0Configured`,
  `shardContentHash`, `getMintData`) plus the public registry. This preserves
  the architectural invariant: any third party can run the identical gate and
  rebuild an equivalent orderbook (PRD §9.3, §18).
- The registry of "recognized Forever Library instances" is the one piece of
  curated state; its rules (ERC-165 interface check + sovereign registration)
  are published so the recognition decision is reproducible (PRD §17.5).
