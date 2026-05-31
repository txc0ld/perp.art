import "server-only";
import { createPublicClient, http, parseAbiItem, hexToBytes, keccak256, type Hex, type PublicClient } from "viem";
import { baseSepolia, sepolia } from "viem/chains";
import { reconstructFile, computeFileId, type RawChunk, type CodecValue } from "@/lib/logledger";
import { publishToLogLedger } from "@/lib/logledger/relayer";
import { LOG_LEDGER_ABI } from "@/lib/web3/abis";
import { getContracts } from "@/lib/web3/contracts";
import { serverEnv } from "@/lib/env";

const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

const SUPPORTED = [84532, 11155111] as const;
const CHAINS: Record<number, typeof baseSepolia | typeof sepolia> = {
  84532: baseSepolia,
  11155111: sepolia,
};
const CHUNK_EVENT = parseAbiItem(
  "event FileChunk(bytes32 indexed fileId, uint32 indexed chunkIndex, bytes data)",
);

/** Reverse-map a LogLedger address to its chain id via the deployed registry. */
export function chainIdForLedger(ledger: string): number | undefined {
  const l = ledger.toLowerCase();
  for (const id of SUPPORTED) {
    const reg = getContracts(id).logLedger;
    if (reg && reg.toLowerCase() === l) return id;
  }
  return undefined;
}

