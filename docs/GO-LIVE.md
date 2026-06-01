# Perpetual - Go-Live Checklist

The complete set of objectives to take Perpetual from the current state — mint pipeline,
on-chain read layer, lite indexer, and fixed-price ETH trading all live on testnet — to a
fully live marketplace with real wallet integration, a DB-backed indexer, and mainnet contracts.

**What's already live (testnet):** ForeverLibrary (SSTORE2 STATE shard + Log enum + `mintEdition`), ForeverLibraryFactory (`createCollection` → sovereign FL per artist, factory-enumerated), LogLedger,
and PerpetualSettlement are deployed to Base Sepolia + Ethereum Sepolia. The mint pipeline
(direct-to-Vercel-Blob uploads → IPFS/Arweave/Irys pinning → relayer LOG shard → on-chain
SSTORE2 STATE shard) is verified end-to-end. A Merkle-verifying LOG resolver
(`/api/shard/log/[ledger]/[fileId]`) reconstructs and serves the LOG shard from chain events.
Collections are sovereign contracts; editions share one STATE/LOG/off-chain copy across N tokens.

**Also live (testnet):** the on-chain read layer (`/token/onchain/[chainId]/[contract]/[tokenId]` and per-collection `/collections/onchain/[chainId]/[contract]` — real
shards, LOG resolver, provenance, permanence panel; profile owned-list via `/api/onchain/owned`),
a lite indexer (explore/collections surface real `TokenMinted` tokens across all factory-discovered collections merged with the demo
gallery; `/api/indexer/tokens`), and fixed-price ETH trading (EIP-712 signed listings stored in
Blob orderbook, on-chain fulfillment via PerpetualSettlement; `/api/orders`).

**What's still needed:** the remaining hard blockers are the security audit (required before
mainnet value), a DB-backed indexer to replace the lite Blob cache, and real wallet integration.
The frontend (14) is largely a matter of swapping `src/lib/wallet.ts` and the lite API routes
for fully live services: the hooks, types, and API shapes were built as the integration seams,
so almost no component rewrites are needed.

---

## 1. Strategy, legal & compliance
- [ ] Finalize v1 chain scope (which of the 9 chains are trade-enabled vs read-only indexed at launch).
- [ ] Confirm the protocol fee rate (currently 2.25% / `PROTOCOL_FEE_BPS=225`) and fee-recipient wallet/treasury.
- [ ] Legal review of "permanence/forever" marketing claims; scope claims precisely to what the architecture guarantees (PRD 17.6).
- [ ] Terms of Service, Privacy Policy, cookie/consent notice, DMCA/takedown + stolen-art policy, prohibited-content policy.
- [ ] Entity formation, tax treatment of protocol fees, sanctions/OFAC screening, and whether KYC is required for any fiat on-ramp.
- [ ] Creator/royalty policy and dispute process; copyright/IP attestation at mint.

## 2. Accounts, services & secrets
- [ ] RPC provider (Alchemy/Infura/QuickNode) keys for every chain (`NEXT_PUBLIC_RPC_*`).
- [ ] Reown/WalletConnect project ID (`NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`).
- [ ] Storage: Pinata/web3.storage (IPFS), Arweave wallet JWK, Irys key.
- [ ] Block explorers (Etherscan/Basescan/etc.) API keys for contract verification.
- [ ] Database (Postgres) + Redis hosts; a secrets manager (never commit `.env.local`; only `.env.example` is in git).
- [ ] Error tracking (Sentry), analytics, email (Resend), uptime monitoring accounts.

## 3. Smart contracts - Asset & Provenance (Forever Library)
- [x] `contracts/ForeverLibrary.sol`: ERC-721 + ERC-2981, URI sharding, `shard0Configured`, `selectedShardIndex`, `isLocked`, `getMintData`, edit windows then immutability, lock, reentrancy guards, `mintEdition` (N ERC-721 tokens sharing one STATE/LOG/off-chain copy) — **deployed to Base Sepolia + Ethereum Sepolia**.
- [x] **SSTORE2 STATE shard** (Shard 0): low-res canonical image (image downscale / video poster / SVG cover-card, ≤24 KB) stored as contract bytecode via SSTORE2. Content hash computed on-chain. Mandatory at mint. For editions, one pointer shared across all N tokens.
- [x] **LogLedger contract**: full-res media in event logs (~8 gas/byte); Merkle root + size in state; relayer pipeline open → upload → seal — **deployed and live**. For editions, one LOG file shared across N tokens.
- [x] On-mint immutable provenance + content-hash anchoring + `TokenMinted`/`ShardConfigured`/`ShardsLocked` events.
- [x] **ForeverLibraryFactory**: `createCollection(name, symbol, editWindow)` deploys an artist-owned `ForeverLibrary`, emits `CollectionCreated`, enumerates via `collectionsCount`/`collectionAt` — **deployed to Base Sepolia + Ethereum Sepolia**. Sovereign-contract registry fulfilled by factory discovery (PRD 7.5, 17.5).
- [x] Gas-cost validation for full vs low-res onchain proof: STATE shard uses ≤24 KB image downscale / video poster / SVG cover-card (PRD 17.2).

