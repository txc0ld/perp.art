/**
 * Cross-chain trading metadata — the chains Perpetual trades across, their
 * display tokens, explorers, and the flat cross-chain bridge fee. Real,
 * non-fabricated configuration extracted from the former mock-data layer.
 */
import type { Chain } from "./types";

export interface ChainMeta {
  id: Chain;
  label: string;
  short: string;
  color: string;        // accent swatch for the chain
  explorer: string;
  /** True where Forever Library deploys and permanence is native (EVM). */
  permanenceNative: boolean;
  /** Native settlement currency symbol. */
  currency: string;
}

export const CHAINS: Record<Chain, ChainMeta> = {
  ethereum: { id: "ethereum", label: "Ethereum", short: "Ethereum", color: "#9eb8ff", explorer: "https://etherscan.io", permanenceNative: true, currency: "ETH" },
  base: { id: "base", label: "Base", short: "Base", color: "#7dd3fc", explorer: "https://basescan.org", permanenceNative: true, currency: "ETH" },
  polygon: { id: "polygon", label: "Polygon", short: "Polygon", color: "#c4b5fd", explorer: "https://polygonscan.com", permanenceNative: true, currency: "POL" },
  arbitrum: { id: "arbitrum", label: "Arbitrum", short: "Arbitrum", color: "#86c5ff", explorer: "https://arbiscan.io", permanenceNative: true, currency: "ETH" },
  optimism: { id: "optimism", label: "Optimism", short: "Optimism", color: "#fda4af", explorer: "https://optimistic.etherscan.io", permanenceNative: true, currency: "ETH" },
  zora: { id: "zora", label: "Zora", short: "Zora", color: "#a5b4fc", explorer: "https://explorer.zora.energy", permanenceNative: true, currency: "ETH" },
  shape: { id: "shape", label: "Shape", short: "Shape", color: "#e8f06a", explorer: "https://shapescan.xyz", permanenceNative: true, currency: "ETH" },
  solana: { id: "solana", label: "Solana", short: "Solana", color: "#99f6c8", explorer: "https://solscan.io", permanenceNative: false, currency: "SOL" },
  tezos: { id: "tezos", label: "Tezos", short: "Tezos", color: "#93c5fd", explorer: "https://tzkt.io", permanenceNative: false, currency: "XTZ" },
  flow: { id: "flow", label: "Flow", short: "Flow", color: "#86efac", explorer: "https://flowscan.io", permanenceNative: false, currency: "FLOW" },
};

/** Display order for chain pickers/filters (most active NFT chains first). */
export const CHAIN_ORDER: Chain[] = [
  "ethereum", "base", "solana", "polygon", "shape", "tezos", "arbitrum", "optimism", "zora", "flow",
];

export function getChainMeta(c: Chain): ChainMeta {
  return CHAINS[c];
}

export function getChains(): ChainMeta[] {
  return CHAIN_ORDER.map((c) => CHAINS[c]);
}

/** Cross-chain settlement bridge fee (flat, surfaced at point of trade). */
export const BRIDGE_FEE_ETH = 0.0009;
