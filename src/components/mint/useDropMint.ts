"use client";

import * as React from "react";
import { useAccount, useChainId } from "wagmi";
import { writeContract, waitForTransactionReceipt, readContract } from "@wagmi/core";
import { decodeEventLog, type Hex } from "viem";
import { upload } from "@vercel/blob/client";
import { wagmiConfig } from "@/lib/web3/config";
import { getContracts } from "@/lib/web3/contracts";
import { FACTORY_ABI, PERPETUAL_DROP_ABI } from "@/lib/web3/abis";

/** Per-mintBatch chunk cap. The contract's MAX_BATCH is 5000; stay at/under it. */
export const DROP_MINT_CHUNK = 5000;

export type DropPhase =
  | "idle"
  | "uploading"
  | "processing"
  | "creating"
  | "committing"
  | "minting"
  | "revealing"
  | "done"
  | "error";

export interface DropProcessResult {
  provenanceHash: Hex;
  mediaCID: string;
  metadataBaseURI: string;
  arweaveManifest?: string;
  count: number;
  warnings?: string[];
}

export interface DropMintInput {
  name: string;
  symbol: string;
  royaltyBps: number;
  /** The processed pipeline output (provenance + folder URIs + count). */
  processed: DropProcessResult;
  /** Placeholder baseURI used at deploy (pre-reveal). */
  placeholderBaseURI: string;
}

/** Upload a ZIP to Blob, then run /api/drops/process and poll status to done. */
export function useDropProcessing() {
  const chainId = useChainId();
  const [phase, setPhase] = React.useState<"idle" | "uploading" | "processing" | "done" | "error">("idle");
  const [uploadPct, setUploadPct] = React.useState(0);
  const [progress, setProgress] = React.useState(0);
  const [step, setStep] = React.useState<string>("");
  const [result, setResult] = React.useState<DropProcessResult>();
  const [error, setError] = React.useState<string>();

  function reset() {
    setPhase("idle");
    setUploadPct(0);
    setProgress(0);
    setStep("");
    setResult(undefined);
    setError(undefined);
  }

  async function process(file: File): Promise<DropProcessResult | undefined> {
    setError(undefined);
    setPhase("uploading");
    setUploadPct(0);
    let blobUrl: string;
    try {
      const blob = await upload(file.name || "drop.zip", file, {
        access: "public",
        handleUploadUrl: "/api/drops/upload",
        contentType: file.type || "application/zip",
        multipart: true,
        onUploadProgress: (p) => setUploadPct(Math.round(p.percentage)),
      });
      blobUrl = blob.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "upload failed");
      setPhase("error");
      return undefined;
    }

    setPhase("processing");
    setStep("queued");
    try {
      const res = await fetch("/api/drops/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blobUrl }),
      });
      const kick = (await res.json()) as { id?: string; status?: string; error?: string };
      if (!res.ok || !kick.id) throw new Error(kick.error ?? `processing failed (${res.status})`);

      // Poll status until done/error.
      for (let i = 0; i < 600; i++) {
        const sres = await fetch(`/api/drops/status?id=${encodeURIComponent(kick.id)}`);
        const s = (await sres.json()) as {
          status?: string; progress?: number; step?: string; result?: DropProcessResult; error?: string;
        };
        if (typeof s.progress === "number") setProgress(s.progress);
        if (s.step) setStep(s.step);
        if (s.status === "done" && s.result) {
          setResult(s.result);
          setPhase("done");
          return s.result;
        }
        if (s.status === "error") {
          throw new Error(s.error ?? "processing failed");
        }
        await new Promise((r) => setTimeout(r, 1200));
      }
      throw new Error("processing timed out");
    } catch (e) {
      setError(e instanceof Error ? e.message : "processing failed");
      setPhase("error");
      return undefined;
    }
  }

  return { process, reset, phase, uploadPct, progress, step, result, error, chainId };
}

/**
 * On-chain drop deploy → commit → batch-mint → reveal, all gated on a deployed
 * factory with createDrop. Each step is a separate wallet confirmation.
 */
