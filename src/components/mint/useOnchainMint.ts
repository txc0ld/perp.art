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

/** Progress counter for per-token shard recording in edition mints. */
export interface RecordingProgress {
  done: number;
  total: number;
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

  const [phase, setPhase] = React.useState<ShardPhase>("idle");
  const [mintTxHash, setMintTxHash] = React.useState<`0x${string}`>();
  const [tokenId, setTokenId] = React.useState<string>();
  /** The contract address that was actually minted into (chosen collection or canonical FL). */
  const [mintedContract, setMintedContract] = React.useState<`0x${string}` | undefined>();
  const [shards, setShards] = React.useState<ShardRecord[]>([]);
  const [uploadPct, setUploadPct] = React.useState(0);
  const [error, setError] = React.useState<string>();
  const [recordingProgress, setRecordingProgress] = React.useState<RecordingProgress | undefined>();

  function reset() {
    setPhase("idle");
    setMintTxHash(undefined);
    setTokenId(undefined);
    setMintedContract(undefined);
    setShards([]);
    setUploadPct(0);
    setError(undefined);
    setRecordingProgress(undefined);
  }

  async function start(form: MintForm): Promise<void> {
    // The target FL contract: chosen sovereign collection, or the canonical FL for this chain.
    const fl = form.collectionAddress ?? getContracts(chainId).foreverLibrary;

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
    setMintedContract(fl);

    const originalMime = form.fileMime || form.file.type || "application/octet-stream";
    const royaltyBps = Math.round(Math.min(Math.max(form.royaltyPct, 0), 100) * 100);
    const isEdition = form.mintType === "edition" && form.editionSize > 1;
    const editionSize = isEdition ? Math.max(1, Math.min(10, form.editionSize)) : 1;

    // 1) Store the artist's actual file across the off-chain shards AND publish
    //    the high-res LOG copy (server relayer open/upload/seal).
    //    For editions: ONE upload shared across all N tokens.
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

    // 2) Generate the on-chain STATE proof (Shard 0) bytes.
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

    // Off-chain shard display records (shared for editions).
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
      gateway: log?.uri ? resolveShardUrl(log.uri, { mime: originalMime, chainId, contentHash }) : undefined,
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

    // 3) Mint — writes provenance + the SSTORE2 STATE proof (Shard 0).
    setPhase("minting");
    let mintHash: `0x${string}`;
    let firstTokenId: bigint | undefined;
    try {
      if (isEdition) {
        // mintEdition returns firstTokenId; tokens are firstTokenId .. firstTokenId+editionSize-1
        mintHash = await writeContract(wagmiConfig, {
          address: fl,
          abi: FOREVER_LIBRARY_ABI,
          functionName: "mintEdition",
          args: [address, form.artistName, form.title, proofMime, BigInt(royaltyBps), metadataHash, proofData, 0, editionSize],
          value: BigInt(0),
        });
      } else {
        mintHash = await writeContract(wagmiConfig, {
          address: fl,
          abi: FOREVER_LIBRARY_ABI,
          functionName: "mint",
          args: [address, form.artistName, form.title, proofMime, BigInt(royaltyBps), metadataHash, proofData, 0],
          value: BigInt(0),
        });
      }
      setMintTxHash(mintHash);
      const receipt = await waitForTransactionReceipt(wagmiConfig, { hash: mintHash });

      // Decode the FIRST TokenMinted event for the firstTokenId.
      for (const logItem of receipt.logs) {
        try {
          const d = decodeEventLog({ abi: FOREVER_LIBRARY_ABI, data: logItem.data, topics: logItem.topics });
          if (d.eventName === "TokenMinted") {
            // For mint: args.tokenId; for mintEdition: args.tokenId is the first
            firstTokenId = (d.args as { tokenId: bigint }).tokenId;
            break;
          }
        } catch {
          /* not our event */
        }
      }
      if (firstTokenId !== undefined) setTokenId(firstTokenId.toString());
    } catch (e) {
      setError(/denied|rejected/i.test(String(e)) ? "Transaction rejected in wallet." : (e instanceof Error ? e.message.split("\n")[0] : "mint failed"));
      setPhase("error");
      return;
    }

    // 4) Record the redundant shards on-chain (append). For editions: loop over all
    //    N tokenIds. The STATE shard (Shard 0) is auto-configured by the contract for
    //    all edition tokens. The LOG fileId + IPFS/Arweave/Irys URIs are SHARED — one
    //    upload, but each token needs its own on-chain shard descriptor tx.
    setPhase("recording");
    if (firstTokenId !== undefined) {
      // Build the ordered list of token IDs: [firstTokenId, firstTokenId+1, ..., firstTokenId+N-1]
      const tokenIds: bigint[] = [];
      for (let i = 0; i < editionSize; i++) {
        tokenIds.push(firstTokenId + BigInt(i));
      }

      const totalShardTxs = tokenIds.length * ([
        log?.sealed && log.uri && log.root ? 1 : 0,
        ...offchain.filter((s) => s.stored && s.uri).map(() => 1),
      ].reduce((a, b) => a + b, 0));

      setRecordingProgress({ done: 0, total: totalShardTxs });
      let progressDone = 0;

      // For each token ID, record LOG shard then off-chain shards.
      for (const tid of tokenIds) {
        // Reset shard index per token (index 0 = STATE, already on-chain)
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
              args: [tid, BigInt(nextIndex), backendId, uri, shardContentHash],
              gas: BigInt(450_000),
            });
            await waitForTransactionReceipt(wagmiConfig, { hash: h });
            // Mark recorded on the display record for the first token (representative)
            if (tid === firstTokenId) {
              shard.recorded = true;
            }
            nextIndex++;
            progressDone++;
            setRecordingProgress({ done: progressDone, total: totalShardTxs });
          } catch {
            if (tid === firstTokenId) {
              shard.error = "not recorded onchain";
            }
          }
          if (tid === firstTokenId) {
            setShards([...appended]);
          }
        };

        if (log?.sealed && log.uri && log.root) {
          await recordShard(logShard, SHARD_BACKEND.log, log.uri, log.root);
        }
        for (const shard of offchain) {
          if (!shard.stored || !shard.uri) continue;
          const backendId = SHARD_BACKEND[shard.backend];
          await recordShard(shard, backendId, shard.uri, contentHash);
        }

        if (tid === firstTokenId) {
          setShards([...appended]);
        }
      }
    }

    setPhase("done");
  }

  return {
    start,
    reset,
    phase,
    mintTxHash,
    tokenId,
    mintedContract,
    shards,
    uploadPct,
    error,
    recordingProgress,
    chainId,
    canMintOnchain: Boolean(getContracts(chainId).foreverLibrary && address),
  };
}
