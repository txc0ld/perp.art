/**
 * Full-pipeline on-chain test against the DEPLOYED Base Sepolia contracts:
 * publish LOG copy → mint (SSTORE2 STATE proof) → record Log shard → read back
 * tokenURI (on-chain data: URI) + reconstruct the LOG shard from chain.
 *
 * Gated behind RUN_LOGLEDGER_E2E=1 (sends REAL txs from the relayer wallet, which
 * is also the minter — mint is permissionless). Run:
 *   RUN_LOGLEDGER_E2E=1 npm test -- full-pipeline.integration
 */
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import {
  createWalletClient,
  createPublicClient,
  http,
  bytesToHex,
  hexToBytes,
  keccak256,
  parseAbiItem,
  decodeEventLog,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
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
    const val = m[2].trim().replace(/^["']|["']$/g, "");
    if (process.env[m[1]] === undefined) process.env[m[1]] = val;
  }
}

describe.runIf(RUN)("full mint pipeline (on-chain Base Sepolia)", () => {
  beforeAll(() => loadEnvLocal());

  it(
    "mints with SSTORE2 proof, records the Log shard, and round-trips both",
    async () => {
      const { publishToLogLedger } = await import("@/lib/logledger/relayer");
      const { reconstructFile } = await import("@/lib/logledger");
      const { buildCoverCardSvg } = await import("@/lib/proof/state-proof");
      const { FOREVER_LIBRARY_ABI, LOG_LEDGER_ABI, SHARD_BACKEND } = await import("@/lib/web3/abis");
      const { getContracts } = await import("@/lib/web3/contracts");

      const pk = (process.env.LOGLEDGER_RELAYER_PK!.startsWith("0x")
        ? process.env.LOGLEDGER_RELAYER_PK!
        : `0x${process.env.LOGLEDGER_RELAYER_PK}`) as Hex;
      const account = privateKeyToAccount(pk);
      const transport = http(process.env.RPC_BASE_SEPOLIA);
      const wallet = createWalletClient({ account, chain: baseSepolia, transport });
      const pub = createPublicClient({ chain: baseSepolia, transport });
      const fl = getContracts(CHAIN_ID).foreverLibrary!;
      expect(fl, "ForeverLibrary configured").toBeDefined();

      // Unique high-res LOG payload per run so we exercise a fresh publish.
      const stamp = `e2e-${process.env.GITHUB_SHA ?? ""}-${account.address}`;
      const artwork = new TextEncoder().encode(`perpetual-full-pipeline-${stamp}-`.repeat(900));
      const contentHash = keccak256(artwork);

      const log = await publishToLogLedger({ chainId: CHAIN_ID, bytes: artwork, contentHash, mime: "image/png" });
      expect(log.ok, log.error).toBe(true);
      expect(log.sealed).toBe(true);

      // STATE proof: the deterministic SVG cover-card (always an image).
      const proofBytes = buildCoverCardSvg({ title: "E2E Title", artist: "E2E Artist", contentHash });
      const metadataHash = keccak256(new TextEncoder().encode(`meta-${contentHash}`));

      // Mint (Shard 0 = SSTORE2 STATE proof). hostingFeeBps 0, value 0.
      const mintHash = await wallet.writeContract({
        address: fl,
        abi: FOREVER_LIBRARY_ABI,
        functionName: "mint",
        args: [account.address, "E2E Artist", "E2E Title", "image/svg+xml", BigInt(500), metadataHash, bytesToHex(proofBytes), 0],
        value: BigInt(0),
      });
      const mintReceipt = await pub.waitForTransactionReceipt({ hash: mintHash });
      expect(mintReceipt.status).toBe("success");

      let tokenId: bigint | undefined;
      for (const lg of mintReceipt.logs) {
        try {
          const d = decodeEventLog({ abi: FOREVER_LIBRARY_ABI, data: lg.data, topics: lg.topics });
          if (d.eventName === "TokenMinted") {
            tokenId = (d.args as { tokenId: bigint }).tokenId;
            break;
          }
        } catch {
          /* not our event */
        }
      }
      expect(tokenId, "TokenMinted emitted a tokenId").toBeDefined();

      // Wait for the mint to be readable (public RPC replica lag) before configuring.
      const isConfigured = () =>
        pub.readContract({ address: fl, abi: FOREVER_LIBRARY_ABI, functionName: "shard0Configured", args: [tokenId!] }) as Promise<boolean>;
      for (let i = 0; i < 15 && !(await isConfigured()); i++) {
        await new Promise((r) => setTimeout(r, 2000));
      }

      // Record the Log shard at index 1 (relayer == creator, so onlyCreator OK).
      // Explicit gas skips estimation (which can revert on a lagging replica).
      const cfgHash = await wallet.writeContract({
        address: fl,
        abi: FOREVER_LIBRARY_ABI,
        functionName: "configureShard",
        args: [tokenId!, BigInt(1), SHARD_BACKEND.log, log.uri!, log.root!],
        gas: BigInt(400_000),
      });
      expect((await pub.waitForTransactionReceipt({ hash: cfgHash })).status).toBe("success");

      // Shard 0 (STATE) resolves to an on-chain data: URI that round-trips to proofBytes.
      const tokenUri = (await pub.readContract({
        address: fl,
        abi: FOREVER_LIBRARY_ABI,
        functionName: "tokenURI",
        args: [tokenId!],
      })) as string;
      const prefix = "data:image/svg+xml;base64,";
      expect(tokenUri.startsWith(prefix)).toBe(true);
      const decoded = Buffer.from(tokenUri.slice(prefix.length), "base64");
      expect(Array.from(new Uint8Array(decoded))).toEqual(Array.from(proofBytes));

      // Shard 1 (LOG) URI points at the ledger, and reconstructs to the artwork.
      // Retry through public-RPC read lag (configureShard may not be visible yet).
      let shard1Uri = "";
      for (let i = 0; i < 15; i++) {
        try {
          shard1Uri = (await pub.readContract({
            address: fl,
            abi: FOREVER_LIBRARY_ABI,
            functionName: "shardURI",
            args: [tokenId!, BigInt(1)],
          })) as string;
          break;
        } catch {
          await new Promise((r) => setTimeout(r, 2000));
        }
      }
      expect(shard1Uri).toBe(log.uri);

      const ledger = log.ledger!;
      const fileId = log.fileId!;
      // files(): [root, size, chunks, deployBlock, nextChunk, codec, finalized, author]
      const readFile = () =>
        pub.readContract({ address: ledger, abi: LOG_LEDGER_ABI, functionName: "files", args: [fileId] }) as Promise<
          readonly [Hex, bigint, number, number, number, number, boolean, Hex]
        >;
      let file = await readFile();
      for (let i = 0; i < 15 && !file[6]; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        file = await readFile();
      }
      const chunkEvent = parseAbiItem("event FileChunk(bytes32 indexed fileId, uint32 indexed chunkIndex, bytes data)");
      const logs = await pub.getLogs({ address: ledger, event: chunkEvent, args: { fileId }, fromBlock: BigInt(file[3]), toBlock: "latest" });
      const byIndex = new Map<number, Uint8Array>();
      for (const l of logs) byIndex.set(Number(l.args.chunkIndex), hexToBytes(l.args.data as Hex));
      const rawChunks = [...byIndex.entries()].map(([index, data]) => ({ index, data }));

      const recovered = await reconstructFile({
        readFile: async () => ({ root: file[0], size: file[1], chunks: Number(file[2]), codec: Number(file[5]) as 0 | 1 | 2 | 3, finalized: file[6] }),
        getChunks: async () => rawChunks,
      });
      expect(Array.from(recovered)).toEqual(Array.from(artwork));
    },
    300_000,
  );
});
