# Multi-Contract Collections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the Perpetual read-layer and indexer so every ForeverLibrary contract (canonical + factory-deployed sovereign collections) is first-class; token IDs become `${chainId}-${contract}-${tokenId}`, and a new per-collection route `/collections/onchain/[chainId]/[contract]` is added.

**Architecture:** `read-token.ts` gains a `contract` param on all three public functions; `indexer.ts` gains `indexCollections` (factory `CollectionCreated` scan + canonical FL prepend) and `indexAllTokens`/`indexedCollections` iterate across all collections. A new token page route segment `[contract]` is inserted between `[chainId]` and `[tokenId]`; the old single-segment route directory is deleted. A new per-collection page `src/app/collections/onchain/[chainId]/[contract]/page.tsx` is added, and the collections browser links live collection cards to it.

**Tech Stack:** Next.js 16, React 19, TypeScript ES2017 (BigInt() constructor only, no BigInt literals), viem, wagmi, vitest.

---

## File Map

| File | Action | What changes |
|---|---|---|
| `src/lib/types.ts` | Modify | Add `editionSize?: number; editionIndex?: number` to `Token` |
| `src/lib/web3/read-token.ts` | Modify | Add `contract` param to all 3 public fns; update `mapMintToToken`; add `editionSize`/`editionIndex` reads; update id/collectionSlug; add optional `fromBlock` |
| `src/lib/web3/read-token.test.ts` | Modify | Update RAW fixture with `contract`; fix expected `id`; add editionSize/editionIndex assertions |
| `src/lib/web3/indexer.ts` | Modify | Add `FACTORY_DEPLOY_BLOCK`; add `indexCollections`; rewrite `indexAllTokens` / `indexedCollections` to enumerate all collections |
| `src/lib/web3/indexer.test.ts` | Modify | Add `indexCollections` shape smoke test; keep `mergeForExplore` tests |
| `src/app/token/onchain/[chainId]/[contract]/[tokenId]/page.tsx` | Create | New token page with contract param |
| `src/app/token/onchain/[chainId]/[tokenId]/` | Delete | Old single-segment route (remove whole directory) |
| `src/app/api/onchain/owned/route.ts` | Modify | Loop `indexCollections` → per-collection `readOwnedTokenIds`; include `contract` in items |
| `src/components/art/ArtTile.tsx` | Modify | Fix `tokenHref` to parse contract from `token.id` or `token.collectionSlug` |
| `src/components/mint/MintSuccess.tsx` | Modify | Update "View your token" link path; add canonical FL contract param |
| `src/components/profile/OwnedTab.tsx` | Modify | Fix `OnchainWorks` link to `/token/onchain/${it.chainId}/${it.contract}/${it.tokenId}` |
| `src/app/collections/onchain/[chainId]/[contract]/page.tsx` | Create | Per-collection RSC page |
| `src/components/collections/CollectionsBrowser.tsx` | Modify | Link live collection cards to `/collections/onchain/${chainId}/${slug}` |
| `src/app/collections/page.tsx` | Modify | Drop `liveSlugs` redirect to /explore; sovereign slugs now link to their page |

---

## Task 1: Extend Token type with edition fields

**Files:**
- Modify: `src/lib/types.ts:187-211`

- [ ] **Step 1: Add optional edition fields to Token**

Read the file first, then find the `Token` interface and add after `source?`:

```typescript
export interface Token {
  /** Composite id used in routes: `${chainId}-${contract}-${tokenId}`. */
  id: string;
  tokenId: number;
  title: string;
  collectionSlug: string;
  artistHandle: string;
  genre: Genre;
  mediaType: MediaType;
  artSeed: string;
  description: string;
  owner: string;
  traits: Trait[];
  royalty: RoyaltyConfig;
  permanence: PermanenceStatus;
  provenance: ProvenanceEvent[];
  listing?: Listing;
  offers: Offer[];
  chain: Chain;
  listable: boolean;
  source?: "onchain" | "mock";
  /** Edition info (only for tokens minted via mintEdition). */
  editionSize?: number;
  editionIndex?: number;
}
```

- [ ] **Step 2: Run tsc**

```
npx tsc --noEmit
```

Expected: 0 errors (no callers yet reference editionSize/editionIndex).

---

## Task 2: Refactor read-token.ts — contract-addressed

**Files:**
- Modify: `src/lib/web3/read-token.ts`

- [ ] **Step 1: Update RawTokenReads to include contract**

Find the `RawTokenReads` interface and add `contract: string`:

```typescript
export interface RawTokenReads {
  chainId: number; tokenId: bigint; contract: string; owner: string; mint: RawMint;
  locked: boolean; selectedShardIndex: bigint; hostingFeeBps: number;
  shards: RawShard[]; provenance: ProvenanceEvent[];
  editionSize?: number; editionIndex?: number;
}
```

- [ ] **Step 2: Update mapMintToToken**

Replace the `return { id: ..., tokenId: ..., collectionSlug: ..., ... }` block in `mapMintToToken`. The `id` becomes `${chainId}-${contract.toLowerCase()}-${tokenId}` and `collectionSlug` is the lowercased contract address:

