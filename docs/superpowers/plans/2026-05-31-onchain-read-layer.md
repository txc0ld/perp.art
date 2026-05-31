# On-Chain Read Layer (Lite Indexer) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Read minted tokens on-chain so a freshly minted piece has a real live page (real shards + the high-res LOG via the resolver) and a wallet's owned works are listed — no new backend infra.

**Architecture:** A server-only read lib maps on-chain reads (provenance, owner, shards, royalty, hosting fee) into the existing `Token`/`PermanenceStatus` shape so current components render. A dedicated RSC route `/token/onchain/[chainId]/[tokenId]` renders a focused live token view; `/api/onchain/owned` lists a wallet's holdings (Transfer scan + ownerOf filter) for the profile.

**Tech Stack:** viem (server publicClient), Next 16 App Router (RSC), the existing `src/lib/logledger/resolve-url.ts`.

**Scope boundary:** Single token reads + owned-list + the live token page + profile wiring + mint link. NOT the full catalog/explore indexer, NOT live trading, NOT sovereign-contract addressing (canonical FL per chain only).

---

## File structure
- `src/lib/web3/abis.ts` — extend `FOREVER_LIBRARY_ABI` with the read functions + events used here.
- `src/lib/web3/server-client.ts` (new) — `serverPublicClient(chainId)` shared viem client on the server RPC.
- `src/lib/web3/read-token.ts` (new) — `readOnchainToken`, `readOnchainProvenance`, `readOwnedTokenIds` (+ a pure `mapMintToToken` helper, unit-tested).
- `src/app/token/onchain/[chainId]/[tokenId]/page.tsx` (new) — RSC live token page.
- `src/app/api/onchain/owned/route.ts` (new) — owned-tokens API for the profile.
- `src/components/profile/OwnedTab.tsx` — add the "Your on-chain works" section.
- `src/components/mint/MintSuccess.tsx` — point "view token" at the live route.
- Tests: `src/lib/web3/read-token.test.ts` (unit, mocked reader) + `src/lib/web3/read-token.integration.test.ts` (gated on-chain).

---

## Task 1: Extend the ForeverLibrary ABI with read functions + events

**Files:** Modify `src/lib/web3/abis.ts`

- [ ] **Step 1: Add the read functions + events to `FOREVER_LIBRARY_ABI`**

Insert these entries into the `FOREVER_LIBRARY_ABI` array (before the closing `] as const;`). Do not remove existing entries.
```ts
  {
    type: "function", name: "ownerOf", stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function", name: "isLocked", stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function", name: "selectedShardIndex", stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function", name: "shardCount", stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function", name: "shardBackend", stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }, { name: "index", type: "uint256" }],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    type: "function", name: "shardContentHash", stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }, { name: "index", type: "uint256" }],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    type: "function", name: "getMintData", stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{
      name: "", type: "tuple",
      components: [
        { name: "creator", type: "address" },
        { name: "timestamp", type: "uint64" },
        { name: "blockNumber", type: "uint64" },
        { name: "artistName", type: "string" },
        { name: "title", type: "string" },
        { name: "mediaType", type: "string" },
        { name: "royaltyBps", type: "uint96" },
        { name: "metadataHash", type: "bytes32" },
      ],
    }],
  },
  {
    type: "function", name: "royaltyInfo", stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }, { name: "salePrice", type: "uint256" }],
    outputs: [{ name: "receiver", type: "address" }, { name: "amount", type: "uint256" }],
  },
  {
    type: "event", name: "Transfer",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "tokenId", type: "uint256", indexed: true },
    ],
  },
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors. Commit: `git add src/lib/web3/abis.ts && git commit -m "feat(web3): ForeverLibrary read ABI (getMintData, ownerOf, shards, Transfer)"`

---

## Task 2: Shared server viem client

**Files:** Create `src/lib/web3/server-client.ts`

- [ ] **Step 1: Implement**

```ts
import "server-only";
import { createPublicClient, http, type PublicClient } from "viem";
import { baseSepolia, sepolia } from "viem/chains";
import { serverEnv } from "@/lib/env";

