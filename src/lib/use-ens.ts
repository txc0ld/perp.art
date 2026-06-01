"use client";

/**
 * Client hook for resolving a primary ENS name. Resolves on Ethereum mainnet via
 * the isomorphic resolver in ens.ts, returning null until resolved (or if none).
 */
import { useEffect, useState } from "react";
import { resolveEnsName } from "@/lib/ens";

export function useEnsName(address?: string): string | null {
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    if (!address) {
      setName(null);
      return;
    }
    let active = true;
    resolveEnsName(address).then((resolved) => {
      if (active) setName(resolved);
    });
    return () => {
      active = false;
    };
  }, [address]);

  return name;
}
