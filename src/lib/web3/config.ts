/**
 * wagmi + Reown AppKit configuration.
 *
 * EVM chains only (wallet/sign/settle). The non-EVM chains we index (Solana,
 * Tezos, Flow) are read-only for now and would need their own adapters.
 * Shape, Zora, etc. are first-class here.
 *
 * projectId comes from NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID via env.ts.
 */
import { cookieStorage, createStorage } from "wagmi";
import { http, type Transport } from "viem";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import {
  mainnet,
  base,
  polygon,
  arbitrum,
  optimism,
  zora,
  shape,
  baseSepolia,
  sepolia,
  type AppKitNetwork,
} from "@reown/appkit/networks";
import { publicEnv, getRpcUrl } from "@/lib/env";
import type { Chain } from "@/lib/types";

export const projectId = publicEnv.walletConnectProjectId;

if (!projectId) {
  // Non-fatal: the modal will not function until this is set (in .env.local
  // locally, and in the Vercel project env for production).
  if (process.env.NODE_ENV !== "production") {
    console.warn("[web3] NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not set.");
  }
}

export const networks: [AppKitNetwork, ...AppKitNetwork[]] = [
  mainnet,
  base,
  polygon,
  arbitrum,
  optimism,
  zora,
  shape,
  // Testnets (where the contracts are deployed today).
  baseSepolia,
  sepolia,
];

/**
 * Per-chain transports: use our configured RPC (Alchemy etc.) when present,
 * otherwise fall back to the chain's default public RPC (http() with no url).
 */
function rpc(chain: Chain): Transport {
  const url = getRpcUrl(chain);
  return url ? http(url) : http();
}

const transports: Record<number, Transport> = {
  [mainnet.id]: rpc("ethereum"),
  [base.id]: rpc("base"),
  [polygon.id]: rpc("polygon"),
  [arbitrum.id]: rpc("arbitrum"),
  [optimism.id]: rpc("optimism"),
  [zora.id]: rpc("zora"),
  [shape.id]: rpc("shape"),
};

export const wagmiAdapter = new WagmiAdapter({
  storage: createStorage({ storage: cookieStorage }),
  ssr: true,
  projectId: projectId || "perpetual-dev",
  networks,
  transports,
});

export const wagmiConfig = wagmiAdapter.wagmiConfig;
