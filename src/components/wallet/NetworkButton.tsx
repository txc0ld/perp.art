"use client";

import { useAccount, useSwitchChain } from "wagmi";
import { chainLabelForId, hasMintableContract } from "@/lib/web3/contracts";
import { appKitModal } from "@/components/web3/Web3Provider";

/** Network the site steers wallets to for a real onchain mint. */
const PREFERRED_CHAIN_ID = 11155111; // Ethereum Sepolia

/**
 * Header network control. Only renders when a wallet is connected.
 * - On a chain with no Perpetual contracts (e.g. a mainnet): a one-click button
 *   that auto-switches the wallet to Ethereum Sepolia.
 * - On a supported chain: shows the current network and opens the wallet's
 *   network picker (which also switches the wallet) on click.
 */
export function NetworkButton() {
  const { isConnected, chainId } = useAccount();
  const { switchChain, isPending } = useSwitchChain();

  if (!isConnected || chainId === undefined) return null;

  // Unsupported chain → one-click auto-switch to Ethereum Sepolia.
  if (!hasMintableContract(chainId)) {
    return (
      <button
        type="button"
        onClick={() => switchChain?.({ chainId: PREFERRED_CHAIN_ID })}
        disabled={isPending}
        aria-label="Switch wallet to Ethereum Sepolia"
        className="flex h-10 items-center gap-2 rounded-[8px] border border-error/40 bg-error/10 px-3 text-sm text-error transition-colors hover:border-error/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60"
      >
        <span className="h-2 w-2 shrink-0 rounded-full bg-error" aria-hidden />
        <span className="whitespace-nowrap font-mono text-xs">
          {isPending ? "Switching…" : "Switch network"}
        </span>
      </button>
    );
  }

  // Supported chain → show current network, open the picker to switch.
  return (
    <button
      type="button"
      onClick={() => appKitModal?.open({ view: "Networks" })}
      aria-label={`Network: ${chainLabelForId(chainId)}. Switch network`}
      className="hidden h-10 items-center gap-2 rounded-[8px] border border-border bg-surface px-3 text-sm transition-colors hover:border-border-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:flex"
    >
      <span className="h-2 w-2 shrink-0 rounded-full bg-verify" aria-hidden />
      <span className="whitespace-nowrap font-mono text-xs">{chainLabelForId(chainId)}</span>
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-faint" fill="none" aria-hidden>
        <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
