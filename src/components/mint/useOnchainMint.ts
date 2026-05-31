"use client";

import { useAccount, useChainId, useWriteContract } from "wagmi";
import { keccak256, stringToBytes } from "viem";
import { getContracts } from "@/lib/web3/contracts";
import { FOREVER_LIBRARY_ABI } from "@/lib/web3/abis";
import type { MintForm } from "./state";

const MIME: Record<string, string> = {
  image: "image/svg+xml",
  video: "video/mp4",
  interactive: "text/html",
};

/**
 * Real on-chain mint against the Forever Library deployed on the connected
 * chain. Returns canMintOnchain=false when no contract is configured there
 * (the wizard then falls back to a simulated mint).
 */
export function useOnchainMint() {
  const { address } = useAccount();
  const chainId = useChainId();
  const { writeContractAsync, isPending } = useWriteContract();
  const fl = getContracts(chainId).foreverLibrary;

  async function mint(form: MintForm): Promise<`0x${string}`> {
    if (!address) throw new Error("Connect a wallet first.");
    if (!fl) throw new Error("No Forever Library contract on this network.");

    const royaltyBps = Math.round(Math.min(Math.max(form.royaltyPct, 0), 100) * 100);
    const mediaType = MIME[form.mediaType] ?? "image/svg+xml";
    const meta = {
      name: form.title,
      artist: form.artistName,
      mediaType,
      description: form.description,
      genre: form.genre,
    };
    const metaStr = JSON.stringify(meta);
    const metadataHash = keccak256(stringToBytes(metaStr));
    // Self-contained data-URI proof for the testnet mint (the full ethfs
    // pipeline writes raw bytes onchain; this records a resolvable proof + hash).
    const proofURI = `data:application/json,${encodeURIComponent(metaStr)}`;
    const proofContentHash = keccak256(stringToBytes(proofURI));

    return writeContractAsync({
      address: fl,
      abi: FOREVER_LIBRARY_ABI,
      functionName: "mint",
      args: [
        address,
        form.artistName,
        form.title,
        mediaType,
        BigInt(royaltyBps),
        metadataHash,
        proofURI,
        proofContentHash,
      ],
    });
  }

  return { mint, isPending, chainId, canMintOnchain: Boolean(fl && address) };
}
