/**
 * Deployed contract addresses per chain, read from NEXT_PUBLIC_ env (static refs
 * so Next inlines them). Today the contracts live on the testnets; mainnet slots
 * fill in once deployed + audited.
 */

export interface ChainContracts {
  foreverLibrary?: `0x${string}`;
  settlement?: `0x${string}`;
  logLedger?: `0x${string}`;
}

function addr(v?: string): `0x${string}` | undefined {
  return v && /^0x[0-9a-fA-F]{40}$/.test(v) ? (v as `0x${string}`) : undefined;
}

const REGISTRY: Record<number, ChainContracts> = {
  // Base mainnet (8453)
  8453: {
    foreverLibrary: addr(process.env.NEXT_PUBLIC_FOREVER_LIBRARY_BASE),
    settlement: addr(process.env.NEXT_PUBLIC_SETTLEMENT_BASE),
  },
  // Base Sepolia (84532)
  84532: {
    foreverLibrary: addr(process.env.NEXT_PUBLIC_FOREVER_LIBRARY_BASE_SEPOLIA),
    settlement: addr(process.env.NEXT_PUBLIC_SETTLEMENT_BASE_SEPOLIA),
    logLedger: addr(process.env.NEXT_PUBLIC_LOG_LEDGER_BASE_SEPOLIA),
  },
  // Ethereum Sepolia (11155111)
  11155111: {
    foreverLibrary: addr(process.env.NEXT_PUBLIC_FOREVER_LIBRARY_SEPOLIA),
    settlement: addr(process.env.NEXT_PUBLIC_SETTLEMENT_SEPOLIA),
    logLedger: addr(process.env.NEXT_PUBLIC_LOG_LEDGER_SEPOLIA),
  },
};

export function getContracts(chainId?: number): ChainContracts {
  return (chainId !== undefined && REGISTRY[chainId]) || {};
}

/** Can a connected wallet mint on this chain (Forever Library deployed)? */
export function hasMintableContract(chainId?: number): boolean {
  return Boolean(getContracts(chainId).foreverLibrary);
}

const EXPLORERS: Record<number, string> = {
  8453: "https://basescan.org",
  84532: "https://sepolia.basescan.org",
  11155111: "https://sepolia.etherscan.io",
  1: "https://etherscan.io",
};

export function explorerTx(chainId: number | undefined, hash: string): string {
  const base = (chainId && EXPLORERS[chainId]) || "https://etherscan.io";
  return `${base}/tx/${hash}`;
}

export function chainLabelForId(chainId: number | undefined): string {
  switch (chainId) {
    case 84532: return "Base Sepolia";
    case 11155111: return "Ethereum Sepolia";
    case 8453: return "Base";
    case 1: return "Ethereum";
    default: return "this network";
  }
}
