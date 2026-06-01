import { keccak256, concatHex, type Hex } from "viem";

/** Hard ceiling on drop size (entry count). Mirrors the contract's intent and
 *  the spec's MAX_DROP_SIZE. Enforced server-side during processing. */
export const MAX_DROP_SIZE = 7000;

/**
 * Per-asset hash: keccak256 of the raw asset bytes.
 * Deterministic and order-independent at this level.
 */
export function hashAsset(bytes: Uint8Array): Hex {
  return keccak256(bytes);
}

/**
 * Provenance hash = keccak256( concat( orderedAssetHashes ) ).
 *
 * `orderedAssetHashes` MUST already be in canonical token order (token #1 first,
 * #N last). Each entry is a 32-byte keccak hash (0x-prefixed, 66 chars). The
 * concatenation is the raw bytes of every hash in order, then hashed once. This
 * is the value committed on-chain via `commitProvenance` and the anchor a
 * collector recomputes from the published per-asset manifest post-reveal.
 *
 * Empty input is rejected — a drop with zero assets has no provenance.
 */
export function computeProvenanceHash(orderedAssetHashes: Hex[]): Hex {
  if (orderedAssetHashes.length === 0) {
    throw new Error("computeProvenanceHash: no asset hashes");
  }
  for (const h of orderedAssetHashes) {
    if (!/^0x[0-9a-fA-F]{64}$/.test(h)) {
      throw new Error(`computeProvenanceHash: not a 32-byte hash: ${h}`);
    }
  }
  return keccak256(concatHex(orderedAssetHashes));
}