```typescript
export function mapMintToToken(raw: RawTokenReads): Token {
  const contentHash = raw.mint.metadataHash;
  const contractLower = raw.contract.toLowerCase();
  const shards: StorageShard[] = raw.shards.map((s) => {
    const backend = BACKEND_BY_ENUM[s.backend] ?? "cdn";
    const guaranteed = backend === "onchain";
    return {
      index: s.index,
      backend,
      label: SHARD_LABEL[backend],
      status: "verified",
      detail:
        backend === "onchain" ? "in contract state · root matches"
        : backend === "log" ? "high-res · root matches · retention-monitored"
        : "recorded on-chain · hash recorded",
      sourceUrl: resolveShardUrl(s.uri, { chainId: raw.chainId, contentHash }),
      locator: s.uri,
      hashMatches: hasRecordedHash(s.contentHash),
      mandatory: s.index === 0,
      guaranteed,
    };
  });
  const stateShard = raw.shards.find((s) => s.index === 0);
  const stateHashOk = !!stateShard && hasRecordedHash(stateShard.contentHash);
  const permanence: PermanenceStatus = {
    onchainProofConfigured: shards.some((s) => s.index === 0 && s.backend === "onchain"),
    shards,
    contentHash,
    contentHashMatches: stateHashOk,
    locked: raw.locked,
    selectedShardIndex: Number(raw.selectedShardIndex),
    lastVerified: new Date().toISOString(),
  };
  return {
    id: `${raw.chainId}-${contractLower}-${raw.tokenId}`,
    tokenId: Number(raw.tokenId),
    title: raw.mint.title || `Token #${raw.tokenId}`,
    collectionSlug: contractLower,
    artistHandle: raw.mint.artistName || raw.mint.creator,
    genre: "Generative",
    mediaType: raw.mint.mediaType.startsWith("video/") ? "video" : raw.mint.mediaType === "text/html" ? "interactive" : "image",
    artSeed: `${raw.chainId}-${contractLower}-${raw.tokenId}`,
    description: "",
    owner: raw.owner,
    traits: [],
    royalty: { bps: Number(raw.mint.royaltyBps), receiver: raw.mint.creator },
    permanence,
    provenance: raw.provenance,
    listing: undefined,
    offers: [],
    chain: CHAIN_BY_ID[raw.chainId] ?? "base",
    listable: permanence.onchainProofConfigured && permanence.contentHashMatches,
    source: "onchain",
    editionSize: raw.editionSize,
    editionIndex: raw.editionIndex,
  };
}
```

- [ ] **Step 3: Add optional fromBlock param to readOnchainProvenance**

Change the signature to:

```typescript
export async function readOnchainProvenance(
  chainId: number,
  contract: Hex,
  tokenId: bigint,
  fromBlock?: bigint,
): Promise<ProvenanceEvent[]> {
  const pub = serverPublicClient(chainId);
  if (!pub) return [];
  const latest = await pub.getBlockNumber();
  const floor = fromBlock ?? scanStartBlock(chainId, latest);
  const raw: { from?: string; to?: string; blockNumber: bigint }[] = [];
  let from = floor;
  for (let w = 0; w < MAX_WINDOWS && from <= latest; w++) {
    const to = from + LOG_WINDOW - BigInt(1) > latest ? latest : from + LOG_WINDOW - BigInt(1);
    const logs = await pub.getLogs({ address: contract, event: TRANSFER_EVENT, args: { tokenId }, fromBlock: from, toBlock: to });
    for (const l of logs) raw.push({ from: l.args.from, to: l.args.to, blockNumber: l.blockNumber as bigint });
    from = to + BigInt(1);
  }
  const ts = new Map<string, string>();
  await Promise.all(
    [...new Set(raw.map((r) => r.blockNumber.toString()))].map(async (bn) => {
      try {
        const block = await pub.getBlock({ blockNumber: BigInt(bn) });
        ts.set(bn, new Date(Number(block.timestamp) * 1000).toISOString());
      } catch { /* leave unset */ }
    }),
  );
  return raw.map((r) => {
    const zero = r.from === "0x0000000000000000000000000000000000000000";
    return {
      kind: zero ? "minted" : "transfer",
      timestamp: ts.get(r.blockNumber.toString()) ?? new Date(0).toISOString(),
      from: r.from,
      to: r.to,
      blockNumber: Number(r.blockNumber),
    } as ProvenanceEvent;
  });
}
```

- [ ] **Step 4: Rewrite readOnchainToken with contract param + edition reads**

```typescript
export async function readOnchainToken(chainId: number, contract: Hex, tokenId: bigint): Promise<Token | null> {
  const pub = serverPublicClient(chainId);
  if (!pub) return null;
  let owner: string;
  try {
    owner = (await pub.readContract({ address: contract, abi: FOREVER_LIBRARY_ABI, functionName: "ownerOf", args: [tokenId] })) as string;
  } catch {
    return null;
  }
  const [mint, locked, selectedShardIndex, hostingFeeBps, editionSizeRaw, editionIndexRaw] = await Promise.all([
    pub.readContract({ address: contract, abi: FOREVER_LIBRARY_ABI, functionName: "getMintData", args: [tokenId] }),
    pub.readContract({ address: contract, abi: FOREVER_LIBRARY_ABI, functionName: "isLocked", args: [tokenId] }),
    pub.readContract({ address: contract, abi: FOREVER_LIBRARY_ABI, functionName: "selectedShardIndex", args: [tokenId] }),
    pub.readContract({ address: contract, abi: FOREVER_LIBRARY_ABI, functionName: "hostingFeeBps", args: [tokenId] }),
    pub.readContract({ address: contract, abi: FOREVER_LIBRARY_ABI, functionName: "editionSize", args: [tokenId] }).catch(() => BigInt(0)),
    pub.readContract({ address: contract, abi: FOREVER_LIBRARY_ABI, functionName: "editionIndex", args: [tokenId] }).catch(() => BigInt(0)),
  ]);
  const shards = await readShards(pub, contract, tokenId);
  const provenance = await readOnchainProvenance(chainId, contract, tokenId);
  const m = mint as RawMint;
  const es = Number(editionSizeRaw as bigint);
  const ei = Number(editionIndexRaw as bigint);
  return mapMintToToken({
    chainId, tokenId, contract, owner, mint: m, locked: locked as boolean,
    selectedShardIndex: selectedShardIndex as bigint, hostingFeeBps: Number(hostingFeeBps),
    shards, provenance,
    editionSize: es > 0 ? es : undefined,
    editionIndex: es > 0 ? ei : undefined,
  });
}
```

- [ ] **Step 5: Rewrite readOwnedTokenIds with contract + optional fromBlock param**

```typescript
export async function readOwnedTokenIds(
  chainId: number,
  contract: Hex,
  owner: string,
  fromBlock?: bigint,
): Promise<bigint[]> {
  const pub = serverPublicClient(chainId);
  if (!pub) return [];
  const latest = await pub.getBlockNumber();
  const seen = new Set<string>();
  let from = fromBlock ?? scanStartBlock(chainId, latest);
  for (let w = 0; w < MAX_WINDOWS && from <= latest; w++) {
    const to = from + LOG_WINDOW - BigInt(1) > latest ? latest : from + LOG_WINDOW - BigInt(1);
    const logs = await pub.getLogs({ address: contract, event: TRANSFER_EVENT, args: { to: owner as Hex }, fromBlock: from, toBlock: to });
    for (const l of logs) seen.add((l.args.tokenId as bigint).toString());
    from = to + BigInt(1);
  }
  const owned: bigint[] = [];
  for (const idStr of seen) {
    const id = BigInt(idStr);
    try {
      const cur = (await pub.readContract({ address: contract, abi: FOREVER_LIBRARY_ABI, functionName: "ownerOf", args: [id] })) as string;
      if (cur.toLowerCase() === owner.toLowerCase()) owned.push(id);
    } catch { /* burned/nonexistent */ }
  }
  return owned.sort((a, b) => (a < b ? -1 : 1));
}
```

- [ ] **Step 6: Run tsc**

```
npx tsc --noEmit
```

Expected: 0 errors.

---

## Task 3: Update read-token tests

**Files:**
- Modify: `src/lib/web3/read-token.test.ts`

- [ ] **Step 1: Add contract to RAW fixture and update assertions**

Replace the whole file:

```typescript
import { describe, it, expect } from "vitest";
import { mapMintToToken, type RawTokenReads } from "./read-token";

