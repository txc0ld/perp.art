"use client";

import { useAccount } from "wagmi";
import { chainLabelForId, hasMintableContract } from "@/lib/web3/contracts";
import { appKitModal } from "@/components/web3/Web3Provider";

/**
 * Header network control. Only renders when a wallet is connected.
 *
 * Both states open the Reown AppKit network picker rather than calling wagmi
 * `switchChain` directly: on mobile WalletConnect, a raw switchChain deep-links
 * out to the wallet app and frequently drops the session on return to the
 * browser; AppKit's modal manages the WC session across that app-switch.
 *
 * Layout: on a wrong (unsupported) network the control is icon-only on phones
 * and gains a label from sm up — so the connected mobile header (wallet pill +
 * network + menu) never overflows and pushes the hamburger off-screen. On a
 * supported network it's hidden on phones entirely (no action needed there).
 */
export function NetworkButton() {
  const { isConnected, chainId } = useAccount();

  if (!isConnected || chainId === undefined) return null;

  const openNetworks = () => appKitModal?.open({ view: "Networks" });

  // Wrong network (no Perpetual contracts here) — prompt to switch.
  if (!hasMintableContract(chainId)) {
    return (
      <button
        type="button"
        onClick={openNetworks}
        aria-label="Wrong network — switch network"
        className="flex h-10 shrink-0 items-center gap-2 rounded-[8px] border border-error/40 bg-error/10 px-2.5 text-error transition-colors hover:border-error/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 sm:px-3"
      >
        <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0" fill="none" aria-hidden>
          <path d="M8 1.8l6.4 11.4H1.6L8 1.8z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
          <path d="M8 6.4v3.2M8 11.4v.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <span className="hidden whitespace-nowrap font-mono text-xs sm:inline">Switch network</span>
      </button>
    );
  }

  // Supported network — show the current network (sm+ only; hidden on phones to
  // keep the header uncrowded since no switch is needed).
  return (
    <button
      type="button"
      onClick={openNetworks}
      aria-label={`Network: ${chainLabelForId(chainId)}. Switch network`}
      className="hidden h-10 shrink-0 items-center gap-2 rounded-[8px] border border-border bg-surface px-3 text-sm transition-colors hover:border-border-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 sm:flex"
    >
      <span className="h-2 w-2 shrink-0 rounded-full bg-verify" aria-hidden />
      <span className="whitespace-nowrap font-mono text-xs">{chainLabelForId(chainId)}</span>
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-faint" fill="none" aria-hidden>
        <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
