# Live Trading (PerpetualSettlement wiring) — Spec + Plan

> Autonomous build. Subagent-driven, reviewed, on-chain verified, deployed. Testnet + unaudited.

**Goal:** Real fixed-price trading on the deployed `PerpetualSettlement`: owners sign EIP-712 listings, anyone fulfills them on-chain (royalties + hosting fee enforced by the contract). Listings live in a Blob-backed orderbook (no DB).

**Contract facts (must match exactly):**
- `PerpetualSettlement` deployed: Base Sepolia `0xD2d3B1A12CB01f44AaFcD1eb17d86c3C31fE56b9`, Eth Sepolia `0x7Da4933d772815769b50914eBFfD47fe3c196A0B` (in `getContracts(chainId).settlement`).
- EIP-712 domain: `name="PerpetualSettlement"`, `version="1"`, `chainId`, `verifyingContract=<settlement>`.
- `Order` type: `seller address, nft address, tokenId uint256, paymentToken address, price uint256, startTime uint256, endTime uint256, counter uint256, salt uint256`. (ETH only → paymentToken = address(0).)
- `fulfillOrder(Order, bytes signature) payable` — send exactly `order.price`. `hashOrder(Order) view` → the EIP-712 digest (use to verify client encoding). `getCounter(seller) view`. Seller must `setApprovalForAll(settlement, true)` on the FL first.

**Decisions (autonomous):**
- **Orderbook = Vercel Blob** (no DB). `POST /api/orders` stores `{ order, signature, sellerSig fields, chainId, createdAt }` at `orders/<chainId>/<orderHash>.json` (orderHash from the contract or client-computed). `GET /api/orders?chainId=&nft=&tokenId=` lists matching open orders. On fulfill, the client calls `POST /api/orders/filled` (or we lazily verify on-chain `filled[hash]`); v1 marks filled by deleting/flagging the blob after a confirmed fill, and the token page also reads on-chain validity so a stale order can't mislead.
- **Approval:** the List flow checks `isApprovedForAll(owner, settlement)`; if false, prompts `setApprovalForAll` first.
- **UI lives on the live on-chain token page** (`/token/onchain/[chainId]/[tokenId]`): a TradePanel — owner sees "List for sale" (price → approve if needed → sign → POST); non-owner sees "Buy for X ETH" when an open listing exists (→ fulfillOrder with value=price). Show the active listing + price.

**Files:**
- `src/lib/web3/abis.ts` — add `SETTLEMENT_ABI` (fulfillOrder, hashOrder, getCounter, protocolFeeBps, OrderFulfilled event) + reuse FL `isApprovedForAll`/`setApprovalForAll` (add to FL ABI).
- `src/lib/web3/orders.ts` — types (`SignedOrder`), EIP-712 `ORDER_TYPES`/`buildOrderDomain`, pure `orderHashKey`. Server-side Blob store helpers (`putOrder`, `listOrders`, `markFilled`).
- `src/app/api/orders/route.ts` — POST (store, validate shape + recover signer == seller via viem `verifyTypedData`) + GET (list open orders for a token).
- `src/app/api/orders/filled/route.ts` — POST mark an order filled (after on-chain confirm) OR the GET filters by reading chain `filled` — pick the simpler robust path.
- `src/components/token/TradePanel.tsx` (client) — List (approve+sign+POST) / Buy (fulfill) using wagmi; shows the active listing.
- Wire `<TradePanel>` into `src/app/token/onchain/[chainId]/[tokenId]/page.tsx` (pass chainId, tokenId, nft, owner).
- Tests: `orders.test.ts` (pure: EIP-712 types/domain/hash key). Gated on-chain: sign an Order with the relayer (viem), assert client digest == contract `hashOrder`, `fulfillOrder` (relayer as buyer of own token — self-transfer, payments split) → `OrderFulfilled` emitted.

## Tasks
1. **ABIs** — add `SETTLEMENT_ABI` + FL `isApprovedForAll`/`setApprovalForAll`. tsc.
2. **`orders.ts`** — `ORDER_TYPES`, `buildOrderDomain(chainId, settlement)`, `SignedOrder` type, `orderStorageKey(chainId, hash)`; Blob `putOrder`/`listOpenOrders(chainId, nft, tokenId)`/`markFilled`. Pure parts unit-tested.
3. **`/api/orders`** — POST validate + `verifyTypedData` (signer == order.seller) + store; GET list open orders for `(chainId, nft, tokenId)`. `/api/orders/filled` POST to flag filled.
4. **On-chain test (gated)** — relayer signs an Order for a token it owns; assert `hashOrder` matches the locally computed EIP-712 digest; `setApprovalForAll`; `fulfillOrder{value:price}` as the same key; expect success + `OrderFulfilled`. (Proves encoding + the full settlement path.)
5. **TradePanel + token-page wiring** — List (approve→sign via wagmi `signTypedData` with ORDER_TYPES/domain→POST) / Buy (read open order from `/api/orders`→`fulfillOrder` value=price→mark filled). Owner-gated List; price display.
6. **Verify + deploy** — unit + gated on-chain pass; tsc + build clean; deploy; live-check the token page renders the TradePanel (List for owner, Buy when listed).

## Honest scope
Fixed-price ETH listings only (matches the contract's v1). No offers/auctions/barter/ERC-20 (contract follow-ups). Orderbook is Blob-backed (fine for testnet scale); a real orderbook service is a later hardening step. Testnet + unaudited — surfaced in the UI.