const CONTRACT = "0xDeAdBeEf00000000000000000000000000000001";
const CONTRACT_LOWER = CONTRACT.toLowerCase();

const RAW: RawTokenReads = {
  chainId: 84532,
  tokenId: BigInt(5),
  contract: CONTRACT,
  owner: "0x1804c8AB1F12E6bbf3894d4083f33e07309d1f38",
  mint: {
    creator: "0x1804c8AB1F12E6bbf3894d4083f33e07309d1f38",
    timestamp: BigInt(1748000000),
    blockNumber: BigInt(42220000),
    artistName: "Claude Wren",
    title: "Strata No. 1",
    mediaType: "image/svg+xml",
    royaltyBps: BigInt(750),
    metadataHash: "0xabc",
  },
  locked: true,
  selectedShardIndex: BigInt(1),
  hostingFeeBps: 0,
  shards: [
    { index: 0, backend: 0, uri: "data:image/svg+xml;base64,AAAA", contentHash: "0xstate" },
    { index: 1, backend: 5, uri: "log://0xLED/0xFID", contentHash: "0xroot" },
    { index: 2, backend: 1, uri: "ipfs://CID", contentHash: "0xc" },
  ],
  provenance: [
    { kind: "minted", timestamp: "2026-05-01T00:00:00.000Z", blockNumber: 42220000 },
  ],
};

