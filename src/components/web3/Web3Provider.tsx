"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { createAppKit } from "@reown/appkit/react";
import { wagmiAdapter, projectId, networks } from "@/lib/web3/config";
import { publicEnv } from "@/lib/env";

const metadata = {
  name: "Perpetual",
  description: "Art, engineered to outlast everything.",
  url: publicEnv.siteUrl,
  icons: [`${publicEnv.siteUrl}/icon.svg`],
};

/**
 * The AppKit modal instance. Created client-side only (guarded) so SSR/prerender
 * never touches browser APIs. `connectWallet()` in src/lib/wallet.ts opens it.
 */
export const appKitModal =
  typeof window !== "undefined"
    ? createAppKit({
        adapters: [wagmiAdapter],
        networks,
        projectId: projectId || "perpetual-dev",
        metadata,
        themeMode: "dark",
        features: { analytics: false, email: false, socials: [] },
        themeVariables: {
          "--w3m-accent": "#fe93ed",
          "--w3m-color-mix": "#050505",
          "--w3m-color-mix-strength": 32,
          "--w3m-border-radius-master": "2px",
          "--w3m-font-family": "var(--font-inter), Inter, sans-serif",
        },
      })
    : undefined;

/** Wraps the app in wagmi + react-query so wallet hooks work everywhere. */
export function Web3Provider({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 300_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  }));
  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
