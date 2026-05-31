/**
 * On-chain integration test for the LogLedger relayer + reconstruction.
 *
 * Gated behind RUN_LOGLEDGER_E2E=1 (sends REAL Base Sepolia txs from the relayer
 * wallet), so a normal `npm test` skips it. Run it with:
 *   RUN_LOGLEDGER_E2E=1 npm test -- relayer.integration
 * Reads secrets/addresses from .env.local directly (vitest doesn't load it).
 */
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import {
  createPublicClient,
  http,
  parseAbiItem,
  hexToBytes,
  type Hex,
} from "viem";
import { baseSepolia } from "viem/chains";

const RUN = process.env.RUN_LOGLEDGER_E2E === "1";
const CHAIN_ID = 84532;

function loadEnvLocal() {
  let text: string;
  try {
    text = readFileSync(".env.local", "utf8");
  } catch {
    return;
  }
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!m) continue;
    const key = m[1];
    const val = m[2].trim().replace(/^["']|["']$/g, "");
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

describe.runIf(RUN)("LogLedger relayer (on-chain Base Sepolia)", () => {
  beforeAll(() => {
    loadEnvLocal();
  });

  it(
    "publishes a fixture and reconstructs+verifies it from chain logs",
    async () => {
      // Imported lazily so env is populated before serverEnv() is first read.
      const { publishToLogLedger } = await import("./relayer");
      const { reconstructFile } = await import("./index");
      const { keccak256 } = await import("viem");

      // Deterministic ~30 KB fixture (mime image/png → raw codec → multi-chunk).
      const text = "perpetual-logledger-e2e-v1-";
      const buf = new TextEncoder().encode(text.repeat(1200)); // ~32 KB
      const bytes = buf.subarray(0, 30_000);
      const contentHash = keccak256(bytes);

      const res = await publishToLogLedger({
        chainId: CHAIN_ID,
        bytes,
        contentHash,
        mime: "image/png",
      });
      expect(res.ok, res.error).toBe(true);
      expect(res.sealed).toBe(true);
      expect(res.ledger).toBeDefined();
      expect(res.fileId).toBeDefined();

      // Reconstruct from the REAL chain: read commitment + FileChunk logs.
      const ledger = res.ledger as Hex;
      const fileId = res.fileId as Hex;
      const rpc = process.env.RPC_BASE_SEPOLIA;
      const pub = createPublicClient({ chain: baseSepolia, transport: http(rpc) });

      const { LOG_LEDGER_ABI } = await import("@/lib/web3/abis");
      // Tolerate public-RPC read-replica lag: poll files() until finalized.
      const readFile = () =>
        pub.readContract({
          address: ledger,
          abi: LOG_LEDGER_ABI,
          functionName: "files",
          args: [fileId],
        }) as Promise<readonly [Hex, bigint, number, number, number, boolean, Hex]>;
      let file = await readFile();
      for (let attempt = 0; attempt < 15 && !file[5]; attempt++) {
        await new Promise((r) => setTimeout(r, 2000));
        file = await readFile();
      }
      expect(file[5], "file finalized on-chain").toBe(true);

      const chunkEvent = parseAbiItem(
        "event FileChunk(bytes32 indexed fileId, uint32 indexed chunkIndex, bytes data)",
      );
      const logs = await pub.getLogs({
        address: ledger,
        event: chunkEvent,
        args: { fileId },
        fromBlock: BigInt(file[3]), // deployBlock
        toBlock: "latest",
      });
      // Dedup by index (keep last) in case of a re-run partial upload.
      const byIndex = new Map<number, Uint8Array>();
      for (const l of logs) {
        byIndex.set(Number(l.args.chunkIndex), hexToBytes(l.args.data as Hex));
      }
      const rawChunks = [...byIndex.entries()].map(([index, data]) => ({ index, data }));

      const out = await reconstructFile({
        readFile: async () => ({
          root: file[0],
          size: file[1],
          chunks: Number(file[2]),
          codec: Number(file[4]) as 0 | 1 | 2 | 3,
          finalized: file[5],
        }),
        getChunks: async () => rawChunks,
      });

      expect(Array.from(out)).toEqual(Array.from(bytes));
    },
    240_000,
  );
});
