"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { reconnect, getAccount } from "@wagmi/core";
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

/**
 * Re-syncs the wallet connection when the page becomes visible again. On mobile,
 * switching networks deep-links out to the wallet app and back; Safari backgrounds
 * the page, so wagmi can miss the chainChanged event and show a stale network until
 * a manual refresh. On resume we silently `reconnect()` (only when already
 * connected) so the new chainId/account propagate without a reload.
 */
function WalletResync() {
  const last = React.useRef(0);
  React.useEffect(() => {
    const resync = () => {
      if (typeof document === "undefined" || document.visibilityState !== "visible") return;
      const now = typeof performance !== "undefined" ? performance.now() : 0;
      if (now - last.current < 1500) return; // debounce overlapping resume events
      last.current = now;
      const acct = getAccount(wagmiAdapter.wagmiConfig);
      if (acct.status === "connected" || acct.status === "reconnecting") {
        void reconnect(wagmiAdapter.wagmiConfig).catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", resync);
    window.addEventListener("focus", resync);
    window.addEventListener("pageshow", resync);
    return () => {
      document.removeEventListener("visibilitychange", resync);
      window.removeEventListener("focus", resync);
      window.removeEventListener("pageshow", resync);
    };
  }, []);
  return null;
}

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
      <QueryClientProvider client={queryClient}>
        <WalletResync />
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