## 4. Smart contracts - Settlement
- [ ] Decide fork Seaport vs canonical Seaport integration (forking increases audit burden, PRD 17.4).
- [x] `contracts/PerpetualSettlement.sol`: EIP-712 hashing, signature verification, nonce/counter cancellation, **fixed-price ETH listings live on testnet** — deployed and fulfilling orders.
- [ ] NFT-for-NFT + criteria barter orders (Seaport-native) for the swap feature.
- [x] Mandatory ERC-2981 royalty enforcement at settlement (reject trades that evade royalties) — live on testnet.
- [x] Protocol fee collection; non-custodial peer-to-peer transfers; reentrancy/replay protection — live on testnet.

## 5. Smart contracts - Cross-chain bridge
- [ ] Escrow-bridge contracts per chain (lock on A, release on B, rollback on failure).
- [ ] Relayer/oracle service for cross-chain proofs; bridge-fee logic (`BRIDGE_FEE_ETH`).
- [ ] Atomicity/timeout/refund guarantees + adversarial testing.

## 6. Smart contracts - testing, audit, deployment
- [x] Foundry unit suite (15 passing tests across ForeverLibrary + PerpetualSettlement).
- [x] Testnet deploys (Base Sepolia, Ethereum Sepolia) + end-to-end verification on live site.
- [ ] Independent security audit(s) of settlement, bridge, and ForeverLibrary (mandatory before mainnet value, PRD 12). **UNAUDITED — do not hold mainnet value.**
- [ ] Bug-bounty program; formal verification of royalty/permanence invariants if feasible.
- [ ] Mainnet deploys per chain; verify source on explorers; record addresses in env.
- [ ] Upgradeability/admin-key strategy (multisig, timelocks) + ownership transfer plan.

## 7. Multi-chain infrastructure
- [ ] EVM chains: RPCs, gas estimation, chain-switching UX, per-chain contract addresses.
- [ ] Non-EVM ecosystems (if in scope): Solana (Metaplex, Phantom), Tezos (FA2, Beacon, objkt/fxhash patterns), Flow (Cadence, FCL, Dapper) - each needs its own indexing, wallet adapter, and (if trading) settlement layer.
- [ ] Per-chain native currency handling + USD conversion feeds (Coingecko/Chainlink).
- [ ] Honest per-chain permanence story (Forever Library is EVM-only; document how non-EVM permanence is represented).

## 8. Wallet connect & signing (replace `src/lib/wallet.ts`)
- [ ] Integrate wagmi + viem + Reown AppKit (or RainbowKit); keep the existing `useWallet()` hook surface so components do not change.
- [ ] Multi-chain connectors, network switching, account/disconnect, session persistence, mobile deep-links.
- [ ] EIP-712 typed-data signing for listings/offers/swaps/cancellations; tx submission + status toasts for buys/mints/bridge.
- [ ] SIWE session for authenticated API calls (watchlists, profiles) if needed.
- [ ] Non-EVM wallet adapters (if trading those chains).

## 9. Indexer (replace read accessors in `src/lib/mock-data.ts`)
- [x] **Lite indexer live on testnet**: `TokenMinted` event scan across all factory-discovered collections → Blob cache → `/api/indexer/tokens`; explore and collections surface real on-chain tokens merged with the demo gallery; live tiles tagged "on-chain". Catalog text-search still covers the mock index only.
- [ ] Per-chain event ingestion (mint, shard config, transfers, settlement, swaps) into Postgres (full DB-backed indexer — replaces lite Blob cache).
- [ ] Implement the published schema + REST endpoints from `docs/INDEXER_SPEC.md` (`/v1/tokens`, `/v1/collections`, `/v1/orders`, `/v1/swaps`, `/v1/search`, `/v1/featured`, rankings/stats).
- [ ] Reorg/finality handling, backfill from contract genesis, idempotent re-indexing.
- [ ] Rankings/trending aggregation (volume, floor, percent-change windows), owners/holders, sales history.
- [ ] Real full-text + trait search backend (Postgres FTS / Typesense / Algolia — replaces mock-only text search).
- [ ] Rebuildability: publish the spec and make it runnable by third parties (the architectural invariant).
- [ ] Caching (Redis), pagination, rate limits, API keys.

