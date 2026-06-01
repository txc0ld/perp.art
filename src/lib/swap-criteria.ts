/**
 * Swap criteria matching — pure logic for criteria-based (open) swap requests.
 * Retained for when swaps go live; depends only on the Token + SwapCriteria
 * types, no fabricated catalog.
 */
import type { Token, SwapCriteria } from "./types";

export type { SwapCriteria } from "./types";

/** Does a token satisfy a criteria-based swap request? */
export function tokenMatchesCriteria(token: Token, c: SwapCriteria): boolean {
  if (c.collectionSlug && token.collectionSlug !== c.collectionSlug) return false;
  if (c.traitKey && c.traitValue) {
    return token.traits.some((t) => t.key === c.traitKey && t.value === c.traitValue);
  }
  return true;
}