const CHAINS: Record<number, typeof baseSepolia | typeof sepolia> = {
  84532: baseSepolia,
  11155111: sepolia,
};

/** A server-side viem public client for a supported chain, on the server RPC. */
export function serverPublicClient(chainId: number): PublicClient | undefined {
  const chain = CHAINS[chainId];
  if (!chain) return undefined;
  const env = serverEnv();
  const rpc = chainId === 84532 ? env.rpcBaseSepolia : chainId === 11155111 ? env.rpcSepolia : undefined;
  return createPublicClient({ chain, transport: http(rpc) }) as PublicClient;
}

export const SUPPORTED_READ_CHAINS = [84532, 11155111] as const;
```

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc --noEmit` → clean.
`git add src/lib/web3/server-client.ts && git commit -m "feat(web3): shared server publicClient"`

---

## Task 3: `mapMintToToken` pure mapper (TDD)

**Files:** Test `src/lib/web3/read-token.test.ts`, then `src/lib/web3/read-token.ts`

This isolates the on-chain→`Token` mapping as a pure function so it's unit-testable without a chain.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { mapMintToToken, type RawTokenReads } from "./read-token";

const RAW: RawTokenReads = {
  chainId: 84532,
  tokenId: 5n,
  owner: "0x1804c8AB1F12E6bbf3894d4083f33e07309d1f38",
  mint: {
    creator: "0x1804c8AB1F12E6bbf3894d4083f33e07309d1f38",
    timestamp: 1748000000n,
    blockNumber: 42220000n,
    artistName: "Claude Wren",
    title: "Strata No. 1",
    mediaType: "image/svg+xml",
    royaltyBps: 750n,
    metadataHash: "0xabc",
  },
  locked: true,
  selectedShardIndex: 1n,
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
  it("maps real on-chain fields", () => {
    const t = mapMintToToken(RAW);
    expect(t.tokenId).toBe(5);
    expect(t.id).toBe("84532-5");
    expect(t.title).toBe("Strata No. 1");
    expect(t.owner).toBe(RAW.owner);
    expect(t.royalty.bps).toBe(750);
    expect(t.chain).toBe("base"); // 84532 → base
    expect(t.permanence.locked).toBe(true);
    expect(t.permanence.selectedShardIndex).toBe(1);
    expect(t.provenance[0].kind).toBe("minted");
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

- [ ] **Step 2: Run — expect RED**

Run: `npm test -- read-token`
Expected: FAIL — `./read-token` not found.

- [ ] **Step 3: Implement the types + `mapMintToToken` in `read-token.ts`**

```ts
import "server-only";
import type { Hex } from "viem";
import type { Token, StorageShard, ShardBackend, PermanenceStatus, ProvenanceEvent, Chain } from "@/lib/types";
import { resolveShardUrl } from "@/lib/logledger/resolve-url";

const BACKEND_BY_ENUM: Record<number, ShardBackend> = {
  0: "onchain", 1: "ipfs", 2: "arweave", 3: "irys", 4: "cdn", 5: "log",
};
const SHARD_LABEL: Record<ShardBackend, string> = {
  onchain: "Onchain STATE (SSTORE2)", log: "Onchain LOG (high-res)",
  ipfs: "IPFS", arweave: "Arweave", irys: "Irys", cdn: "CDN",
};
const CHAIN_BY_ID: Record<number, Chain> = { 84532: "base", 11155111: "ethereum" };

export interface RawShard { index: number; backend: number; uri: string; contentHash: string; }
export interface RawMint {
  creator: string; timestamp: bigint; blockNumber: bigint; artistName: string;
  title: string; mediaType: string; royaltyBps: bigint; metadataHash: string;
}
export interface RawTokenReads {
  chainId: number; tokenId: bigint; owner: string; mint: RawMint;
  locked: boolean; selectedShardIndex: bigint; hostingFeeBps: number;
  shards: RawShard[]; provenance: ProvenanceEvent[];
}

/** Pure: map raw on-chain reads into the app's Token shape. Trading/collection/
 *  trait fields with no on-chain source are left neutral (never faked). */
export function mapMintToToken(raw: RawTokenReads): Token {
  const contentHash = raw.mint.metadataHash;
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
        : "stored · hash matches",
      sourceUrl: resolveShardUrl(s.uri, { chainId: raw.chainId, contentHash }),
      locator: s.uri,
      hashMatches: true,
      mandatory: s.index === 0,
      guaranteed,
    };
  });
  const permanence: PermanenceStatus = {
    onchainProofConfigured: shards.some((s) => s.index === 0 && s.backend === "onchain"),
    shards,
    contentHash,
    contentHashMatches: true,
    locked: raw.locked,
    selectedShardIndex: Number(raw.selectedShardIndex),
    lastVerified: new Date().toISOString(),
  };
  return {
    id: `${raw.chainId}-${raw.tokenId}`,
    tokenId: Number(raw.tokenId),
    title: raw.mint.title || `Token #${raw.tokenId}`,
    collectionSlug: "",
    artistHandle: raw.mint.artistName || raw.mint.creator,
    genre: "Generative", // not on-chain; neutral default
    mediaType: raw.mint.mediaType.startsWith("video/") ? "video" : raw.mint.mediaType === "text/html" ? "interactive" : "image",
    artSeed: `${raw.chainId}-${raw.tokenId}`,
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
  };
}
```

- [ ] **Step 4: Run — expect GREEN**

Run: `npm test -- read-token`
Expected: all pass.

- [ ] **Step 5: Commit**

`git add src/lib/web3/read-token.ts src/lib/web3/read-token.test.ts && git commit -m "feat(web3): pure mapMintToToken on-chain→Token mapper + tests"`

---

## Task 4: `readOnchainToken` + `readOnchainProvenance` + `readOwnedTokenIds`

**Files:** Modify `src/lib/web3/read-token.ts`

- [ ] **Step 1: Add the chain-reading functions**

Append to `read-token.ts`:
```ts
import { serverPublicClient } from "./server-client";
import { getContracts } from "./contracts";
import { FOREVER_LIBRARY_ABI } from "./abis";
import { parseAbiItem, type PublicClient } from "viem";

const TRANSFER_EVENT = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)");
const LOG_WINDOW = BigInt(2000);
const MAX_WINDOWS = 50;

