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
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import {
  mainnet,
  base,
  polygon,
  arbitrum,
  optimism,
  zora,
  shape,
  type AppKitNetwork,
} from "@reown/appkit/networks";
import { publicEnv } from "@/lib/env";

export const projectId = publicEnv.walletConnectProjectId;

if (!projectId) {
  // Non-fatal: the modal will not function until this is set (in .env.local
  // locally, and in the Vercel project env for production).
  console.warn("[web3] NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not set.");
}

export const networks: [AppKitNetwork, ...AppKitNetwork[]] = [
  mainnet,
  base,
  polygon,
  arbitrum,
  optimism,
  zora,
  shape,
];

export const wagmiAdapter = new WagmiAdapter({
  storage: createStorage({ storage: cookieStorage }),
  ssr: true,
  projectId: projectId || "perpetual-dev",
  networks,
});

export const wagmiConfig = wagmiAdapter.wagmiConfig;
