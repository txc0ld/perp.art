import { publicEnv } from "@/lib/env";

export interface ResolveOpts {
  /** Original media MIME, forwarded to the LOG resolver for Content-Type. */
  mime?: string;
  /** Chain hint forwarded to the LOG resolver (else inferred from ledger). */
  chainId?: number;
  /** Content hash, so the LOG resolver can fall back to a re-emitted version
   *  if the original logs were pruned (same hash → same root). */
  contentHash?: string;
}

/**
 * Turn a stored shard URI into a fetchable URL the browser can load.
 *  - log://<ledger>/<fileId> -> /api/shard/log/<ledger>/<fileId>[?mime&chainId]
 *  - ipfs:// / ar:// / irys:// -> their configured gateways
 *  - http(s):, data:, anything else -> passed through unchanged
 */
export function resolveShardUrl(uri: string, opts: ResolveOpts = {}): string {
  if (!uri) return uri;

  if (uri.startsWith("log://")) {
    const [ledger, fileId] = uri.slice("log://".length).split("/");
    const params = new URLSearchParams();
    if (opts.mime) params.set("mime", opts.mime);
    if (opts.chainId) params.set("chainId", String(opts.chainId));
    if (opts.contentHash) params.set("contentHash", opts.contentHash);
    const qs = params.toString();
    return `/api/shard/log/${ledger}/${fileId}${qs ? `?${qs}` : ""}`;
  }

  const gateway = (base: string, rest: string) => `${base.replace(/\/$/, "")}/${rest}`;
  if (uri.startsWith("ipfs://")) return gateway(publicEnv.ipfsGateway, uri.slice("ipfs://".length));
  if (uri.startsWith("ar://")) return gateway(publicEnv.arweaveGateway, uri.slice("ar://".length));
  if (uri.startsWith("irys://")) return gateway(publicEnv.irysGateway, uri.slice("irys://".length));

  return uri;
}
