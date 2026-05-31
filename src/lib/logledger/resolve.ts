import "server-only";
import { createPublicClient, http, parseAbiItem, hexToBytes, type Hex, type PublicClient } from "viem";
import { baseSepolia, sepolia } from "viem/chains";
import { reconstructFile, type RawChunk, type CodecValue } from "@/lib/logledger";
import { LOG_LEDGER_ABI } from "@/lib/web3/abis";
import { getContracts } from "@/lib/web3/contracts";
import { serverEnv } from "@/lib/env";

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

/**
 * Reconstruct + verify a LOG shard from chain. Reads the committed root from
 * every available RPC and requires agreement (a single lying/pruning provider
 * cannot forge the canonical root), then reconstructs from the first provider
 * whose logs verify against it. Throws if unavailable so the caller can fall
 * back to the STATE shard.
 */
export async function loadAndVerifyLogShard(params: {
  ledger: Hex;
  fileId: Hex;
  chainId?: number;
  mime?: string;
}): Promise<LoadedShard> {
  const chainId = params.chainId ?? chainIdForLedger(params.ledger);
  const chain = chainId ? CHAINS[chainId] : undefined;
  if (!chain || !chainId) throw new Error(`unknown LogLedger chain for ${params.ledger}`);

  const clients = rpcsFor(chainId).map(
    (rpc) => createPublicClient({ chain, transport: http(rpc) }) as PublicClient,
  );

  // 1) Read commitments from all providers; require root agreement.
  const tuples: FileTuple[] = [];
  for (const pub of clients) {
    try {
      tuples.push(await readFileTuple(pub, params.ledger, params.fileId));
    } catch {
      /* skip a provider that fails to respond */
    }
  }
  if (tuples.length === 0) throw new Error("log shard: no RPC responded");
  const roots = new Set(tuples.map((t) => t[0].toLowerCase()));
  if (roots.size > 1) throw new Error("log shard: RPC root disagreement");
  const committed = tuples[0];
  if (!committed[5]) throw new Error("log shard not sealed");

  // 2) Reconstruct from the first provider whose logs verify against the root.
  let lastErr: unknown;
  for (const pub of clients) {
    try {
      const rawChunks = await readChunks(pub, params.ledger, params.fileId, committed[3], Number(committed[2]));
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
      return { bytes, root: committed[0], codec: Number(committed[4]), size: Number(committed[1]), mime: params.mime || sniffMime(bytes) };
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("log shard unavailable");
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
