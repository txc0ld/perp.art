"use client";

import * as React from "react";
import { useAccount, useChainId } from "wagmi";
import { writeContract, waitForTransactionReceipt } from "@wagmi/core";
import { keccak256, stringToBytes, bytesToHex, decodeEventLog } from "viem";
import { upload } from "@vercel/blob/client";
import { wagmiConfig } from "@/lib/web3/config";
import { getContracts } from "@/lib/web3/contracts";
import { FOREVER_LIBRARY_ABI, SHARD_BACKEND } from "@/lib/web3/abis";
import { resolveShardUrl } from "@/lib/logledger/resolve-url";
import { generateStateProof } from "@/lib/proof/state-proof";
import { cleanTraits, type MintForm } from "./state";

export type ShardPhase = "idle" | "storing" | "minting" | "recording" | "done" | "error";

export interface ShardRecord {
  backend: "onchain" | "log" | "ipfs" | "arweave" | "irys";
  stored: boolean; // bytes persisted to this backend
  recorded: boolean; // recorded on-chain as a shard
  uri?: string;
  gateway?: string;
  error?: string;
}

interface OffchainShardResult {
  ok: boolean;
  uri?: string;
  gateway?: string;
  error?: string;
}

interface LogLedgerResult {
  ok: boolean;
  ledger?: `0x${string}`;
  fileId?: `0x${string}`;
  root?: `0x${string}`;
  sealed?: boolean;
  uri?: string;
  error?: string;
}

interface StoreResponse {
  contentHash: `0x${string}`;
  mediaType: string;
  ipfs: OffchainShardResult;
  arweave: OffchainShardResult;
  irys: OffchainShardResult;
  logLedger: LogLedgerResult;
}