describe("mapMintToToken", () => {
  it("maps real on-chain fields with contract-addressed id", () => {
    const t = mapMintToToken(RAW);
    expect(t.tokenId).toBe(5);
    expect(t.id).toBe(`84532-${CONTRACT_LOWER}-5`);
    expect(t.collectionSlug).toBe(CONTRACT_LOWER);
    expect(t.title).toBe("Strata No. 1");
    expect(t.owner).toBe(RAW.owner);
    expect(t.royalty.bps).toBe(750);
    expect(t.chain).toBe("base");
    expect(t.permanence.locked).toBe(true);
    expect(t.permanence.selectedShardIndex).toBe(1);
    expect(t.provenance[0].kind).toBe("minted");
  });

  it("omits editionSize/editionIndex when not set", () => {
    const t = mapMintToToken(RAW);
    expect(t.editionSize).toBeUndefined();
    expect(t.editionIndex).toBeUndefined();
  });

  it("includes editionSize/editionIndex when set", () => {
    const t = mapMintToToken({ ...RAW, editionSize: 10, editionIndex: 3 });
    expect(t.editionSize).toBe(10);
    expect(t.editionIndex).toBe(3);
  });

  it("marks only the STATE shard guaranteed and flags it onchain proof", () => {
    const t = mapMintToToken(RAW);
    const state = t.permanence.shards.find((s) => s.index === 0)!;
    const log = t.permanence.shards.find((s) => s.index === 1)!;
    expect(state.backend).toBe("onchain");
    expect(state.guaranteed).toBe(true);
    expect(state.mandatory).toBe(true);
    expect(log.backend).toBe("log");
    expect(log.guaranteed).toBe(false);
    expect(t.permanence.onchainProofConfigured).toBe(true);
  });

  it("resolves shard source URLs (log → resolver, ipfs → gateway)", () => {
    const t = mapMintToToken(RAW);
    const log = t.permanence.shards.find((s) => s.index === 1)!;
    const ipfs = t.permanence.shards.find((s) => s.index === 2)!;
    expect(log.sourceUrl).toContain("/api/shard/log/0xLED/0xFID");
    expect(ipfs.sourceUrl).toContain("/CID");
  });

  it("listable when STATE configured (no fake listing/traits)", () => {
    const t = mapMintToToken(RAW);
    expect(t.listable).toBe(true);
    expect(t.listing).toBeUndefined();
    expect(t.traits).toEqual([]);
    expect(t.offers).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests**

```
npx vitest run src/lib/web3/read-token.test.ts
```

Expected: 5 tests pass.

---

## Task 4: Refactor indexer.ts — multi-collection

**Files:**
- Modify: `src/lib/web3/indexer.ts`

- [ ] **Step 1: Add FACTORY_DEPLOY_BLOCK constant and CollectionInfo type**

Add near the top (after imports):

```typescript
import { FACTORY_ABI } from "./abis";
import { FL_DEPLOY_BLOCK, LOG_WINDOW, MAX_WINDOWS, scanStartBlock } from "./read-token";

export const FACTORY_DEPLOY_BLOCK: Record<number, bigint> = {
  84532: BigInt(42258356),
  11155111: BigInt(10965404),
};

export interface CollectionInfo {
  address: Hex;
  owner: Hex;
  name: string;
  createdBlock: bigint;
}
```

- [ ] **Step 2: Add a second TTL cache for collections**

```typescript
const collCache = new Map<number, { at: number; cols: CollectionInfo[] }>();
```

- [ ] **Step 3: Implement indexCollections**

```typescript
export async function indexCollections(chainId: number): Promise<CollectionInfo[]> {
  const cached = collCache.get(chainId);
  if (cached && Date.now() - cached.at < TTL_MS) return cached.cols;

  try {
    const pub = serverPublicClient(chainId);
    const contracts = getContracts(chainId);
    if (!pub) return [];

    const COLLECTION_CREATED = parseAbiItem(
      "event CollectionCreated(address indexed collection, address indexed owner, string name, string symbol)",
    );

    const sovereign: CollectionInfo[] = [];

    if (contracts.factory) {
      const factory = contracts.factory;
      const factoryFloor = FACTORY_DEPLOY_BLOCK[chainId] ?? BigInt(0);
      const latest = await pub.getBlockNumber();
      let from = factoryFloor;
      for (let w = 0; w < MAX_WINDOWS && from <= latest; w++) {
        const rawTo = from + LOG_WINDOW - BigInt(1);
        const to = rawTo > latest ? latest : rawTo;
        try {
          const logs = await pub.getLogs({
            address: factory,
            event: COLLECTION_CREATED,
            fromBlock: from,
            toBlock: to,
          });
          for (const l of logs) {
            if (l.args.collection && l.args.owner && l.args.name !== undefined) {
              sovereign.push({
                address: l.args.collection as Hex,
                owner: l.args.owner as Hex,
                name: l.args.name as string,
                createdBlock: l.blockNumber as bigint,
              });
            }
          }
        } catch { /* window failure is non-fatal */ }
        from = to + BigInt(1);
      }
    }

    // Prepend canonical FL as the "Default (open)" collection
    const result: CollectionInfo[] = [];
    if (contracts.foreverLibrary) {
      result.push({
        address: contracts.foreverLibrary,
        owner: "0x0000000000000000000000000000000000000000" as Hex,
        name: "Default (open)",
        createdBlock: FL_DEPLOY_BLOCK[chainId] ?? BigInt(0),
      });
    }
    result.push(...sovereign);

    collCache.set(chainId, { at: Date.now(), cols: result });
    return result;
  } catch {
    return [];
  }
}
```

- [ ] **Step 4: Rewrite indexAllTokens to enumerate all collections**

Replace the existing `enumerateTokenIds` helper and `indexAllTokens`:

```typescript
async function enumerateTokenIdsForContract(
  pub: NonNullable<ReturnType<typeof serverPublicClient>>,
  contractAddr: Hex,
  fromBlock: bigint,
  latest: bigint,
): Promise<bigint[]> {
  const seen = new Set<string>();
  let from = fromBlock;
  for (let w = 0; w < MAX_WINDOWS && from <= latest; w++) {
    const rawTo = from + LOG_WINDOW - BigInt(1);
    const to = rawTo > latest ? latest : rawTo;
    try {
      const logs = await pub.getLogs({
        address: contractAddr,
        event: MINTED_EVENT,
        fromBlock: from,
        toBlock: to,
      });
      for (const l of logs) {
        if (l.args.tokenId !== undefined) {
          seen.add((l.args.tokenId as bigint).toString());
        }
      }
    } catch { /* non-fatal */ }
    from = to + BigInt(1);
  }
  return [...seen].map((s) => BigInt(s)).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

export async function indexAllTokens(chainId: number): Promise<Token[]> {
  const cached = cache.get(chainId);
  if (cached && Date.now() - cached.at < TTL_MS) return cached.tokens;

  try {
    const pub = serverPublicClient(chainId);
    if (!pub) return [];

    const collections = await indexCollections(chainId);
    const latest = await pub.getBlockNumber();
    const allTokens: Token[] = [];

    for (const col of collections) {
      if (allTokens.length >= MAX_TOKENS) break;
      const ids = await enumerateTokenIdsForContract(pub, col.address, col.createdBlock, latest);
      for (const id of ids) {
        if (allTokens.length >= MAX_TOKENS) break;
        const t = await readOnchainToken(chainId, col.address, id);
        if (t) allTokens.push(t);
      }
    }

    cache.set(chainId, { at: Date.now(), tokens: allTokens });
    return allTokens;
  } catch {
    return [];
  }
}
```

- [ ] **Step 5: Rewrite indexedCollections**

Replace existing `indexedCollections`:

```typescript
export async function indexedCollections(chainId: number): Promise<Collection[]> {
  try {
    const collections = await indexCollections(chainId);
    const allTokens = await indexAllTokens(chainId);
    const chain = chainId === 84532 ? "base" : chainId === 11155111 ? "ethereum" : "base" as const;
    const canonicalFL = (getContracts(chainId).foreverLibrary ?? "").toLowerCase();

    const result: Collection[] = [];
    for (const col of collections) {
      const addrLower = col.address.toLowerCase();
      const colTokens = allTokens.filter((t) => t.collectionSlug === addrLower);
      // Include all collections (even empty — they're real contracts).
      // Prefer non-empty; skip empty sovereign ones to keep the list clean.
      if (colTokens.length === 0 && addrLower !== canonicalFL) continue;

      const ownerSet = new Set<string>();
      for (const t of colTokens) ownerSet.add(t.owner.toLowerCase());

      result.push({
        slug: addrLower,
        name: col.name,
        artistHandle: "perpetual",
        genre: colTokens[0]?.genre ?? "Generative",
        description: col.sovereign ? `Sovereign collection at ${col.address}` : "Live on-chain works minted on Perpetual.",
        contractAddress: col.address,
        chain,
        sovereign: addrLower !== canonicalFL,
        coverSeed: addrLower,
        floorEth: 0,
        volumeEth: 0,
        itemCount: colTokens.length,
        ownerCount: ownerSet.size,
        royaltyBps: 0,
      });
    }
    return result;
  } catch {
    return [];
  }
}
```

Note: `col.sovereign` doesn't exist on `CollectionInfo`; use `addrLower !== canonicalFL` instead in the `description` field.

- [ ] **Step 6: Update imports in indexer.ts**

Make sure the top of the file imports `readOnchainToken` from read-token and `parseAbiItem` from viem:

```typescript
import "server-only";
import type { Hex } from "viem";
import { parseAbiItem } from "viem";
import type { Token, Collection } from "@/lib/types";
import { serverPublicClient } from "./server-client";
import { getContracts } from "./contracts";
import { FOREVER_LIBRARY_ABI, FACTORY_ABI } from "./abis";
import {
  readOnchainToken,
  scanStartBlock,
  LOG_WINDOW,
  MAX_WINDOWS,
  FL_DEPLOY_BLOCK,
} from "./read-token";
```

- [ ] **Step 7: Run tsc**

```
npx tsc --noEmit
```

Expected: 0 errors.

---

## Task 5: Update indexer tests

**Files:**
- Modify: `src/lib/web3/indexer.test.ts`

- [ ] **Step 1: Add CollectionInfo shape test (pure unit; no RPC)**

Append to the existing test file (the `mergeForExplore` tests remain unchanged):

```typescript
import { describe, it, expect } from "vitest";
import { mergeForExplore } from "./indexer";
import type { Token } from "@/lib/types";

// Minimal fake Token — cast to Token to avoid filling every field.
function fakeToken(id: string, extra: Partial<Token> = {}): Token {
  return { id, tokenId: 0, ...extra } as Token;
}

describe("mergeForExplore", () => {
  // ... (keep all existing tests exactly as-is)
});

describe("FACTORY_DEPLOY_BLOCK", () => {
  it("has entries for the two test chains", async () => {
    const { FACTORY_DEPLOY_BLOCK } = await import("./indexer");
    expect(typeof FACTORY_DEPLOY_BLOCK[84532]).toBe("bigint");
    expect(typeof FACTORY_DEPLOY_BLOCK[11155111]).toBe("bigint");
    expect(FACTORY_DEPLOY_BLOCK[84532]).toBe(BigInt(42258356));
    expect(FACTORY_DEPLOY_BLOCK[11155111]).toBe(BigInt(10965404));
  });
});
```

- [ ] **Step 2: Run tests**

```
npx vitest run src/lib/web3/indexer.test.ts
```

Expected: all tests pass.

---

## Task 6: Move token page to contract-addressed route

**Files:**
- Create: `src/app/token/onchain/[chainId]/[contract]/[tokenId]/page.tsx`
- Delete: `src/app/token/onchain/[chainId]/[tokenId]/` directory

- [ ] **Step 1: Create the new route directory and file**

```
New file: src/app/token/onchain/[chainId]/[contract]/[tokenId]/page.tsx
```

Content:

```typescript
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { readOnchainToken } from "@/lib/web3/read-token";
import { PermanencePanel } from "@/components/token/PermanencePanel";
import { CertificateOfPermanence } from "@/components/token/CertificateOfPermanence";
import { ProvenanceTimeline } from "@/components/token/ProvenanceTimeline";
import { TradePanel } from "@/components/token/TradePanel";
import { MediaPreview } from "@/components/mint/MediaPreview";
import { Section } from "@/components/ui";
import { shortAddress } from "@/lib/utils";
import type { Hex } from "viem";

export const dynamic = "force-dynamic";

const CONTRACT_RE = /^0x[0-9a-fA-F]{40}$/;

async function load(chainId: string, contract: string, tokenId: string) {
  const c = Number(chainId);
  const id = /^\d+$/.test(tokenId) ? BigInt(tokenId) : null;
  if (!Number.isInteger(c) || id === null || !CONTRACT_RE.test(contract)) return null;
  return readOnchainToken(c, contract as Hex, id);
}

export async function generateMetadata(
  { params }: { params: Promise<{ chainId: string; contract: string; tokenId: string }> },
): Promise<Metadata> {
  const { chainId, contract, tokenId } = await params;
  const token = await load(chainId, contract, tokenId);
  if (!token) return { title: "Token not found · Perpetual" };
  return {
    title: `${token.title} · Perpetual`,
    description: `On-chain token #${token.tokenId} by ${token.artistHandle}`,
  };
}

export default async function OnchainTokenPage(
  { params }: { params: Promise<{ chainId: string; contract: string; tokenId: string }> },
) {
  const { chainId, contract, tokenId } = await params;
  if (!CONTRACT_RE.test(contract)) notFound();

  const token = await load(chainId, contract, tokenId);
  if (!token) notFound();

  const chainIdNum = Number(chainId);

  const stateShard = token.permanence.shards.find((s) => s.index === 0);
  const logShard = token.permanence.shards.find((s) => s.backend === "log");
  const displayUrl = logShard?.sourceUrl ?? stateShard?.sourceUrl;

  const mime =
    token.mediaType === "video"
      ? "video/mp4"
      : token.mediaType === "interactive"
      ? "text/html"
      : "image/png";

  const isEdition = token.editionSize !== undefined && token.editionSize > 1;

  return (
    <Section>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,480px)]">
        {/* Left: media + provenance */}
        <div className="space-y-4">
          <div className="overflow-hidden rounded-[10px] border border-border bg-surface-2">
            <MediaPreview
              url={displayUrl}
              mime={mime}
              seed={token.artSeed}
              genre={token.genre}
              className="h-full w-full object-contain"
            />
          </div>
          {token.provenance.length > 0 && (
            <ProvenanceTimeline events={token.provenance} />
          )}
        </div>

        {/* Right: header + panels */}
        <div className="space-y-4">
          <header>
            <span className="font-mono text-[10px] uppercase tracking-wider text-faint">
              On-chain · token #{token.tokenId}
              {isEdition && (
                <> · Edition {token.editionIndex}/{token.editionSize}</>
              )}
            </span>
            <h1 className="mt-1 font-brand text-[28px] font-semibold tracking-[-0.01em] text-foreground">
              {token.title}
            </h1>
            <p className="mt-1 text-sm text-muted">
              by {token.artistHandle} · owner {shortAddress(token.owner)}
            </p>
          </header>
          <TradePanel
            chainId={chainIdNum}
            tokenId={token.tokenId}
            nft={contract as Hex}
            owner={token.owner as Hex}
          />
          <PermanencePanel token={token} />
          <CertificateOfPermanence token={token} />
        </div>
      </div>
    </Section>
  );
}
```

- [ ] **Step 2: Delete the old route directory**

On Windows PowerShell:

```powershell
Remove-Item -Recurse -Force "src\app\token\onchain\[chainId]\[tokenId]"
```

- [ ] **Step 3: Run tsc**

```
npx tsc --noEmit
```

Expected: 0 errors.

---

## Task 7: Update ArtTile tokenHref for contract-addressed path

**Files:**
- Modify: `src/components/art/ArtTile.tsx:16-21`

- [ ] **Step 1: Parse contract from token.id**

The new `token.id` format is `${chainId}-${contract}-${tokenId}`. The `token.collectionSlug` for onchain tokens is now the lowercased contract address (a 42-char `0x...` string). Use `collectionSlug` directly since it IS the contract address for onchain tokens.

Replace the `tokenHref` function:

```typescript
/**
 * Derive the token detail href. Live on-chain tokens use
 * `/token/onchain/{chainId}/{contract}/{tokenId}`; mock tokens use `/token/{id}`.
 *
 * For onchain tokens, token.collectionSlug is the lowercased contract address
 * and token.id is `${chainId}-${contract}-${tokenId}`.
 */