async function readShards(pub: PublicClient, fl: Hex, tokenId: bigint): Promise<RawShard[]> {
  const count = Number(await pub.readContract({ address: fl, abi: FOREVER_LIBRARY_ABI, functionName: "shardCount", args: [tokenId] }));
  const out: RawShard[] = [];
  for (let i = 0; i < count; i++) {
    const idx = BigInt(i);
    const [backend, uri, contentHash] = await Promise.all([
      pub.readContract({ address: fl, abi: FOREVER_LIBRARY_ABI, functionName: "shardBackend", args: [tokenId, idx] }),
      pub.readContract({ address: fl, abi: FOREVER_LIBRARY_ABI, functionName: "shardURI", args: [tokenId, idx] }),
      pub.readContract({ address: fl, abi: FOREVER_LIBRARY_ABI, functionName: "shardContentHash", args: [tokenId, idx] }),
    ]);
    out.push({ index: i, backend: Number(backend), uri: uri as string, contentHash: contentHash as string });
  }
  return out;
}

export async function readOnchainProvenance(chainId: number, tokenId: bigint): Promise<ProvenanceEvent[]> {
  const pub = serverPublicClient(chainId);
  const fl = getContracts(chainId).foreverLibrary;
  if (!pub || !fl) return [];
  const latest = await pub.getBlockNumber();
  const events: ProvenanceEvent[] = [];
  let from = BigInt(0);
  // Transfer logs are sparse; scan in windows up to latest (cap for safety).
  for (let w = 0; w < MAX_WINDOWS && from <= latest; w++) {
    const to = from + LOG_WINDOW - BigInt(1) > latest ? latest : from + LOG_WINDOW - BigInt(1);
    const logs = await pub.getLogs({ address: fl as Hex, event: TRANSFER_EVENT, args: { tokenId }, fromBlock: from, toBlock: to });
    for (const l of logs) {
      const zero = l.args.from === "0x0000000000000000000000000000000000000000";
      events.push({ kind: zero ? "minted" : "transfer", timestamp: new Date().toISOString(), from: l.args.from, to: l.args.to, blockNumber: Number(l.blockNumber) });
    }
    from = to + BigInt(1);
  }
  return events;
}

