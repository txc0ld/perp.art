import "server-only";
import { parseAbiItem, type Hex, type PublicClient } from "viem";
import type { Token, StorageShard, ShardBackend, PermanenceStatus, ProvenanceEvent, Chain } from "@/lib/types";
import { resolveShardUrl } from "@/lib/logledger/resolve-url";
import { serverPublicClient } from "./server-client";
import { FOREVER_LIBRARY_ABI } from "./abis";

const BACKEND_BY_ENUM: Record<number, ShardBackend> = {
  0: "onchain", 1: "ipfs", 2: "arweave", 3: "irys", 4: "cdn", 5: "log",
};
const SHARD_LABEL: Record<ShardBackend, string> = {
  onchain: "Onchain STATE (SSTORE2)", log: "Onchain LOG (high-res)",
  ipfs: "IPFS", arweave: "Arweave", irys: "Irys", cdn: "CDN",
};
const CHAIN_BY_ID: Record<number, Chain> = { 84532: "base", 11155111: "ethereum" };
const ZERO_HASH = "0x0000000000000000000000000000000000000000000000000000000000000000";

/** A shard has a content-hash recorded on-chain (non-zero). For STATE/LOG this
 *  hash is the on-chain/Merkle commitment; for off-chain shards it is the hash
 *  recorded at configureShard (live content verification is the permanence
 *  service's job, not this read layer). */
function hasRecordedHash(h: string): boolean {
  return !!h && h.toLowerCase() !== ZERO_HASH;
}

export interface RawShard { index: number; backend: number; uri: string; contentHash: string; }
export interface RawMint {
  creator: string; timestamp: bigint; blockNumber: bigint; artistName: string;
  title: string; mediaType: string; royaltyBps: bigint; metadataHash: string;
}
export interface RawTokenReads {
  chainId: number; tokenId: bigint; contract: string; owner: string; mint: RawMint;
  locked: boolean; selectedShardIndex: bigint; hostingFeeBps: number;
  shards: RawShard[]; provenance: ProvenanceEvent[];
  editionSize?: number; editionIndex?: number;
}

/** Pure: map raw on-chain reads into the app's Token shape. Trading/collection/
 *  trait fields with no on-chain source are left neutral (never faked). */
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
  // The STATE shard (index 0) is the listing gate: its content hash is computed
  // on-chain at mint, so a recorded non-zero hash genuinely means it matches.
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
    genre: "Generative", // not on-chain; neutral default
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

const TRANSFER_EVENT = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)");
export const LOG_WINDOW = BigInt(2000);
// ~240k blocks of lookback (≈5–6 days on Base Sepolia). Without an indexer we
// scan recent history bounded below by the contract's deploy block — covering
// every token while the deploy is recent. Older activity needs the full indexer.
export const MAX_WINDOWS = 120;

// ForeverLibrary deploy blocks — the lower bound for log scans (no Transfer can
// predate the contract). Keep in sync with the deployed addresses.
export const FL_DEPLOY_BLOCK: Record<number, bigint> = {
  84532: BigInt(42258311),
  11155111: BigInt(10965380),
};

/** Where to start a Transfer-log scan: the deploy block, or a recent lookback
 *  window if the contract has been live longer than the cap can cover. */
export function scanStartBlock(chainId: number, latest: bigint): bigint {
  const floor = FL_DEPLOY_BLOCK[chainId] ?? BigInt(0);
  const lookback = latest - BigInt(MAX_WINDOWS) * LOG_WINDOW;
  return lookback > floor ? lookback : floor;
}

async function readShards(pub: PublicClient, fl: Hex, tokenId: bigint): Promise<RawShard[]> {
  const count = Number(await pub.readContract({ address: fl, abi: FOREVER_LIBRARY_ABI, functionName: "shardCount", args: [tokenId] }));
  const out: RawShard[] = [];
  for (let i = 0; i < count; i++) {
    const idx = BigInt(i);
    try {
      const [backend, uri, contentHash] = await Promise.all([
        pub.readContract({ address: fl, abi: FOREVER_LIBRARY_ABI, functionName: "shardBackend", args: [tokenId, idx] }),
        pub.readContract({ address: fl, abi: FOREVER_LIBRARY_ABI, functionName: "shardURI", args: [tokenId, idx] }),
        pub.readContract({ address: fl, abi: FOREVER_LIBRARY_ABI, functionName: "shardContentHash", args: [tokenId, idx] }),
      ]);
      out.push({ index: i, backend: Number(backend), uri: uri as string, contentHash: contentHash as string });
    } catch {
      // Isolate a single shard's read failure (RPC blip) — show the rest
      // rather than 500-ing the whole token page.
    }
  }
  return out;
}

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
  // Transfer logs are sparse; scan in windows up to latest (cap for safety).
  for (let w = 0; w < MAX_WINDOWS && from <= latest; w++) {
    const to = from + LOG_WINDOW - BigInt(1) > latest ? latest : from + LOG_WINDOW - BigInt(1);
    const logs = await pub.getLogs({ address: contract, event: TRANSFER_EVENT, args: { tokenId }, fromBlock: from, toBlock: to });
    for (const l of logs) raw.push({ from: l.args.from, to: l.args.to, blockNumber: l.blockNumber as bigint });
    from = to + BigInt(1);
  }
  // Resolve real block timestamps (one getBlock per unique block).
  const ts = new Map<string, string>();
  await Promise.all(
    [...new Set(raw.map((r) => r.blockNumber.toString()))].map(async (bn) => {
      try {
        const block = await pub.getBlock({ blockNumber: BigInt(bn) });
        ts.set(bn, new Date(Number(block.timestamp) * 1000).toISOString());
      } catch {
        /* leave unset → fall back below */
      }
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

export async function readOnchainToken(chainId: number, contract: Hex, tokenId: bigint): Promise<Token | null> {
  const pub = serverPublicClient(chainId);
  if (!pub) return null;
  let owner: string;
  try {
    owner = (await pub.readContract({ address: contract, abi: FOREVER_LIBRARY_ABI, functionName: "ownerOf", args: [tokenId] })) as string;
  } catch {
    return null; // unminted / nonexistent
  }
  // Read replicas can lag: a token may have `ownerOf` resolved on one node but
  // `getMintData`/etc not yet on another. Guard the whole read so one lagging
  // token is skipped (return null) instead of rejecting the Promise.all and
  // dropping the ENTIRE collection's feed.
  try {
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
    // The on-chain views coerce 0→1, so `es` is always ≥1. A plain 1-of-1 must
    // NOT report editionSize: 1 — only expose edition fields when es > 1.
    const es = Number(editionSizeRaw as bigint);
    const ei = Number(editionIndexRaw as bigint);
    return mapMintToToken({
      chainId, tokenId, contract, owner, mint: m, locked: locked as boolean,
      selectedShardIndex: selectedShardIndex as bigint, hostingFeeBps: Number(hostingFeeBps),
      shards, provenance,
      editionSize: es > 1 ? es : undefined,
      editionIndex: es > 1 ? ei : undefined,
    });
  } catch {
    return null; // lagging replica / transient RPC failure — skip this token, keep the feed
  }
}

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
  // Filter to tokens still owned by `owner`.
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