function tokenHref(token: Token): string {
  if (token.source === "onchain") {
    // id = "${chainId}-${contract}-${tokenId}"
    // contract is 42 chars (0x + 40 hex). Split from right to avoid ambiguity.
    const parts = token.id.split("-");
    // parts[0] = chainId, parts[1] = contract (0x...), parts[2] = tokenId
    // But contract itself starts with "0x" so it won't contain extra dashes.
    const chainId = parts[0];
    const tokenIdPart = parts[parts.length - 1];
    const contract = token.collectionSlug; // already lowercased contract address
    return `/token/onchain/${chainId}/${contract}/${tokenIdPart}`;
  }
  return `/token/${token.id}`;
}
```

- [ ] **Step 2: Run tsc**

```
npx tsc --noEmit
```

Expected: 0 errors.

---

## Task 8: Update MintSuccess "View your token" link

**Files:**
- Modify: `src/components/mint/MintSuccess.tsx`

The component receives `chainId` and `tokenId`. It needs the contract address. For Phase 3 (canonical FL only), add a `contract` prop that defaults to the canonical FL.

- [ ] **Step 1: Add contract prop to MintSuccess**

In the props destructuring, add `contract?: string`:

```typescript
export function MintSuccess({
  form,
  shardOptions,
  onReset,
  txHash,
  chainId,
  tokenId,
  shards,
  contract,
}: {
  form: MintForm;
  shardOptions: ShardOption[];
  onReset: () => void;
  txHash?: `0x${string}`;
  chainId?: number;
  tokenId?: string;
  shards?: ShardRecord[];
  /** Contract address of the collection this token was minted into. */
  contract?: string;
}) {
```

- [ ] **Step 2: Update "View your token" link**

Find the `<a href={`/token/onchain/${chainId}/${tokenId}`}` and replace:

```typescript
{tokenId && chainId && contract && (
  <a
    href={`/token/onchain/${chainId}/${contract}/${tokenId}`}
    className="font-mono text-[11px] uppercase tracking-wider text-accent underline-offset-2 hover:underline"
  >
    View your token →
  </a>
)}
{tokenId && chainId && !contract && (
  <a
    href={`/token/onchain/${chainId}/${tokenId}`}
    className="font-mono text-[11px] uppercase tracking-wider text-accent underline-offset-2 hover:underline"
  >
    View your token →
  </a>
)}
```

Actually, simplify: just show the link when all three are present:

```typescript
{tokenId && chainId && contract && (
  <a
    href={`/token/onchain/${chainId}/${contract}/${tokenId}`}
    className="font-mono text-[11px] uppercase tracking-wider text-accent underline-offset-2 hover:underline"
  >
    View your token →
  </a>
)}
```

- [ ] **Step 3: Update MintWizard (the caller) to pass canonical FL contract**

Find where `MintSuccess` is rendered in `src/components/mint/MintWizard.tsx` and add the `contract` prop using the canonical FL address from `getContracts(chainId).foreverLibrary`. Read the file first to see how `chainId`/`tokenId` are passed, then add:

```typescript
import { getContracts } from "@/lib/web3/contracts"; // if not already imported
// ...
<MintSuccess
  // existing props
  contract={chainId ? getContracts(chainId).foreverLibrary : undefined}
/>
```

Note: MintWizard is a client component so `getContracts` (which reads `process.env.NEXT_PUBLIC_*`) works fine.

- [ ] **Step 4: Run tsc**

```
npx tsc --noEmit
```

Expected: 0 errors.

---

## Task 9: Update OwnedTab OnchainWorks links

**Files:**
- Modify: `src/components/profile/OwnedTab.tsx`

The `/api/onchain/owned` response will now include `contract` in each item. The `OnchainWorks` component links to `/token/onchain/${it.chainId}/${it.tokenId}` — update to include contract.

- [ ] **Step 1: Update OwnedItem type and link**

```typescript
type OwnedItem = {
  id: string;
  tokenId: number;
  title: string;
  chainId: number;
  contract: string;
  image: string | null;
};
```

Update the link:

```typescript
<Link
  key={it.id}
  href={`/token/onchain/${it.chainId}/${it.contract}/${it.tokenId}`}
  className="group overflow-hidden rounded-[8px] border border-border bg-surface-2 transition-colors hover:border-border-bright"
>
```

- [ ] **Step 2: Run tsc**

```
npx tsc --noEmit
```

Expected: 0 errors.

---

## Task 10: Update /api/onchain/owned — multi-collection

**Files:**
- Modify: `src/app/api/onchain/owned/route.ts`

- [ ] **Step 1: Replace route to iterate all collections**

```typescript
import { NextResponse } from "next/server";
import { readOwnedTokenIds, readOnchainToken } from "@/lib/web3/read-token";
import { indexCollections } from "@/lib/web3/indexer";
import type { Hex } from "viem";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADDR = /^0x[0-9a-fA-F]{40}$/;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const chainId = Number(url.searchParams.get("chainId"));
  const owner = url.searchParams.get("owner") ?? "";
  if (!Number.isInteger(chainId) || !ADDR.test(owner)) {
    return NextResponse.json(
      { error: "missing or invalid chainId/owner" },
      { status: 400 },
    );
  }

  const collections = await indexCollections(chainId);
  const items: Array<{
    id: string; tokenId: number; title: string;
    chainId: number; contract: string; image: string | null;
  }> = [];

  for (const col of collections) {
    if (items.length >= 24) break;
    const ids = await readOwnedTokenIds(chainId, col.address, owner, col.createdBlock);
    for (const id of ids) {
      if (items.length >= 24) break;
      const t = await readOnchainToken(chainId, col.address, id);
      if (!t) continue;
      const state = t.permanence.shards.find((s) => s.index === 0);
      items.push({
        id: t.id,
        tokenId: t.tokenId,
        title: t.title,
        chainId,
        contract: col.address.toLowerCase(),
        image: state?.sourceUrl ?? null,
      });
    }
  }

  return NextResponse.json(
    { owner, chainId, count: items.length, items },
    { headers: { "Cache-Control": "no-store" } },
  );
}
```

- [ ] **Step 2: Run tsc**

```
npx tsc --noEmit
```

Expected: 0 errors.

---

## Task 11: Add per-collection page

**Files:**
- Create: `src/app/collections/onchain/[chainId]/[contract]/page.tsx`

- [ ] **Step 1: Create the directory and file**

```typescript
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { indexedCollections, indexAllTokens } from "@/lib/web3/indexer";
import { Section, MonoLabel } from "@/components/ui";
import { ArtTile } from "@/components/art/ArtTile";