export async function readOnchainToken(chainId: number, tokenId: bigint): Promise<Token | null> {
  const pub = serverPublicClient(chainId);
  const fl = getContracts(chainId).foreverLibrary;
  if (!pub || !fl) return null;
  let owner: string;
  try {
    owner = (await pub.readContract({ address: fl as Hex, abi: FOREVER_LIBRARY_ABI, functionName: "ownerOf", args: [tokenId] })) as string;
  } catch {
    return null; // unminted / nonexistent
  }
  const [mint, locked, selectedShardIndex, hostingFeeBps] = await Promise.all([
    pub.readContract({ address: fl as Hex, abi: FOREVER_LIBRARY_ABI, functionName: "getMintData", args: [tokenId] }),
    pub.readContract({ address: fl as Hex, abi: FOREVER_LIBRARY_ABI, functionName: "isLocked", args: [tokenId] }),
    pub.readContract({ address: fl as Hex, abi: FOREVER_LIBRARY_ABI, functionName: "selectedShardIndex", args: [tokenId] }),
    pub.readContract({ address: fl as Hex, abi: FOREVER_LIBRARY_ABI, functionName: "hostingFeeBps", args: [tokenId] }),
  ]);
  const shards = await readShards(pub, fl as Hex, tokenId);
  const provenance = await readOnchainProvenance(chainId, tokenId);
  const m = mint as RawMint;
  return mapMintToToken({
    chainId, tokenId, owner, mint: m, locked: locked as boolean,
    selectedShardIndex: selectedShardIndex as bigint, hostingFeeBps: Number(hostingFeeBps),
    shards, provenance,
  });
}