export function useDropMint() {
  const { address } = useAccount();
  const chainId = useChainId();

  const [phase, setPhase] = React.useState<DropPhase>("idle");
  const [dropAddress, setDropAddress] = React.useState<Hex>();
  const [createTx, setCreateTx] = React.useState<Hex>();
  const [mintedSoFar, setMintedSoFar] = React.useState(0);
  const [mintTotal, setMintTotal] = React.useState(0);
  const [revealTx, setRevealTx] = React.useState<Hex>();
  const [error, setError] = React.useState<string>();
  const [warning, setWarning] = React.useState<string>();

  const contracts = getContracts(chainId);
  const canDeploy = Boolean(contracts.factory && address);

  function reset() {
    setPhase("idle");
    setDropAddress(undefined);
    setCreateTx(undefined);
    setMintedSoFar(0);
    setMintTotal(0);
    setRevealTx(undefined);
    setError(undefined);
    setWarning(undefined);
  }

  function cleanErr(e: unknown): string {
    const s = String(e);
    if (/denied|rejected/i.test(s)) return "Transaction rejected in wallet.";
    if (/createDrop|not a function|execution reverted/i.test(s)) {
      return "The deployed factory does not support drops yet (createDrop reverted). It needs the redeployed factory.";
    }
    return e instanceof Error ? e.message.split("\n")[0] : "transaction failed";
  }

  async function start(input: DropMintInput): Promise<DropPhase> {
    if (!address || !contracts.factory) {
      setError("Connect a wallet on a network with the drop factory deployed.");
      setPhase("error");
      return "error";
    }
    setError(undefined);
    setWarning(undefined);
    const { name, symbol, royaltyBps, processed, placeholderBaseURI } = input;

    // (a) factory.createDrop → drop address from DropCreated.
    setPhase("creating");
    let drop: Hex | undefined;
    try {
      const hash = await writeContract(wagmiConfig, {
        address: contracts.factory,
        abi: FACTORY_ABI,
        functionName: "createDrop",
        args: [name, symbol, BigInt(royaltyBps), BigInt(processed.count), placeholderBaseURI],
      });
      setCreateTx(hash);
      const receipt = await waitForTransactionReceipt(wagmiConfig, { hash });
      for (const logItem of receipt.logs) {
        try {
          const d = decodeEventLog({ abi: FACTORY_ABI, data: logItem.data, topics: logItem.topics });
          if (d.eventName === "DropCreated") {
            drop = (d.args as { drop: Hex }).drop;
            break;
          }
        } catch {
          /* not our event */
        }
      }
      if (!drop) throw new Error("DropCreated event not found in receipt");
      setDropAddress(drop);
    } catch (e) {
      setError(cleanErr(e));
      setPhase("error");
      return "error";
    }

    // (b) commitProvenance(provenanceHash).
    setPhase("committing");
    try {
      const hash = await writeContract(wagmiConfig, {
        address: drop,
        abi: PERPETUAL_DROP_ABI,
        functionName: "commitProvenance",
        args: [processed.provenanceHash],
      });
      await waitForTransactionReceipt(wagmiConfig, { hash });
    } catch (e) {
      setError(cleanErr(e));
      setPhase("error");
      return "error";
    }

    // (c) mintBatch(creator, chunk) looped in ≤DROP_MINT_CHUNK chunks.
    setPhase("minting");
    setMintTotal(processed.count);
    let minted = 0;
    try {
      while (minted < processed.count) {
        const chunk = Math.min(DROP_MINT_CHUNK, processed.count - minted);
        const hash = await writeContract(wagmiConfig, {
          address: drop,
          abi: PERPETUAL_DROP_ABI,
          functionName: "mintBatch",
          args: [address, BigInt(chunk)],
        });
        await waitForTransactionReceipt(wagmiConfig, { hash });
        minted += chunk;
        setMintedSoFar(minted);
      }
      // Sanity: confirm totalMinted == count.
      try {
        const onchain = (await readContract(wagmiConfig, {
          address: drop, abi: PERPETUAL_DROP_ABI, functionName: "totalMinted",
        })) as bigint;
        if (Number(onchain) !== processed.count) {
          setWarning(`Minted ${onchain.toString()} of ${processed.count}; you can resume minting the rest.`);
        }
      } catch { /* non-fatal */ }
    } catch (e) {
      setError(cleanErr(e));
      setPhase("error");
      return "error";
    }

    // (d) reveal(metadataBaseURI).
    setPhase("revealing");
    try {
      const hash = await writeContract(wagmiConfig, {
        address: drop,
        abi: PERPETUAL_DROP_ABI,
        functionName: "reveal",
        args: [processed.metadataBaseURI],
      });
      setRevealTx(hash);
      await waitForTransactionReceipt(wagmiConfig, { hash });
    } catch {
      // Reveal is the last, optional step. The supply is minted + provenance
      // committed; surface a warning rather than discarding a successful drop.
      setWarning("Drop deployed and minted, but reveal failed/was rejected — you can reveal later from the collection.");
      setPhase("done");
      return "done";
    }

    setPhase("done");
    return "done";
  }

  return {
    start,
    reset,
    phase,
    dropAddress,
    createTx,
    mintedSoFar,
    mintTotal,
    revealTx,
    error,
    warning,
    chainId,
    canDeploy,
  };
}