export const dynamic = "force-dynamic";

const CONTRACT_RE = /^0x[0-9a-fA-F]{40}$/;

export async function generateMetadata(
  { params }: { params: Promise<{ chainId: string; contract: string }> },
): Promise<Metadata> {
  const { chainId, contract } = await params;
  if (!CONTRACT_RE.test(contract)) return { title: "Collection not found · Perpetual" };
  const cols = await indexedCollections(Number(chainId));
  const col = cols.find((c) => c.slug === contract.toLowerCase());
  return {
    title: col ? `${col.name} · Perpetual` : `Collection ${contract.slice(0, 10)}… · Perpetual`,
    description: col?.description ?? "On-chain collection on Perpetual.",
  };
}

export default async function OnchainCollectionPage(
  { params }: { params: Promise<{ chainId: string; contract: string }> },
) {
  const { chainId, contract } = await params;
  if (!CONTRACT_RE.test(contract)) notFound();

  const chainIdNum = Number(chainId);
  const contractLower = contract.toLowerCase();

  const [cols, allTokens] = await Promise.all([
    indexedCollections(chainIdNum),
    indexAllTokens(chainIdNum),
  ]);

  const col = cols.find((c) => c.slug === contractLower);
  const tokens = allTokens.filter((t) => t.collectionSlug === contractLower);

  const name = col?.name ?? `Collection ${contract.slice(0, 10)}…`;

  return (
    <Section>
      <div className="pb-8">
        <MonoLabel className="text-faint">On-chain Collection</MonoLabel>
        <h1 className="display-sm mt-2 font-brand text-foreground">{name}</h1>
        <p className="mt-1 font-mono text-[11px] text-faint break-all">{contract}</p>
        {col && (
          <p className="mt-3 font-mono text-[12px] text-muted">
            {col.itemCount} {col.itemCount === 1 ? "item" : "items"} · {col.ownerCount} {col.ownerCount === 1 ? "owner" : "owners"}
          </p>
        )}
      </div>

      {tokens.length === 0 ? (
        <p className="mt-8 text-sm text-muted">No tokens minted in this collection yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 lg:gap-5">
          {tokens.map((t, i) => (
            <div key={t.id} className="animate-rise" style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}>
              <ArtTile token={t} />
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}
```

- [ ] **Step 2: Run tsc**

```
npx tsc --noEmit
```

Expected: 0 errors.

---

## Task 12: Update CollectionsBrowser + collections page

**Files:**
- Modify: `src/components/collections/CollectionsBrowser.tsx`
- Modify: `src/app/collections/page.tsx`

- [ ] **Step 1: Update CollectionsBrowser to use per-collection pages for live slugs**

The current logic sends live slugs to `/explore`. Now sovereign/live collection slugs ARE 42-char lowercase Ethereum addresses. Instead of `/explore`, they should link to `/collections/onchain/${chainId}/${slug}`.

Update the `CollectionsBrowser` props to accept `chainId` and change the href logic:

```typescript
export function CollectionsBrowser({
  collections,
  genres,
  liveChainId,
  liveSlugs = [],
}: {
  collections: Collection[];
  genres: Genre[];
  /** The chainId for live on-chain collections (used to build /collections/onchain/... links). */
  liveChainId?: number;
  liveSlugs?: string[];
}) {
  const [genre, setGenre] = React.useState<Genre | "all">("all");
  const liveSet = React.useMemo(() => new Set(liveSlugs), [liveSlugs]);

  const results = React.useMemo(
    () => (genre === "all" ? collections : collections.filter((c) => c.genre === genre)),
    [collections, genre],
  );

  function hrefFor(c: Collection): string | undefined {
    if (liveSet.has(c.slug) && liveChainId) {
      return `/collections/onchain/${liveChainId}/${c.slug}`;
    }
    return undefined; // CollectionCard defaults to /collections/{slug}
  }

  return (
    <div>
      {/* pill row unchanged */}
      ...
      {results.map((c, i) => (
        <div key={c.slug} className="h-full animate-rise" style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}>
          <CollectionCard collection={c} href={hrefFor(c)} />
        </div>
      ))}
    </div>
  );
}
```

IMPORTANT: Do NOT rewrite the entire component from scratch. Read the file, locate the prop destructuring and the `hrefFor` logic inline in JSX, and make targeted edits.

- [ ] **Step 2: Update collections page to pass liveChainId**

In `src/app/collections/page.tsx`, update the `CollectionsBrowser` call:

```typescript
<CollectionsBrowser
  collections={collections}
  genres={GENRES}
  liveChainId={84532}
  liveSlugs={liveSlugs}
/>
```

- [ ] **Step 3: Run tsc**

```
npx tsc --noEmit
```

Expected: 0 errors.

---

## Task 13: Check MintWizard and pass contract to MintSuccess

**Files:**
- Modify: `src/components/mint/MintWizard.tsx` (read first)

- [ ] **Step 1: Read MintWizard.tsx**

Read the file to find where `MintSuccess` is rendered and what props are already passed (`txHash`, `chainId`, `tokenId`).

- [ ] **Step 2: Add contract prop**

Import `getContracts` from `@/lib/web3/contracts` if not already imported. Find the `<MintSuccess` JSX and add:

```typescript
contract={chainId ? getContracts(chainId).foreverLibrary : undefined}
```

- [ ] **Step 3: Run tsc**

```
npx tsc --noEmit
```

Expected: 0 errors.

---

## Task 14: Full test suite + build

- [ ] **Step 1: Run all tests**

```
npx vitest run
```

Expected: all tests pass. If `mapMintToToken` test for old `id` format (`84532-5`) appears, it should now be updated in Task 3 — verify no stale assertions remain.

- [ ] **Step 2: Check no old route directory exists**

```powershell
Test-Path "src\app\token\onchain\[chainId]\[tokenId]"
```

Expected: `False`. If `True`, remove it:

```powershell
Remove-Item -Recurse -Force "src\app\token\onchain\[chainId]\[tokenId]"
```

- [ ] **Step 3: Run build**

```
npm run build
```

Expected: 0 TypeScript errors, no Next.js build errors. Watch for:
- "duplicate route" errors (would mean old `[tokenId]` directory still exists alongside new `[contract]/[tokenId]`)
- Missing page exports or invalid dynamic config

- [ ] **Step 4: Fix any build errors**

Common issues:
- `FACTORY_ABI` import in indexer — verify it's exported from `abis.ts` (it is: line 360)
- `parseAbiItem` for `CollectionCreated` — the `name` field in the ABI is `string`, not `indexed`, so the event fragment string must match exactly
- `col.sovereign` used in description in indexer — replace with `addrLower !== canonicalFL`

---

## Task 15: Commit in logical chunks

- [ ] **Commit 1: read-token + types**

```bash
git add src/lib/types.ts src/lib/web3/read-token.ts src/lib/web3/read-token.test.ts
git commit -m "feat: make read-token contract-addressed (multi-collection)

Token id is now \${chainId}-\${contract}-\${tokenId}; collectionSlug
is the lowercased contract address. All three public fns take a
contract:Hex param. editionSize/editionIndex are read and forwarded.
readOwnedTokenIds/readOnchainProvenance accept optional fromBlock."
```

- [ ] **Commit 2: indexer**

```bash
git add src/lib/web3/indexer.ts src/lib/web3/indexer.test.ts
git commit -m "feat: indexer enumerates all collections via factory (multi-contract)

Add indexCollections() — scans CollectionCreated events from
FACTORY_DEPLOY_BLOCK, prepends canonical FL as Default collection.
indexAllTokens/indexedCollections iterate across all collections."
```

- [ ] **Commit 3: routes + links**

```bash
git add src/app/token/onchain src/app/api/onchain/owned/route.ts \
  src/components/art/ArtTile.tsx src/components/mint/MintSuccess.tsx \
  src/components/mint/MintWizard.tsx src/components/profile/OwnedTab.tsx
git commit -m "feat: add [contract] segment to onchain token route; update all links"
```

- [ ] **Commit 4: per-collection page + collections wiring**

```bash
git add src/app/collections/onchain src/components/collections/CollectionsBrowser.tsx \
  src/app/collections/page.tsx
git commit -m "feat: add /collections/onchain/[chainId]/[contract] per-collection page"
```

---

## Spec Coverage Checklist

- [x] `readOnchainToken(chainId, contract, tokenId)` — Task 2
- [x] `readOwnedTokenIds(chainId, contract, owner, fromBlock?)` — Task 2
- [x] `readOnchainProvenance(chainId, contract, tokenId, fromBlock?)` — Task 2
- [x] Token id = `${chainId}-${contract}-${tokenId}` (lowercased contract) — Task 2
- [x] `collectionSlug` = lowercased contract address — Task 2
- [x] `editionSize` / `editionIndex` read from chain and forwarded to Token — Task 2
- [x] `FACTORY_DEPLOY_BLOCK` — Task 4
- [x] `indexCollections` scans `CollectionCreated`, prepends canonical FL — Task 4
- [x] `indexAllTokens` iterates all collections, caps ~200 — Task 4
- [x] `indexedCollections` returns one Collection per collection — Task 4
- [x] `mergeForExplore` stays — untouched
- [x] Route moved to `[chainId]/[contract]/[tokenId]` — Task 6
- [x] Old `[tokenId]` route directory deleted — Task 6
- [x] TradePanel `nft` = route `contract` — Task 6 (hardcoded `contract as Hex`)
- [x] Edition info shown in header when `editionSize > 1` — Task 6
- [x] `ArtTile.tokenHref` updated — Task 7
- [x] `MintSuccess` "View your token" link updated — Task 8
- [x] `OwnedTab` links updated — Task 9
- [x] `/api/onchain/owned` loops all collections, includes `contract` — Task 10
- [x] Per-collection page `/collections/onchain/[chainId]/[contract]` — Task 11
- [x] `CollectionsBrowser` links live cards to per-collection page — Task 12
- [x] `tsc --noEmit` clean after each group — Tasks 2, 4, 6, 7, 8, 9, 10, 11, 12, 13
- [x] `npm run build` clean — Task 14
- [x] `npm test` — Tasks 3, 5, 14

## Constraints Reminder

- Never use BigInt literals (`42258356n`). Always `BigInt(42258356)`.
- The `FACTORY_ABI` export already exists in `src/lib/web3/abis.ts` (line 360).
- `FL_DEPLOY_BLOCK` is already exported from `read-token.ts` — import from there, do not duplicate.
- Mock catalog coexists — `mergeForExplore` and mock data functions are untouched.
- `server-only` import stays at top of `read-token.ts` and `indexer.ts`.
- All indexer/read functions must never throw — return `[]`/`null` on any error.