/** Best-effort Content-Type from magic bytes (LogLedger stores codec, not MIME). */
export function sniffMime(b: Uint8Array): string {
  if (b.length >= 4 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 4 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return "image/gif";
  if (
    b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  ) return "image/webp";
  if (b.length >= 8 && b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) return "video/mp4";
  const head = new TextDecoder().decode(b.slice(0, 256)).trimStart().toLowerCase();
  if (head.startsWith("<svg") || (head.startsWith("<?xml") && head.includes("<svg"))) return "image/svg+xml";
  return "application/octet-stream";
}

type FileTuple = readonly [Hex, bigint, number, number, number, boolean, Hex];

function rpcsFor(chainId: number): (string | undefined)[] {
  const env = serverEnv();
  const configured = chainId === 84532 ? env.rpcBaseSepolia : chainId === 11155111 ? env.rpcSepolia : undefined;
  // configured first, then the chain default public RPC (a distinct second source).
  const list: (string | undefined)[] = [configured, undefined];
  return list.filter((v, i) => list.indexOf(v) === i);
}

async function readFileTuple(pub: PublicClient, ledger: Hex, fileId: Hex): Promise<FileTuple> {
  return (await pub.readContract({
    address: ledger,
    abi: LOG_LEDGER_ABI,
    functionName: "files",
    args: [fileId],
  })) as FileTuple;
}

// Public RPCs cap eth_getLogs to a bounded block range (e.g. 2000). Scan in
// windows from deployBlock and stop as soon as all expected chunks are found
// (open→upload→seal completes within one function invocation, so events sit in
// a tight window just after deployBlock).
const LOG_WINDOW = BigInt(2000);
const MAX_WINDOWS = 50; // safety cap (~100k blocks) before giving up

async function readChunks(
  pub: PublicClient,
  ledger: Hex,
  fileId: Hex,
  fromBlock: number,
  expectedChunks: number,
): Promise<RawChunk[]> {
  const latest = await pub.getBlockNumber();
  const byIndex = new Map<number, Uint8Array>();
  let from = BigInt(fromBlock);
  for (let w = 0; w < MAX_WINDOWS && from <= latest; w++) {
    const windowEnd = from + LOG_WINDOW - BigInt(1);
    const to = windowEnd > latest ? latest : windowEnd;
    const logs = await pub.getLogs({ address: ledger, event: CHUNK_EVENT, args: { fileId }, fromBlock: from, toBlock: to });
    for (const l of logs) byIndex.set(Number(l.args.chunkIndex), hexToBytes(l.args.data as Hex));
    if (byIndex.size >= expectedChunks) break; // got them all (dedup by index)
    from = to + BigInt(1);
  }
  return [...byIndex.entries()].map(([index, data]) => ({ index, data }));
}

export interface LoadedShard {
  bytes: Uint8Array;
  root: Hex;
  codec: number;
  size: number;
  mime: string;
}

/** Max re-emitted versions the resolver will probe when the original is gone. */
const MAX_REEMIT_VERSIONS = 3;

/** Reconstruct + verify ONE fileId across the given providers (root agreement
 *  + Merkle verify). Throws if that fileId is unavailable. */
async function loadOneFileId(
  clients: PublicClient[],
  ledger: Hex,
  fileId: Hex,
  mime?: string,
): Promise<LoadedShard> {
  // Read commitments from all providers; require root agreement (a single
  // lying/pruning provider cannot forge the canonical root).
  const tuples: FileTuple[] = [];
  for (const pub of clients) {
    try {
      tuples.push(await readFileTuple(pub, ledger, fileId));
    } catch {
      /* skip a provider that fails to respond */
    }
  }
  if (tuples.length === 0) throw new Error("log shard: no RPC responded");
  if (new Set(tuples.map((t) => t[0].toLowerCase())).size > 1) {
    throw new Error("log shard: RPC root disagreement");
  }
  const committed = tuples[0];
  if (!committed[5]) throw new Error("log shard not sealed");

  let lastErr: unknown;
  for (const pub of clients) {
    try {
      const rawChunks = await readChunks(pub, ledger, fileId, committed[3], Number(committed[2]));
      const bytes = await reconstructFile({
        readFile: async () => ({
          root: committed[0],
          size: committed[1],
          chunks: Number(committed[2]),
          codec: Number(committed[4]) as CodecValue,
          finalized: committed[5],
        }),
        getChunks: async () => rawChunks,
      });
      return { bytes, root: committed[0], codec: Number(committed[4]), size: Number(committed[1]), mime: mime || sniffMime(bytes) };
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("log shard unavailable");
}

/**
 * Reconstruct + verify a LOG shard from chain. Tries the requested fileId first;
 * if it's unavailable (logs pruned per EIP-4444) and `contentHash` is known,
 * falls back to re-emitted versions (same bytes → same root → same verification)
 * so a re-published copy transparently restores the high-res view. Throws if
 * nothing is recoverable, so the caller can fall back to the STATE shard.
 */
export async function loadAndVerifyLogShard(params: {
  ledger: Hex;
  fileId: Hex;
  chainId?: number;
  mime?: string;
  contentHash?: Hex;
}): Promise<LoadedShard> {
  const chainId = params.chainId ?? chainIdForLedger(params.ledger);
  const chain = chainId ? CHAINS[chainId] : undefined;
  if (!chain || !chainId) throw new Error(`unknown LogLedger chain for ${params.ledger}`);

  const clients = rpcsFor(chainId).map(
    (rpc) => createPublicClient({ chain, transport: http(rpc) }) as PublicClient,
  );

  const candidates: Hex[] = [params.fileId];
  const collection = getContracts(chainId).foreverLibrary;
  if (params.contentHash && collection) {
    for (let v = 1; v <= MAX_REEMIT_VERSIONS; v++) {
      candidates.push(computeFileId(collection, params.contentHash, v));
    }
  }

  let lastErr: unknown;
  for (const fid of candidates) {
    try {
      return await loadOneFileId(clients, params.ledger, fid, params.mime);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("log shard unavailable");
}

/**
 * Re-emission tool (resilience capstone): if a token's LOG copy has been pruned,
 * re-publish the SAME bytes under a fresh version. Identical bytes → identical
 * Merkle root → it verifies against the original commitment, so anyone holding
 * the bytes (from a surviving IPFS/Arweave/Irys copy) can trustlessly restore
 * the on-chain high-res copy. Fetches from `sourceUrl`, verifies the content
 * hash before re-emitting, and confirms the re-emitted root equals the original.
 */
export async function reEmitLogShard(params: {
  chainId: number;
  contentHash: Hex;
  sourceUrl: string;
  version?: number;
}): Promise<{ ok: boolean; fileId?: Hex; version?: number; root?: Hex; matchesOriginal?: boolean; error?: string }> {
  const { chainId, contentHash, sourceUrl } = params;
  const chain = CHAINS[chainId];
  const collection = getContracts(chainId).foreverLibrary;
  const ledger = getContracts(chainId).logLedger;
  if (!chain || !collection || !ledger) return { ok: false, error: `LogLedger not configured for chain ${chainId}` };

  try {
    // 1) Fetch the authentic bytes from a surviving copy and verify the hash.
    const res = await fetch(sourceUrl);
    if (!res.ok) return { ok: false, error: `source fetch ${res.status}` };
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (keccak256(bytes).toLowerCase() !== contentHash.toLowerCase()) {
      return { ok: false, error: "source bytes do not match contentHash" };
    }

    // 2) Read the original (version 0) commitment: its codec MUST be reused so
    //    the re-emitted Merkle root reproduces the original exactly.
    const pub = createPublicClient({ chain, transport: http(rpcsFor(chainId)[0]) }) as PublicClient;
    const original = await readFileTuple(pub, ledger, computeFileId(collection, contentHash, 0));
    const originalCodec = Number(original[4]) as CodecValue;
    const originalRoot = original[0];

    // 3) Pick a fresh (never-opened) version so new logs are actually emitted.
    let version = params.version;
    if (version === undefined) {
      version = MAX_REEMIT_VERSIONS; // fallback to the last slot
      for (let v = 1; v <= MAX_REEMIT_VERSIONS; v++) {
        const t = await readFileTuple(pub, ledger, computeFileId(collection, contentHash, v));
        if ((t[6] as string).toLowerCase() === ZERO_ADDR) { version = v; break; }
      }
    }

    // 4) Re-emit with the original codec. Same bytes + same codec → same root.
    const pubRes = await publishToLogLedger({ chainId, bytes, contentHash, mime: sniffMime(bytes), version, codec: originalCodec });
    if (!pubRes.ok) return { ok: false, error: pubRes.error };

    const matchesOriginal = originalRoot.toLowerCase() === (pubRes.root ?? "").toLowerCase();
    return { ok: true, fileId: pubRes.fileId, version, root: pubRes.root, matchesOriginal };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "re-emit failed" };
  }
}

/** Lightweight availability probe for the retention job. Never throws. */
export async function checkLogAvailability(ledger: Hex, fileId: Hex, chainId?: number): Promise<{ available: boolean; error?: string }> {
  try {
    await loadAndVerifyLogShard({ ledger, fileId, chainId });
    return { available: true };
  } catch (e) {
    return { available: false, error: e instanceof Error ? e.message : "unavailable" };
  }
}