## 10. Orderbook service
- [x] **Fixed-price ETH listings live on testnet**: EIP-712 signed orders stored in Blob orderbook; on-chain fulfillment via PerpetualSettlement; List/Buy UI on live token pages (`/api/orders`). Works across all collection contracts.
- [ ] Offers, NFT-for-NFT token swaps, criteria swaps — remaining order types.
- [ ] Signature + balance/approval validation; expiry; nonce/counter cancellation sync (full production hardening).
- [ ] Listing-eligibility gate (shard0 configured + content-hash match + recognized Forever Library contract).
- [ ] Collection/trait offer matching; criteria-swap matching.
- [ ] Order GC/cleanup; fill detection from on-chain events.

## 11. Storage layer + mint pipeline (five shards)
- [x] **Mint pipeline live on testnet**: direct-to-Vercel-Blob upload (up to ~100 MB, past the old ~4.5 MB serverless cap) → IPFS/Arweave/Irys pinning in parallel → relayer publishes LOG shard to LogLedger (open → upload → seal) → client generates ≤24 KB STATE proof image → mint writes SSTORE2 STATE shard + shard descriptors on-chain.
- [x] Compute + anchor content hashes on-chain; Merkle root stored in LogLedger state.
- [x] LOG resolver (`/api/shard/log/[ledger]/[fileId]`): paginated getLogs, multi-RPC Merkle root agreement, cache to Blob, serve via CDN. Clients verify root from chain state.
- [x] IPFS pinning (Pinata) + Arweave + Irys (backstopped by STATE shard, PRD 13.3).
- [ ] Real estimated costs surfaced in the mint UI.
- [ ] Large-file handling for video/interactive media: video poster as STATE image, full video in LOG/off-chain.
- [ ] Content scanning for prohibited content at upload time.
- [ ] Replace generative-SVG placeholders with real media rendering from resolved URIs (keep generative as fallback).

## 12. Permanence verification service (PRD 9.4)
- [ ] Read-only service that resolves each shard, hashes the bytes, compares to the on-chain record, flags failures.
- [ ] Continuous re-verification schedule + per-token permanence status API.
- [ ] Feed live data into the Permanence Status panel, Permanence Score, Permanence Report, and Vanish Test (currently mock-evaluated).
- [ ] Independent/reproducible data paths so claims cannot be operator-spoofed (PRD 12).
- [ ] 100%-integrity health metric + alerting on any unresolved shard (PRD 16).

## 13. Identity & ENS
- [ ] Replace mock `resolveEns()` with real ENS resolution (viem `getEnsName`/`getEnsAvatar`) + reverse records + caching.
- [ ] ENS avatars in profiles; fallback identicons; primary-name preference.
- [ ] (Optional) other name services per chain (SNS, .tez, Flow domains).

## 14. Frontend live-integration
- [ ] Swap every `mock-data.ts` accessor for real API calls (signatures map 1:1).
- [ ] Real wallet/session state, optimistic UI for trades, real tx/confirmation flows, error/empty/loading states under real latency.
- [ ] Real-time updates (websockets/polling) for new listings, sales, offers, swap status, bridge progress.
- [ ] Real Certificate-of-Permanence data; real activity feeds; real owner/holder lists.
- [ ] Remove/relabel any "simulated/mock" copy.

## 15. Search & discovery
- [ ] Real full-text + trait search backend (Postgres FTS / Typesense / Elasticsearch / Algolia).
- [ ] Trait/rarity computation, genre classification, collection verification workflow.
- [ ] Trending/featured algorithms; spam/scam-collection filtering + real verification badges.

## 16. Community curation (PRD 11 - Phase 2)
- [ ] One-vote-per-qualifying-wallet featured voting; per-genre rotations.
- [ ] Sybil resistance: onchain-history cutoff + must own/mint, Gitcoin-Passport-style identity score threshold, optional refundable stake-to-vote.
- [ ] Secondary-wallet cluster flagging (review, not auto-reject); no biometrics.

