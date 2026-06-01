/**
 * Real ENS resolution. ENS only lives on Ethereum mainnet, so we resolve there
 * with a viem PublicClient regardless of which chain a token trades on. Failures
 * (no RPC, no name, RPC error) fall back to null → callers show a short address.
 * Isomorphic: safe on server and client (no "use client", no server-only).
 */
import { createPublicClient, http, type PublicClient } from "viem";
import { mainnet } from "viem/chains";
import { shortAddress } from "@/lib/utils";

// Module-level cache so repeat lookups (same address across many surfaces) don't
// re-hit the RPC. null is a valid cached result (address has no primary name).
const cache = new Map<string, string | null>();

let client: PublicClient | null = null;
function mainnetClient(): PublicClient {
  if (!client) {
    // NEXT_PUBLIC_RPC_ETHEREUM is the mainnet RPC; fall back to a public node.
    const rpc = process.env.NEXT_PUBLIC_RPC_ETHEREUM || undefined;
    client = createPublicClient({ chain: mainnet, transport: http(rpc) }) as PublicClient;
  }
  return client;
}

/** Resolve an address to its primary ENS name on mainnet, or null if none/error. */
export async function resolveEnsName(address: string): Promise<string | null> {
  if (!address) return null;
  const key = address.toLowerCase();
  if (cache.has(key)) return cache.get(key) ?? null;
  try {
    const name = await mainnetClient().getEnsName({ address: address as `0x${string}` });
    const resolved = name ?? null;
    cache.set(key, resolved);
    return resolved;
  } catch {
    cache.set(key, null);
    return null;
  }
}

/** Best human-readable label for an address: ENS name if known, else short hex. */
export function displayName(address: string, ens?: string | null): string {
  return ens ?? shortAddress(address);
}
