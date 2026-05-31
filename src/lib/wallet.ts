"use client";

/**
 * Wallet session - now backed by real wagmi + Reown AppKit, but the surface is
 * unchanged from the previous mock so every component keeps working:
 *   useWallet() -> { connected, address, connector }
 *   connectWallet() -> opens the AppKit modal (all connectors)
 *   disconnectWallet() -> disconnects via wagmi core
 */
import { useAccount } from "wagmi";
import { disconnect } from "@wagmi/core";
import { wagmiConfig } from "@/lib/web3/config";
import { appKitModal } from "@/components/web3/Web3Provider";

export interface WalletState {
  connected: boolean;
  address: string | null;
  connector: string | null;
}

export function useWallet(): WalletState {
  const { address, isConnected, connector } = useAccount();
  return {
    connected: isConnected,
    address: address ?? null,
    connector: connector?.name ?? null,
  };
}

/** Open the connect modal. The optional arg is ignored (the modal lists all wallets). */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function connectWallet(_connector?: string): void {
  appKitModal?.open();
}

export function disconnectWallet(): void {
  void disconnect(wagmiConfig);
}
