# Perpetual - Published Indexer Specification (v1)

> **Why this document exists.** The Perpetual indexer is centralized for performance,
> but it is **rebuildable from public data alone** (PRD §9.3). This spec is published so
> any third party can stand up an equivalent indexer with zero cooperation from the
> operator. That property is what preserves the architectural invariant (PRD §6.1, §18):
> if the operator vanishes, anyone can re-index the public contracts and storage networks
> and rebuild a marketplace.
>
> **No proprietary data is required to reconstruct the index.** Everything below is derived
> from (a) on-chain events/state on Ethereum mainnet + Base, and (b) public content-storage
> networks (ethfs, IPFS, Arweave, Irys).

---

## 1. Data sources (all public)

| Source | What is read | Used for |
|---|---|---|
| Forever Library contracts (native + registered sovereign) | `TokenMinted`, `ShardConfigured`, `ShardsLocked`, `Transfer` events; `getMintData`, shard accessors, `tokenURI`, `royaltyInfo` | Token catalog, provenance, royalties, shard map |
| Settlement contract (`PerpetualSettlement`) | `OrderFulfilled`, `OrderCancelled`, `CounterIncremented` events | Sales history, listing/offer invalidation |
| Orderbook (operator DB, signature store) | Signed Seaport orders (off-chain, but each is independently valid on-chain) | Active listings & offers |
| ethfs / IPFS / Arweave / Irys gateways | Raw shard content | Permanence verification, media resolution |

> The orderbook is the only operator-held data, and it holds **only signed messages that are
> already valid on-chain**. A sophisticated user can fill any order directly against the
> settlement contract without the orderbook (PRD §9.2).

---

## 2. Core entities

### 2.1 Contract registry
```jsonc
{
  "address": "0x…",            // Forever Library instance
  "kind": "native | sovereign",
  "chain": "ethereum | base",
  "registeredAtBlock": 21000000,
  "verified": true,            // passed Forever Library compatibility check (PRD §17.5)
  "owner": "0x…"               // artist owns sovereign contracts outright (PRD §7.5)
}
```

### 2.2 Token
```jsonc
{
  "id": "<contract>-<tokenId>",   // canonical, route-safe (no ':' - Windows/static-export safe)
  "contract": "0x…",
  "tokenId": 1,
  "chain": "ethereum | base",
  "creator": "0x…",
  "owner": "0x…",                 // from latest Transfer
  "title": "Strata No. 1",
  "artistName": "Claude Wren",
  "mediaType": "image | video | interactive",
  "royaltyBps": 750,              // ERC-2981, enforced at settlement (PRD §8.2)
  "metadataHash": "0x…",          // recorded on-chain at mint (PRD §7.4)
  "mintedAtBlock": 21010000,
  "mintedAt": "2025-08-02T…Z",
  "selectedShardIndex": 2,        // selectedShardIndex(tokenId) (PRD §7.3)
  "locked": true                  // isLocked(tokenId)
}
```

### 2.3 Shard (one row per token per backend) - drives the Permanence Status panel (PRD §10.4)
```jsonc
{
  "tokenId": "<contract>-<tokenId>",
  "index": 0,
  "backend": "onchain | ipfs | arweave | irys | cdn",
  "locator": "ethfs:0x… | bafy… | <arweave-tx> | <irys-tx> | https://…",
  "contentHash": "0x…",           // hash recorded on-chain at config time
  "status": "verified | resolving | failed | not-configured",
  "bytes": 24576,
  "mandatory": true,              // index 0 (onchain proof) is mandatory (PRD §7.3)
  "lastChecked": "2026-05-30T…Z"
}
```

### 2.4 Provenance event
```jsonc
{ "tokenId": "<contract>-<tokenId>", "kind": "created|minted|listed|offer|sale|transfer",
  "blockNumber": 21500000, "txHash": "0x…", "from": "0x…", "to": "0x…", "priceEth": 1.8,
  "timestamp": "2026-04-12T…Z" }
```

### 2.5 Order (listing / offer) - signed Seaport order (PRD §9.2)
```jsonc
{ "orderId": "0x…", "type": "listing | offer", "scope": "token | collection | trait",
  "tokenId": "<contract>-<tokenId>", "priceEth": 1.8, "chain": "ethereum | base",
  "maker": "0x…", "expiresAt": "2026-06-20T…Z", "signature": "0x…",
  "onchainValid": true }            // fillable directly against settlement if orderbook is down
```

---

## 3. Permanence verification service (PRD §9.4)

A read-only, independently reproducible loop. For every (token, shard):

1. **Resolve** the shard locator against the appropriate public gateway.
2. **Hash** the returned bytes (keccak256).
3. **Compare** against `shard.contentHash` recorded on-chain at config time.
4. Set `status`:
   - `verified` - resolves AND hash matches.
   - `failed` - does not resolve or hash mismatch. **This is not an outage.** As long as
     shard 0 (onchain proof) is `verified`, the token remains 100% permanent - the lapsed
     shard is a performance copy, not a permanence obligation (PRD §13.3).
   - `resolving` - check in flight.
5. Aggregate to per-token **permanence integrity**. The primary marketplace health metric is
   *100% of listed tokens have a verified onchain proof shard with matching hash* (PRD §16).

The service uses only public data paths so its claims cannot be spoofed by the operator
(PRD §12). Each row in the UI links to the raw public source so collectors verify independently.

---

## 4. Listing-eligibility gate (PRD §9.6)

Before the orderbook accepts a signed listing, it MUST confirm:

1. `shard0Configured(tokenId) == true` (onchain proof exists).
2. The onchain proof shard's content hash matches the on-chain mint record.
3. The token's contract is a **recognized** Forever Library instance (native or registered
   sovereign).

Tokens failing the gate are not listable; the UI explains why and how to add an onchain proof
shard.

---

## 5. Reorg & finality handling

- Treat events as confirmed after N confirmations (mainnet ≥ 12, Base per its finality).
- On reorg, roll back affected provenance/order rows to the last finalized block and re-derive.
- Shard verification is idempotent and re-runs on a schedule independent of chain state.

---

## 6. Reference REST shape (what the frontend consumes)

```
GET /v1/tokens?genre=&chain=&listed=&locked=&sort=          -> Token[]      (Explore)
GET /v1/tokens/:id                                          -> Token        (Token page)
GET /v1/tokens/:id/permanence                               -> Shard[]+agg  (Permanence panel)
GET /v1/tokens/:id/provenance                               -> Event[]
GET /v1/collections                                         -> Collection[]
GET /v1/collections/:slug                                   -> Collection
GET /v1/collections/:slug/tokens                            -> Token[]
GET /v1/orders?tokenId=&type=                               -> Order[]
GET /v1/search?q=                                           -> Token[]      (full-text + trait)
GET /v1/featured                                            -> FeaturedEntry[] (community vote, PRD §11)
```

In this build, `src/lib/mock-data.ts` implements exactly these shapes in-memory so the
frontend is fully functional offline; swapping it for a live indexer that emits this schema
requires no frontend changes.
