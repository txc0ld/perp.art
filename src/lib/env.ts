/**
 * env.ts - single, type-safe entry point for configuration.
 *
 * Two tiers:
 *   - `publicEnv` + the get*() helpers: NEXT_PUBLIC_ values, safe to read anywhere
 *     (Next inlines them into the client bundle). Never put a true secret here.
 *   - `serverEnv()`: server-only secrets. Calling it in the browser THROWS, so a
 *     stray client import can never leak a secret. Only read these in server code
 *     (route handlers, server actions, RSC data functions).
 *
 * NEXT_PUBLIC_ vars must be referenced as static literals (below) for Next to
 * inline them - do not access them via a computed key.
 */
import type { Chain } from "./types";

const isServer = typeof window === "undefined";

// ---------------------------------------------------------------------------
// Public config (safe in the browser)
// ---------------------------------------------------------------------------

export const publicEnv = {
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "https://perpetual.art",
  appEnv: (process.env.NEXT_PUBLIC_APP_ENV ?? "development") as
    | "development"
    | "preview"
    | "production",
  walletConnectProjectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "",
  protocolFeeBps: Number(process.env.NEXT_PUBLIC_PROTOCOL_FEE_BPS ?? 225),
  bridgeFeeEth: Number(process.env.NEXT_PUBLIC_BRIDGE_FEE_ETH ?? 0.0009),
  indexerUrl: process.env.NEXT_PUBLIC_INDEXER_URL ?? "",
  orderbookUrl: process.env.NEXT_PUBLIC_ORDERBOOK_URL ?? "",
  bridgeContract: process.env.NEXT_PUBLIC_BRIDGE_CONTRACT ?? "",
  ipfsGateway: process.env.NEXT_PUBLIC_IPFS_GATEWAY ?? "https://ipfs.io/ipfs/",
  arweaveGateway: process.env.NEXT_PUBLIC_ARWEAVE_GATEWAY ?? "https://arweave.net/",
  irysGateway: process.env.NEXT_PUBLIC_IRYS_GATEWAY ?? "https://gateway.irys.xyz/",
  cdnBase: process.env.NEXT_PUBLIC_CDN_BASE ?? "",
  ensRpc: process.env.NEXT_PUBLIC_ENS_RPC ?? "",
  analyticsId: process.env.NEXT_PUBLIC_ANALYTICS_ID ?? "",
  onrampProvider: process.env.NEXT_PUBLIC_ONRAMP_PROVIDER ?? "",
} as const;

// ---------------------------------------------------------------------------
// Per-chain public RPC endpoints (static refs so they inline correctly)
// ---------------------------------------------------------------------------

const RPC: Record<Chain, string | undefined> = {
  ethereum: process.env.NEXT_PUBLIC_RPC_ETHEREUM,
  base: process.env.NEXT_PUBLIC_RPC_BASE,
  polygon: process.env.NEXT_PUBLIC_RPC_POLYGON,
  arbitrum: process.env.NEXT_PUBLIC_RPC_ARBITRUM,
  optimism: process.env.NEXT_PUBLIC_RPC_OPTIMISM,
  zora: process.env.NEXT_PUBLIC_RPC_ZORA,
  shape: process.env.NEXT_PUBLIC_RPC_SHAPE,
  solana: process.env.NEXT_PUBLIC_RPC_SOLANA,
  tezos: process.env.NEXT_PUBLIC_RPC_TEZOS,
  flow: process.env.NEXT_PUBLIC_RPC_FLOW,
};

export function getRpcUrl(chain: Chain): string | undefined {
  return RPC[chain];
}

// ---------------------------------------------------------------------------
// Per-chain deployed contract addresses (static refs). "0x" / empty = not set.
// ---------------------------------------------------------------------------

