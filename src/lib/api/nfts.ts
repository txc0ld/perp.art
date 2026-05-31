"use client";

import { useQuery } from "@tanstack/react-query";
import type { OwnedNftsResponse } from "./types";

async function fetchOwnedNfts(address: string): Promise<OwnedNftsResponse> {
  const res = await fetch(`/api/nfts?address=${address}`);
  if (!res.ok) throw new Error(`nfts request failed: ${res.status}`);
  return (await res.json()) as OwnedNftsResponse;
}

/**
 * Live owned NFTs for a connected wallet (real data via the /api/nfts proxy).
 * Returns an empty, non-error result when no address is connected.
 */
export function useOwnedNfts(address?: string | null) {
  return useQuery({
    queryKey: ["owned-nfts", address ?? null],
    queryFn: () => fetchOwnedNfts(address as string),
    enabled: Boolean(address),
    staleTime: 60_000,
    retry: 1,
  });
}
