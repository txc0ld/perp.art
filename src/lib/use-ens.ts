"use client";

/**
 * Client hook for resolving a primary ENS name. Resolves on Ethereum mainnet via
 * the isomorphic resolver in ens.ts, returning null until resolved (or if none).
 */
import { useEffect, useState } from "react";
import { resolveEnsName } from "@/lib/ens";

export function useEnsName(address?: string): string | null {
  // Track the resolution keyed by address. Resetting during render when the
  // address changes avoids a synchronous setState inside the effect (which the
  // effect then only uses for the async resolution result).
  const [resolved, setResolved] = useState<{ address?: string; name: string | null }>({
    address,
    name: null,
  });

  if (resolved.address !== address) {
    setResolved({ address, name: null });
  }

  useEffect(() => {
    if (!address) return;
    let active = true;
    resolveEnsName(address).then((name) => {
      if (active) setResolved({ address, name });
    });
    return () => {
      active = false;
    };
  }, [address]);

  return resolved.address === address ? resolved.name : null;
}
