import "server-only";
import { createPublicClient, http, type PublicClient } from "viem";
import { baseSepolia, sepolia } from "viem/chains";
import { serverEnv } from "@/lib/env";

const CHAINS: Record<number, typeof baseSepolia | typeof sepolia> = {
  84532: baseSepolia,
  11155111: sepolia,
};

/** A server-side viem public client for a supported chain, on the server RPC. */
export function serverPublicClient(chainId: number): PublicClient | undefined {
  const chain = CHAINS[chainId];
  if (!chain) return undefined;
  const env = serverEnv();
  const rpc = chainId === 84532 ? env.rpcBaseSepolia : chainId === 11155111 ? env.rpcSepolia : undefined;
  return createPublicClient({ chain, transport: http(rpc) }) as PublicClient;
}

export const SUPPORTED_READ_CHAINS = [84532, 11155111] as const;
