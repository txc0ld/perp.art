"use client";

import * as React from "react";
import { useAccount, useChainId } from "wagmi";
import { writeContract, waitForTransactionReceipt } from "@wagmi/core";
import { keccak256, stringToBytes, decodeEventLog } from "viem";
import { upload } from "@vercel/blob/client";
import { wagmiConfig } from "@/lib/web3/config";
import { getContracts } from "@/lib/web3/contracts";
import { FOREVER_LIBRARY_ABI } from "@/lib/web3/abis";
import { cleanTraits, type MintForm } from "./state";

// Forever Library ShardBackend enum.
const BACKEND_ENUM: Record<string, number> = { onchain: 0, ipfs: 1, arweave: 2, irys: 3, cdn: 4 };

export type ShardPhase = "idle" | "storing" | "minting" | "recording" | "done" | "error";

export interface ShardRecord {
  backend: "onchain" | "ipfs" | "arweave" | "irys";
  stored: boolean;     // bytes uploaded to this backend
  recorded: boolean;   // recorded on-chain as a shard
  uri?: string;
  gateway?: string;
  error?: string;
}

interface StoreResponse {
  contentHash: `0x${string}`;
  ipfs: { ok: boolean; uri?: string; gateway?: string; error?: string };
  arweave: { ok: boolean; uri?: string; gateway?: string; error?: string };
  irys: { ok: boolean; uri?: string; gateway?: string; error?: string };
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

    const mediaType = form.fileMime || form.file.type || "application/octet-stream";
    const royaltyBps = Math.round(Math.min(Math.max(form.royaltyPct, 0), 100) * 100);

    // 1) Store the artist's actual file bytes across the off-chain shards.
    setPhase("storing");
    setUploadPct(0);
    let store: StoreResponse;
    try {
      // Upload the file DIRECTLY to Vercel Blob from the browser (bypasses the
      // ~4.5MB serverless body cap), then have the server pin it from there.
      const blob = await upload(form.fileName || "artwork", form.file, {
        access: "public",
        handleUploadUrl: "/api/upload",
        contentType: mediaType,
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
          mediaType,
          fileName: form.fileName || "artwork",
          traits: cleanTraits(form),
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
    const offchain: ShardRecord[] = [
      { backend: "ipfs", stored: store.ipfs.ok, recorded: false, uri: store.ipfs.uri, gateway: store.ipfs.gateway, error: store.ipfs.error },
      { backend: "arweave", stored: store.arweave.ok, recorded: false, uri: store.arweave.uri, gateway: store.arweave.gateway, error: store.arweave.error },
      { backend: "irys", stored: store.irys.ok, recorded: false, uri: store.irys.uri, gateway: store.irys.gateway, error: store.irys.error },
    ];

    // Shard 0 - the onchain proof: a compact data-URI anchoring the content
    // hash + a pointer to the full bytes (kept small to bound gas).
    const proof = {
      name: form.title,
      artist: form.artistName,
      image: store.ipfs.uri || store.arweave.uri || store.irys.uri || "",
      hash: contentHash,
    };
    const proofURI = `data:application/json,${encodeURIComponent(JSON.stringify(proof))}`;
    const metadataHash = keccak256(stringToBytes(JSON.stringify({ ...proof, genre: form.genre, mediaType })));

    const onchainShard: ShardRecord = { backend: "onchain", stored: true, recorded: true, uri: proofURI };
    setShards([onchainShard, ...offchain]);

    // 2) Mint - writes provenance + the mandatory onchain proof (Shard 0).
    setPhase("minting");
    let mintHash: `0x${string}`;
    let newTokenId: bigint | undefined;
    try {
      mintHash = await writeContract(wagmiConfig, {
        address: fl,
        abi: FOREVER_LIBRARY_ABI,
        functionName: "mint",
        args: [address, form.artistName, form.title, mediaType, BigInt(royaltyBps), metadataHash, proofURI, contentHash],
      });
      setMintTxHash(mintHash);
      const receipt = await waitForTransactionReceipt(wagmiConfig, { hash: mintHash });
      for (const log of receipt.logs) {
        try {
          const d = decodeEventLog({ abi: FOREVER_LIBRARY_ABI, data: log.data, topics: log.topics });
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

    // 3) Record each successfully-stored off-chain shard on-chain (append).
    setPhase("recording");
    let nextIndex = 1; // Shard 0 is the onchain proof
    if (newTokenId !== undefined) {
      for (const shard of offchain) {
        if (!shard.stored || !shard.uri) continue;
        try {
          const h = await writeContract(wagmiConfig, {
            address: fl,
            abi: FOREVER_LIBRARY_ABI,
            functionName: "configureShard",
            args: [newTokenId, BigInt(nextIndex), BACKEND_ENUM[shard.backend], shard.uri, contentHash],
          });
          await waitForTransactionReceipt(wagmiConfig, { hash: h });
          shard.recorded = true;
          nextIndex++;
          setShards([onchainShard, ...offchain]);
        } catch {
          shard.error = "not recorded onchain";
        }
      }
    }

    setShards([onchainShard, ...offchain]);
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