const FOREVER_LIBRARY: Partial<Record<Chain, string | undefined>> = {
  ethereum: process.env.NEXT_PUBLIC_FOREVER_LIBRARY_ETHEREUM,
  base: process.env.NEXT_PUBLIC_FOREVER_LIBRARY_BASE,
};
const SETTLEMENT: Partial<Record<Chain, string | undefined>> = {
  ethereum: process.env.NEXT_PUBLIC_SETTLEMENT_ETHEREUM,
  base: process.env.NEXT_PUBLIC_SETTLEMENT_BASE,
};
const ETHFS: Partial<Record<Chain, string | undefined>> = {
  ethereum: process.env.NEXT_PUBLIC_ETHFS_ETHEREUM,
  base: process.env.NEXT_PUBLIC_ETHFS_BASE,
};

function addr(v?: string): string | undefined {
  return v && v !== "0x" ? v : undefined;
}

export function getForeverLibraryAddress(chain: Chain): string | undefined {
  return addr(FOREVER_LIBRARY[chain]);
}
export function getSettlementAddress(chain: Chain): string | undefined {
  return addr(SETTLEMENT[chain]);
}
export function getEthfsAddress(chain: Chain): string | undefined {
  return addr(ETHFS[chain]);
}

/**
 * Is a live backend wired up? When false, the app runs on the deterministic
 * mock layer (src/lib/mock-data.ts). Flip the data layer on this.
 */
export function isLiveBackend(): boolean {
  const url = publicEnv.indexerUrl;
  return Boolean(url) && url !== "https://api.perpetual.art";
}

// ---------------------------------------------------------------------------
// Server-only secrets. serverEnv() throws if read in the browser.
// ---------------------------------------------------------------------------

export interface ServerEnv {
  databaseUrl?: string;
  redisUrl?: string;
  indexerApiKey?: string;
  pinataJwt?: string;
  arweaveWalletJwk?: string;
  irysPrivateKey?: string;
  bridgeRelayerUrl?: string;
  bridgeRelayerKey?: string;
  verifierUrl?: string;
  verifierApiKey?: string;
  seaportConduitKey?: string;
  seaportZoneAddress?: string;
  protocolFeeRecipient?: string;
  onrampApiKey?: string;
  resendApiKey?: string;
  deployerPrivateKey?: string;
  etherscanApiKey?: string;
  basescanApiKey?: string;
}

let cached: Readonly<ServerEnv> | null = null;

export function serverEnv(): Readonly<ServerEnv> {
  if (!isServer) {
    throw new Error(
      "serverEnv() was called in the browser. Server secrets must only be read in " +
        "server code (route handlers, server actions, RSC data functions). Move this access server-side.",
    );
  }
  if (cached) return cached;
  cached = Object.freeze({
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
    indexerApiKey: process.env.INDEXER_API_KEY,
    pinataJwt: process.env.PINATA_JWT,
    arweaveWalletJwk: process.env.ARWEAVE_WALLET_JWK,
    irysPrivateKey: process.env.IRYS_PRIVATE_KEY,
    bridgeRelayerUrl: process.env.BRIDGE_RELAYER_URL,
    bridgeRelayerKey: process.env.BRIDGE_RELAYER_KEY,
    verifierUrl: process.env.VERIFIER_URL,
    verifierApiKey: process.env.VERIFIER_API_KEY,
    seaportConduitKey: process.env.SEAPORT_CONDUIT_KEY,
    seaportZoneAddress: process.env.SEAPORT_ZONE_ADDRESS,
    protocolFeeRecipient: process.env.PROTOCOL_FEE_RECIPIENT,
    onrampApiKey: process.env.ONRAMP_API_KEY,
    resendApiKey: process.env.RESEND_API_KEY,
    deployerPrivateKey: process.env.DEPLOYER_PRIVATE_KEY,
    etherscanApiKey: process.env.ETHERSCAN_API_KEY,
    basescanApiKey: process.env.BASESCAN_API_KEY,
  });
  return cached;
}

/**
 * Non-fatal startup check. Call from server bootstrap with the keys a given
 * deployment needs; returns which are missing so you can log/alert. Mock mode
 * needs none of these, so this never throws.
 */
export function checkServerEnv(required: Array<keyof ServerEnv> = []): {
  ok: boolean;
  missing: Array<keyof ServerEnv>;
} {
  if (!isServer) return { ok: true, missing: [] };
  const env = serverEnv();
  const missing = required.filter((k) => !env[k]);
  return { ok: missing.length === 0, missing };
}
