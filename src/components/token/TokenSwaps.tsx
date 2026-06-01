/**
 * TokenSwaps — the swaps section on the token page. The swaps mechanism isn't
 * live yet, so rather than show fabricated barter interest this renders an honest
 * "coming soon" note. Keeps the `token`/`swaps` props so the token page wiring is
 * unchanged for when swaps ship (swaps is intentionally unused for now).
 */
import type { SwapOrder, Token } from "@/lib/types";
import { EmptyState } from "@/components/ui";

export function TokenSwaps({ token: _token, swaps: _swaps }: { token: Token; swaps: SwapOrder[] }) {
  return (
    <EmptyState
      eyebrow="Coming soon"
      title="Swaps are coming soon"
      body="Soon you'll be able to barter for this work — offer a piece from your collection, balance with ETH if needed, even across chains. The mechanism is in build and not yet live."
    />
  );
}