## 17. Payments, fees, treasury, fiat
- [ ] Treasury wallet/multisig for protocol fees; accounting + payout flows.
- [ ] USD price displays via oracle/feed.
- [ ] (v2) Fiat on-ramp (Stripe Crypto/MoonPay), card purchase, gas sponsorship/account abstraction if desired.
- [ ] Premium tiers (verified artist profiles, analytics) if monetizing (PRD 13.1).

## 18. Security & trust
- [ ] Secrets management (host env / vault); no secrets in client bundles; key rotation.
- [ ] Phishing/wallet-drain warnings, signing-request transparency, approval-scope warnings (PRD 12).
- [ ] API auth, rate limiting, CORS, input validation, bot protection (Turnstile/hCaptcha on writes).
- [ ] CSP/security headers, dependency scanning, SSRF protection on gateway fetches.
- [ ] Incident-response plan; pause/kill-switch posture that does not violate the operator-independence invariant.

## 19. Backend infra & DevOps
- [ ] Host indexer/orderbook/verifier/relayer (containers/k8s/serverless) + Postgres + Redis with backups.
- [ ] CI/CD for contracts (test -> audit gate -> deploy) and app (lint/test/build -> deploy).
- [ ] Staging environment mirroring prod (testnet); DB migrations; infra-as-code.
- [ ] Job scheduling for verification/reindex; queue for mint/storage tasks.

## 20. Observability
- [ ] Error tracking (Sentry) front + back; structured logging; tracing.
- [ ] Dashboards: indexer lag, RPC health, verification pass rate, order/fill rates, GMV, royalties paid (PRD 16 metrics).
- [ ] Alerting (uptime, failed shards, stuck bridge, fee anomalies); on-call.
- [ ] Analytics + conversion funnels (permanence-panel-view -> purchase, PRD 16).

## 21. Performance, SEO, accessibility
- [ ] Real image/media optimization + CDN; cache strategy; Core Web Vitals.
- [ ] Dynamic metadata/OG images per token/collection; sitemap, robots, structured data.
- [ ] Re-run the accessibility audit against live data; keyboard/screen-reader pass on real flows.
- [ ] Load/scale testing of API + frontend.

## 22. Testing & QA
- [ ] Contract tests (Phase 6) + integration tests of API to chain.
- [ ] Frontend e2e (Playwright) across mint/list/buy/offer/swap/criteria-swap/cross-chain/verify on testnet with real wallets.
- [ ] Reorg, expiry, cancellation, failed-tx, insufficient-funds, wrong-network edge cases.
- [ ] Cross-browser + mobile-device testing; reduced-motion; localization if needed.

## 23. Data seeding & artist onboarding
- [ ] Onboard 20-50 launch artists; real collections + media minted with full multi-shard config (PRD 15 target).
- [ ] Migrate/replace all mock collections, artists, tokens, swaps with real data.
- [ ] Curated launch featured set; collection verification.

## 24. Domain, hosting, email
- [ ] Point `perpetual.art` DNS to Vercel; SSL; set `NEXT_PUBLIC_SITE_URL`.
- [ ] Restrict Vercel deployment protection to previews only (prod public).
- [ ] Transactional email (mint confirmations, sale alerts) + notifications/watchlists if offered.
- [ ] (Optional, Phase 2) IPFS/ENS-hosted frontend mirror as censorship insurance (PRD 10.5).

## 25. Docs, support & launch ops
- [ ] Keep `/docs`, README, `docs/ARCHITECTURE.md`, `docs/INDEXER_SPEC.md`, and `contracts/` current with live behavior.
- [ ] Publish the indexer spec + an alternative-client toolkit (PRD 15 Phase 3).
- [ ] Support channels (Discord/help desk), status page, FAQ.
- [ ] Launch runbook, rollback plan, post-launch monitoring window, and a 30/60/90 roadmap (auctions, curation, sovereign-deploy UI, more chains).

---

## Leanest path to "live with real data"

**Mint + storage, collections (sovereign contracts via ForeverLibraryFactory), editions (shared-storage N-of-N), on-chain read layer, lite indexer, and fixed-price ETH trading are already
live on testnet.** The remaining path to a mainnet v1:
**6 (audit + mainnet deploy) -> 8 (wallet/signing) -> 9 (DB-backed indexer) ->
12 (live verification service)** on Ethereum + Base, same-chain trading only. Multi-chain
breadth, cross-chain swaps, offers/auctions/barter, and non-EVM ecosystems are then additive.
