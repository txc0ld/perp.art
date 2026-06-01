/**
 * orderbook.ts — Server-only Vercel Blob-backed order store.
 *
 * IMPORTANT: Only import this from server code (route handlers, RSC, server
 * actions). The `import "server-only"` guard will throw at runtime if you
 * accidentally import it from a client component.
 */
import "server-only";
import { put, list, del } from "@vercel/blob";
import {
  type SignedOrder,
  type SerializedSignedOrder,
  serializeOrder,
  deserializeOrder,
  orderStorageKey,
} from "./orders";

/**
 * Persist a signed order to Vercel Blob.
 * Uses the deterministic key `orders/<chainId>/<orderHash>.json` so that
 * re-listing the same order (same hash) simply overwrites the previous entry.
 */
export async function putOrder(signed: SignedOrder): Promise<void> {
  const key = orderStorageKey(signed.chainId, signed.orderHash);
  const body = JSON.stringify(serializeOrder(signed));
  await put(key, body, {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}

/**
 * Internal: scan the `orders/<chainId>/` prefix and return every open (non-
 * tombstoned, readable) signed order, optionally filtered by a predicate.
 * Shared by listOpenOrders (per-token) and listAllOpenOrders (whole chain).
 */
async function scanOpenOrders(
  chainId: number,
  match?: (signed: SignedOrder) => boolean,
): Promise<SignedOrder[]> {
  const prefix = `orders/${chainId}/`;
  const { blobs } = await list({ prefix });
  const results: SignedOrder[] = [];

  await Promise.all(
    blobs.map(async (blob) => {
      // Skip tombstone files (filled markers).
      if (blob.pathname.endsWith(".filled")) return;
      try {
        const res = await fetch(blob.url);
        if (!res.ok) return;
        const raw: SerializedSignedOrder = await res.json();
        const signed = deserializeOrder(raw);
        if (!match || match(signed)) {
          results.push(signed);
        }
      } catch {
        // Skip corrupt/unreadable blobs — don't surface them as errors.
      }
    }),
  );

  // Newest first.
  results.sort((a, b) => b.createdAt - a.createdAt);
  return results;
}

/**
 * List open (unfilled) orders for a specific NFT token.
 * Scans the `orders/<chainId>/` prefix, fetches each blob, and filters to
 * those that match the requested nft+tokenId and are not tombstoned.
 */
export async function listOpenOrders(
  chainId: number,
  nft: string,
  tokenId: bigint,
): Promise<SignedOrder[]> {
  return scanOpenOrders(
    chainId,
    (signed) =>
      signed.order.nft.toLowerCase() === nft.toLowerCase() &&
      signed.order.tokenId === tokenId,
  );
}

/**
 * List ALL open (unfilled) orders for a chain — the whole orderbook for that
 * chain, with no nft/tokenId filter. Used to enrich the live catalog with
 * marketplace listings. Skips `.filled` tombstones and unreadable blobs.
 */
export async function listAllOpenOrders(chainId: number): Promise<SignedOrder[]> {
  return scanOpenOrders(chainId);
}

/**
 * Mark an order as filled by deleting its blob.
 * Idempotent: if the blob does not exist (already deleted or never stored),
 * this resolves without error.
 */
export async function markFilled(
  chainId: number,
  orderHash: string,
): Promise<void> {
  const key = orderStorageKey(chainId, orderHash);
  // del() accepts a URL or a pathname. The blob SDK resolves by pathname when
  // a store token is available. Wrap in try/catch for idempotency.
  try {
    await del(key);
  } catch {
    // Already deleted or not found — treat as success.
  }
}