export function useOnchainMint() {
  const { address } = useAccount();
  const chainId = useChainId();
  const fl = getContracts(chainId).foreverLibrary;

  const [phase, setPhase] = React.useState<ShardPhase>("idle");
  const [mintTxHash, setMintTxHash] = React.useState<`0x${string}`>();
  const [tokenId, setTokenId] = React.useState<string>();
  const [shards, setShards] = React.useState<ShardRecord[]>([]);
  const [uploadPct, setUploadPct] = React.useState(0);
  const [error, setError] = React.useState<string>();

  function reset() {
    setPhase("idle");
    setMintTxHash(undefined);
    setTokenId(undefined);
    setShards([]);
    setUploadPct(0);
    setError(undefined);
  }

  async function start(form: MintForm): Promise<void> {
    if (!address || !fl) {
      setError("Connect a wallet on a supported network.");
      setPhase("error");
      return;
    }
    if (!form.file) {
      setError("Add your artwork file before minting.");
      setPhase("error");
      return;
    }
    setError(undefined);

    const originalMime = form.fileMime || form.file.type || "application/octet-stream";
    const royaltyBps = Math.round(Math.min(Math.max(form.royaltyPct, 0), 100) * 100);

    // 1) Store the artist's actual file across the off-chain shards AND publish
    //    the high-res LOG copy (server relayer open/upload/seal).
    setPhase("storing");
    setUploadPct(0);
    let store: StoreResponse;
    try {
      const blob = await upload(form.fileName || "artwork", form.file, {
        access: "public",
        handleUploadUrl: "/api/upload",
        contentType: originalMime,
        multipart: form.file.size > 8_000_000,
        onUploadProgress: (p) => setUploadPct(Math.round(p.percentage)),
      });
      const res = await fetch("/api/store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blobUrl: blob.url,
          name: form.title,
          description: form.description,
          genre: form.genre,
          mediaType: originalMime,
          fileName: form.fileName || "artwork",
          traits: cleanTraits(form),
          chainId,
        }),
      });
      if (!res.ok) throw new Error(`storage failed (${res.status})`);
      store = (await res.json()) as StoreResponse;
    } catch (e) {
      setError(e instanceof Error ? e.message : "storage failed");
      setPhase("error");
      return;
    }

    const contentHash = store.contentHash;

    // 2) Generate the on-chain STATE proof (Shard 0) bytes: a small image the
    //    contract serves as a data: URI. Image→downscale, video→poster, else→
    //    SVG cover-card. Always <= MAX_PROOF_BYTES.
    let proofData: `0x${string}`;
    let proofMime: string;
    try {
      const proof = await generateStateProof(form.file, {
        title: form.title,
        artist: form.artistName,
        contentHash,
      });
      proofData = bytesToHex(proof.bytes);
      proofMime = proof.mime;
    } catch (e) {
      setError(e instanceof Error ? e.message : "could not build the on-chain proof");
      setPhase("error");
      return;
    }

    // Off-chain shard display records.
    const offchain: ShardRecord[] = [
      { backend: "ipfs", stored: store.ipfs.ok, recorded: false, uri: store.ipfs.uri, gateway: store.ipfs.gateway, error: store.ipfs.error },
      { backend: "arweave", stored: store.arweave.ok, recorded: false, uri: store.arweave.uri, gateway: store.arweave.gateway, error: store.arweave.error },
      { backend: "irys", stored: store.irys.ok, recorded: false, uri: store.irys.uri, gateway: store.irys.gateway, error: store.irys.error },
    ];
    const log = store.logLedger;
    const logShard: ShardRecord = {
      backend: "log",
      stored: Boolean(log?.sealed),
      recorded: false,
      uri: log?.uri,
      // Resolve the high-res LOG copy through the reconstruct+verify endpoint.
      gateway: log?.uri ? resolveShardUrl(log.uri, { mime: originalMime, chainId }) : undefined,
      error: log?.ok ? undefined : log?.error,
    };
    // Shard 0 (STATE) is written on-chain by mint itself.
    const stateShard: ShardRecord = { backend: "onchain", stored: true, recorded: true };
    setShards([stateShard, logShard, ...offchain]);

    // metadataHash anchors the canonical off-chain metadata for verification.
    const metadataHash = keccak256(
      stringToBytes(
        JSON.stringify({
          name: form.title,
          artist: form.artistName,
          image: store.ipfs.uri || store.arweave.uri || store.irys.uri || "",
          hash: contentHash,
          genre: form.genre,
          mediaType: originalMime,
        }),
      ),
    );

    // 3) Mint — writes provenance + the SSTORE2 STATE proof (Shard 0). The
    //    mint mediaType is the PROOF's mime so Shard 0 resolves as a data: URI;
    //    the artwork's true media type lives in the off-chain metadata + LOG.
    //    hostingFeeBps 0 == artist-paid/fee-exempt (storageFeeWei is 0).
    setPhase("minting");
    let mintHash: `0x${string}`;
    let newTokenId: bigint | undefined;
    try {
      mintHash = await writeContract(wagmiConfig, {
        address: fl,
        abi: FOREVER_LIBRARY_ABI,
        functionName: "mint",
        args: [address, form.artistName, form.title, proofMime, BigInt(royaltyBps), metadataHash, proofData, 0],
        value: BigInt(0),
      });
      setMintTxHash(mintHash);
      const receipt = await waitForTransactionReceipt(wagmiConfig, { hash: mintHash });
      for (const logItem of receipt.logs) {
        try {
          const d = decodeEventLog({ abi: FOREVER_LIBRARY_ABI, data: logItem.data, topics: logItem.topics });
          if (d.eventName === "TokenMinted") {
            newTokenId = (d.args as { tokenId: bigint }).tokenId;
            break;
          }
        } catch {
          /* not our event */
        }
      }
      if (newTokenId !== undefined) setTokenId(newTokenId.toString());
    } catch (e) {
      setError(/denied|rejected/i.test(String(e)) ? "Transaction rejected in wallet." : (e instanceof Error ? e.message.split("\n")[0] : "mint failed"));
      setPhase("error");
      return;
    }

    // 4) Record the redundant shards on-chain (append). LOG first (the high-res
    //    primary), then the off-chain copies. Shard 0 (STATE) already exists.
    setPhase("recording");
    if (newTokenId !== undefined) {
      let nextIndex = 1;
      const appended = [stateShard, logShard, ...offchain];

      const recordShard = async (
        shard: ShardRecord,
        backendId: number,
        uri: string,
        shardContentHash: `0x${string}`,
      ) => {
        try {
          const h = await writeContract(wagmiConfig, {
            address: fl,
            abi: FOREVER_LIBRARY_ABI,
            functionName: "configureShard",
            args: [newTokenId!, BigInt(nextIndex), backendId, uri, shardContentHash],
            // Explicit gas skips estimation, which can spuriously revert
            // (TokenDoesNotExist) if the wallet RPC hasn't yet indexed the mint.
            gas: BigInt(450_000),
          });
          await waitForTransactionReceipt(wagmiConfig, { hash: h });
          shard.recorded = true;
          nextIndex++;
        } catch {
          shard.error = "not recorded onchain";
        }
        setShards([...appended]);
      };

      if (log?.sealed && log.uri && log.root) {
        await recordShard(logShard, SHARD_BACKEND.log, log.uri, log.root);
      }
      for (const shard of offchain) {
        if (!shard.stored || !shard.uri) continue;
        const backendId = SHARD_BACKEND[shard.backend];
        await recordShard(shard, backendId, shard.uri, contentHash);
      }
      setShards([...appended]);
    }

    setPhase("done");
  }

  return {
    start,
    reset,
    phase,
    mintTxHash,
    tokenId,
    shards,
    uploadPct,
    error,
    chainId,
    canMintOnchain: Boolean(fl && address),
  };
}
