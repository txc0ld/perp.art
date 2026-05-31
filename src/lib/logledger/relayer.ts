import "server-only";
import {
  createWalletClient,
  createPublicClient,
  http,
  bytesToHex,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia, sepolia } from "viem/chains";
import { chunkBytes, merkleRoot, compress, computeFileId, pickCodec, type CodecValue } from "@/lib/logledger";
import { LOG_LEDGER_ABI } from "@/lib/web3/abis";
import { getContracts } from "@/lib/web3/contracts";
import { serverEnv } from "@/lib/env";

/** Result of publishing the high-res copy to a LogLedger (one per request). */
export interface LogPublishResult {
  ok: boolean;
  ledger?: Hex;
  fileId?: Hex;
  root?: Hex;
  size?: number;
  chunks?: number;
  codec?: number;
  sealed?: boolean;
  uri?: string; // log://<ledger>/<fileId>
  error?: string;
}

const ZERO = "0x0000000000000000000000000000000000000000";
const CHAINS: Record<number, typeof baseSepolia | typeof sepolia> = {
  84532: baseSepolia,
  11155111: sepolia,
};

function rpcFor(chainId: number): string | undefined {
  const env = serverEnv();
  if (chainId === 84532) return env.rpcBaseSepolia;
  if (chainId === 11155111) return env.rpcSepolia;
  return undefined;
}

/**
 * Publish the artwork's high-res copy to the chain's LogLedger via the relayer
 * wallet: compress → chunk → Merkle root, then open → upload×N → seal. fileId is
 * content-bound (collection, contentHash, version 0), so a re-mint of identical
 * bytes that is already sealed short-circuits. Returns a sealed commitment the
 * caller records as the token's Log shard. Server-only.
 */
export async function publishToLogLedger(params: {
  chainId: number;
  bytes: Uint8Array;
  contentHash: Hex;
  mime: string;
  /** fileId version (0 at mint; bumped for a re-emission of identical bytes). */
  version?: number;
  /** Force a codec (re-emission reuses the original's codec to reproduce the
   *  exact same Merkle root); defaults to pickCodec(mime). */
  codec?: CodecValue;
}): Promise<LogPublishResult> {
  const { chainId, bytes, contentHash, mime, version = 0 } = params;
  const env = serverEnv();
  const chain = CHAINS[chainId];
  const { logLedger: ledger, foreverLibrary: collection } = getContracts(chainId);

  if (!env.logLedgerRelayerPk) return { ok: false, error: "LOGLEDGER_RELAYER_PK not set" };
  if (!chain || !ledger || !collection) {
    return { ok: false, error: `LogLedger not configured for chain ${chainId}` };
  }

  try {
    const pk = (env.logLedgerRelayerPk.startsWith("0x")
      ? env.logLedgerRelayerPk
      : `0x${env.logLedgerRelayerPk}`) as Hex;
    const account = privateKeyToAccount(pk);
    const transport = http(rpcFor(chainId));
    const wallet = createWalletClient({ account, chain, transport });
    const pub = createPublicClient({ chain, transport });

    const codec = params.codec ?? pickCodec(mime);
    const compressed = compress(bytes, codec);
    const chunks = chunkBytes(compressed);
    const root = merkleRoot(chunks);
    const fileId = computeFileId(collection, contentHash, version);
    const uri = `log://${ledger}/${fileId}`;

    // Existing state: [root, size, chunks, deployBlock, codec, finalized, author]
    const existing = await pub.readContract({
      address: ledger,
      abi: LOG_LEDGER_ABI,
      functionName: "files",
      args: [fileId],
    });
    const finalized = existing[5] as boolean;
    const author = (existing[6] as string).toLowerCase();

    // Already sealed (identical content re-minted) → reuse it.
    if (finalized) {
      return {
        ok: true,
        ledger,
        fileId,
        root: existing[0] as Hex,
        size: Number(existing[1]),
        chunks: Number(existing[2]),
        codec: Number(existing[4]),
        sealed: true,
        uri,
      };
    }

    // Someone else owns this fileId and hasn't sealed → we cannot publish.
    if (author !== ZERO && author !== account.address.toLowerCase()) {
      return { ok: false, error: "fileId owned by another author", ledger, fileId };
    }

    // Explicit gas limits so viem skips eth_estimateGas. Estimation can hit a
    // lagging RPC replica that hasn't seen the just-mined `open` and spuriously
    // reverts (NotOpened) before sending; an explicit limit avoids the estimate
    // entirely and the tx mines against canonical state.
    const send = async (functionName: "open" | "upload" | "seal", args: readonly unknown[], gas: bigint) => {
      const hash = await wallet.writeContract({
        address: ledger,
        abi: LOG_LEDGER_ABI,
        functionName,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        args: args as any,
        gas,
      });
      const receipt = await pub.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error(`${functionName} reverted (tx ${hash})`);
    };

    if (author === ZERO) await send("open", [fileId], BigInt(120_000));

    for (let i = 0; i < chunks.length; i++) {
      const data = chunks[i];
      // ~16 gas/calldata byte + ~8 gas/log-data byte + overhead.
      await send("upload", [fileId, i, bytesToHex(data)], BigInt(150_000) + BigInt(60) * BigInt(data.byteLength));
    }

    await send("seal", [fileId, root, BigInt(compressed.length), chunks.length, codec], BigInt(200_000));

    return {
      ok: true,
      ledger,
      fileId,
      root,
      size: compressed.length,
      chunks: chunks.length,
      codec,
      sealed: true,
      uri,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "relayer error" };
  }
}