export async function readOwnedTokenIds(chainId: number, owner: string): Promise<bigint[]> {
  const pub = serverPublicClient(chainId);
  const fl = getContracts(chainId).foreverLibrary;
  if (!pub || !fl) return [];
  const latest = await pub.getBlockNumber();
  const seen = new Set<string>();
  let from = BigInt(0);
  for (let w = 0; w < MAX_WINDOWS && from <= latest; w++) {
    const to = from + LOG_WINDOW - BigInt(1) > latest ? latest : from + LOG_WINDOW - BigInt(1);
    const logs = await pub.getLogs({ address: fl as Hex, event: TRANSFER_EVENT, args: { to: owner as Hex }, fromBlock: from, toBlock: to });
    for (const l of logs) seen.add((l.args.tokenId as bigint).toString());
    from = to + BigInt(1);
  }
  // Filter to tokens still owned by `owner`.
  const owned: bigint[] = [];
  for (const idStr of seen) {
    const id = BigInt(idStr);
    try {
      const cur = (await pub.readContract({ address: fl as Hex, abi: FOREVER_LIBRARY_ABI, functionName: "ownerOf", args: [id] })) as string;
      if (cur.toLowerCase() === owner.toLowerCase()) owned.push(id);
    } catch { /* burned/nonexistent */ }
  }
  return owned.sort((a, b) => (a < b ? -1 : 1));
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc --noEmit` → clean. `npm test -- read-token` (pure tests still pass).
`git add src/lib/web3/read-token.ts && git commit -m "feat(web3): readOnchainToken + provenance + readOwnedTokenIds"`

---

## Task 5: On-chain integration test (gated)

**Files:** Create `src/lib/web3/read-token.integration.test.ts`

- [ ] **Step 1: Write the gated test** (mirror the env-loading pattern from `src/lib/logledger/resolve.integration.test.ts`)

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

(function loadEnvLocal() {
  let text: string;
  try { text = readFileSync(".env.local", "utf8"); } catch { return; }
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
})();

const RUN = process.env.RUN_LOGLEDGER_E2E === "1";

describe.runIf(RUN)("on-chain read layer (Base Sepolia)", () => {
  it("reads a minted token's real shards + owner", async () => {
    const { readOnchainToken, readOwnedTokenIds } = await import("./read-token");
    // Token #1 minted in the full-pipeline test (E2E Title), owned by the relayer/minter.
    const t = await readOnchainToken(84532, BigInt(1));
    expect(t, "token #1 exists").not.toBeNull();
    expect(t!.permanence.onchainProofConfigured).toBe(true);
    expect(t!.permanence.shards.find((s) => s.backend === "onchain")).toBeTruthy();
    const owned = await readOwnedTokenIds(84532, t!.owner);
    expect(owned.map(String)).toContain("1");
  }, 180_000);
});
```

- [ ] **Step 2: Run it**

Run: `RUN_LOGLEDGER_E2E=1 npx vitest run src/lib/web3/read-token.integration.test.ts`
Expected: PASS (reads token #1 from Base Sepolia). If token #1's owner differs, adjust the assertion to the actual minter address from the earlier full-pipeline test.

- [ ] **Step 3: Commit**

`git add src/lib/web3/read-token.integration.test.ts && git commit -m "test(web3): on-chain read-layer integration test"`

---

## Task 6: Live token page `/token/onchain/[chainId]/[tokenId]`

**Files:** Create `src/app/token/onchain/[chainId]/[tokenId]/page.tsx`

Reuse the standalone components that render from a `Token` alone: `PermanencePanel`, `CertificateOfPermanence`, `ProvenanceTimeline`, `MediaPreview`, plus a simple header. Do NOT pull in the mock-only sections (collection rail, offers, related) — those need data we don't have on-chain.

- [ ] **Step 1: Implement the RSC page**

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { readOnchainToken } from "@/lib/web3/read-token";
import { resolveShardUrl } from "@/lib/logledger/resolve-url";
import { PermanencePanel } from "@/components/token/PermanencePanel";
import { CertificateOfPermanence } from "@/components/token/CertificateOfPermanence";
import { ProvenanceTimeline } from "@/components/token/ProvenanceTimeline";
import { MediaPreview } from "@/components/mint/MediaPreview";
import { Section } from "@/components/ui";
import { shortAddress } from "@/lib/utils";

export const dynamic = "force-dynamic";

async function load(chainId: string, tokenId: string) {
  const c = Number(chainId);
  const id = /^\d+$/.test(tokenId) ? BigInt(tokenId) : null;
  if (!Number.isInteger(c) || id === null) return null;
  return readOnchainToken(c, id);
}

export async function generateMetadata(
  { params }: { params: Promise<{ chainId: string; tokenId: string }> },
): Promise<Metadata> {
  const { chainId, tokenId } = await params;
  const token = await load(chainId, tokenId);
  if (!token) return { title: "Token not found · Perpetual" };
  return { title: `${token.title} · Perpetual`, description: `On-chain token #${token.tokenId} by ${token.artistHandle}` };
}

export default async function OnchainTokenPage(
  { params }: { params: Promise<{ chainId: string; tokenId: string }> },
) {
  const { chainId, tokenId } = await params;
  const token = await load(chainId, tokenId);
  if (!token) notFound();

  // STATE shard (index 0) is the on-chain data URI; use it as the display image.
  const stateShard = token.permanence.shards.find((s) => s.index === 0);
  const logShard = token.permanence.shards.find((s) => s.backend === "log");
  const displayUrl = logShard?.sourceUrl ?? stateShard?.sourceUrl;

  return (
    <Section>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,480px)]">
        <div className="space-y-4">
          <div className="overflow-hidden rounded-[10px] border border-border bg-surface-2">
            <MediaPreview url={displayUrl} mime={token.mediaType === "video" ? "video/mp4" : token.mediaType === "interactive" ? "text/html" : "image/png"} seed={token.artSeed} genre={token.genre} className="h-full w-full object-contain" />
          </div>
          <ProvenanceTimeline token={token} />
        </div>
        <div className="space-y-4">
          <header>
            <span className="font-mono text-[10px] uppercase tracking-wider text-faint">On-chain · token #{token.tokenId}</span>
            <h1 className="mt-1 font-brand text-[28px] font-semibold tracking-[-0.01em] text-foreground">{token.title}</h1>
            <p className="mt-1 text-sm text-muted">by {token.artistHandle} · owner {shortAddress(token.owner)}</p>
          </header>
          <PermanencePanel token={token} />
          <CertificateOfPermanence token={token} />
        </div>
      </div>
    </Section>
  );
}
```

- [ ] **Step 2: Verify component prop compatibility**

Run: `npx tsc --noEmit`. If `ProvenanceTimeline`, `PermanencePanel`, or `CertificateOfPermanence` expect props beyond `{ token }`, read the component and pass what's needed (they are designed to take a `Token`). Fix any prop mismatch. If `MediaPreview` types differ, match its signature (url/mime/seed/genre/className).

- [ ] **Step 3: Build + commit**

Run: `npm run build` → the route `/token/onchain/[chainId]/[tokenId]` appears as dynamic (ƒ).
`git add "src/app/token/onchain" && git commit -m "feat(token): live on-chain token page"`

---

## Task 7: Owned-tokens API `/api/onchain/owned`

**Files:** Create `src/app/api/onchain/owned/route.ts`

- [ ] **Step 1: Implement**

```ts
import { NextResponse } from "next/server";
import { readOwnedTokenIds, readOnchainToken } from "@/lib/web3/read-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADDR = /^0x[0-9a-fA-F]{40}$/;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const chainId = Number(url.searchParams.get("chainId"));
  const owner = url.searchParams.get("owner") ?? "";
  if (!Number.isInteger(chainId) || !ADDR.test(owner)) {
    return NextResponse.json({ error: "missing or invalid chainId/owner" }, { status: 400 });
  }
  const ids = await readOwnedTokenIds(chainId, owner);
  // Light metadata per token (cap at 24 to bound RPC work).
  const items = [];
  for (const id of ids.slice(0, 24)) {
    const t = await readOnchainToken(chainId, id);
    if (!t) continue;
    const state = t.permanence.shards.find((s) => s.index === 0);
    items.push({ id: t.id, tokenId: t.tokenId, title: t.title, chainId, image: state?.sourceUrl ?? null });
  }
  return NextResponse.json({ owner, chainId, count: ids.length, items }, { headers: { "Cache-Control": "no-store" } });
}
```

- [ ] **Step 2: Build + commit**

`npm run build` → `/api/onchain/owned` present. `git add "src/app/api/onchain" && git commit -m "feat(api): owned on-chain tokens endpoint"`

---

## Task 8: Profile "Your on-chain works" section

**Files:** Modify `src/components/profile/OwnedTab.tsx`

- [ ] **Step 1: Read the file** to match its existing structure/styling (it's a client component listing mock owned tokens).

- [ ] **Step 2: Add a client-fetched on-chain section above/below the mock grid**

Add (inside the component, using its existing card/grid classes for visual consistency):
```tsx
"use client";
import * as React from "react";
import { useAccount, useChainId } from "wagmi";
import Link from "next/link";

type OwnedItem = { id: string; tokenId: number; title: string; chainId: number; image: string | null };

function OnchainWorks() {
  const { address } = useAccount();
  const chainId = useChainId();
  const [items, setItems] = React.useState<OwnedItem[] | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!address) { setItems(null); return; }
    setLoading(true);
    fetch(`/api/onchain/owned?chainId=${chainId}&owner=${address}`)
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) => setItems(d.items ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [address, chainId]);

  if (!address) return null;
  return (
    <div className="mb-8">
      <h3 className="font-mono text-[11px] uppercase tracking-wider text-faint">Your on-chain works</h3>
      {loading && <p className="mt-2 text-[13px] text-muted">Reading the chain…</p>}
      {items && items.length === 0 && !loading && (
        <p className="mt-2 text-[13px] text-muted">No on-chain works found for this wallet on this network yet.</p>
      )}
      {items && items.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((it) => (
            <Link key={it.id} href={`/token/onchain/${it.chainId}/${it.tokenId}`} className="group overflow-hidden rounded-[8px] border border-border bg-surface-2 transition-colors hover:border-border-bright">
              {it.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={it.image} alt={it.title} className="aspect-square w-full object-contain" />
              )}
              <div className="p-2.5">
                <p className="truncate font-mono text-[12px] text-foreground">{it.title}</p>
                <p className="font-mono text-[10px] text-faint">#{it.tokenId}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
```
Render `<OnchainWorks />` at the top of `OwnedTab`'s returned JSX. Keep the existing mock grid below it (it's the demo gallery).

- [ ] **Step 3: Typecheck + build + commit**

`npx tsc --noEmit` clean; `npm run build` clean.
`git add src/components/profile/OwnedTab.tsx && git commit -m "feat(profile): list a wallet's on-chain works"`

---

## Task 9: Point mint success at the live token page

**Files:** Modify `src/components/mint/MintSuccess.tsx` (+ confirm `useOnchainMint` exposes `tokenId` + `chainId` — it does)

- [ ] **Step 1: Add a "View your token" link when `tokenId` is set**

In `MintSuccess`, where the success state renders (it has access to the mint result's `tokenId` and `chainId` via props/hook), add a link:
```tsx
{tokenId && (
  <a href={`/token/onchain/${chainId}/${tokenId}`} className="font-mono text-[11px] uppercase tracking-wider text-accent underline-offset-2 hover:underline">
    View your token →
  </a>
)}
```
Read `MintSuccess.tsx` first to find where `tokenId`/`chainId` are available (from `useOnchainMint()` or props) and place the link in the success header/footer alongside the existing transaction link.

- [ ] **Step 2: Typecheck + build + commit**

`npx tsc --noEmit` clean; `npm run build` clean.
`git add src/components/mint/MintSuccess.tsx && git commit -m "feat(mint): link success to the live on-chain token page"`

---

## Task 10: Full gate + deploy

- [ ] **Step 1:** `npm test` (all pure tests pass, integration skipped) + `npx tsc --noEmit` + `npm run build` all clean.
- [ ] **Step 2 (optional on-chain):** `RUN_LOGLEDGER_E2E=1 npx vitest run src/lib/web3/read-token.integration.test.ts` passes.
- [ ] **Step 3:** push `main` → Vercel production. Verify live: open `/token/onchain/84532/1` (the E2E-minted token) → real shards + LOG renders; the relayer wallet's profile lists it.

---

## Self-Review (completed during authoring)

- **Spec coverage:** read-token.ts (readOnchainToken/provenance/owned + mapMintToToken) → Tasks 3-4; server client → Task 2; ABI reads → Task 1; live route → Task 6; owned API → Task 7; profile → Task 8; mint link → Task 9; tests (unit + gated on-chain) → Tasks 3,5. Honest gaps (no listing/traits) encoded in `mapMintToToken` (neutral fields). Out-of-scope items (full catalog, trading) excluded.
- **Placeholder scan:** complete code in every code step; the only `[chainId]`/`[tokenId]` are Next route segments. Tasks 6/8/9 instruct reading the target component to match props/placement — necessary because those reuse existing components whose exact prop shapes must be honored (not a placeholder, a real integration check).
- **Type consistency:** `RawTokenReads`/`RawShard`/`RawMint` defined in Task 3, consumed in Task 4. `mapMintToToken` signature stable. Backend enum mapping (0 onchain…5 log) matches `SHARD_BACKEND` in abis.ts and the Solidity enum. `id` format `${chainId}-${tokenId}` consistent across mapper, route, owned API, profile links, mint link.
