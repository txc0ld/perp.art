/**
 * TokenSwaps - the swaps section on the token page. Lists active swap interest in
 * this token (getSwapsForToken passed as a prop from the server page) and offers a
 * prominent "Propose a swap" CTA. Server component shell; interactivity lives in
 * the SwapList / ProposeSwapButton client components.
 */
import type { SwapOrder, Token } from "@/lib/types";
import { SwapList } from "@/components/swap/SwapList";
import { ProposeSwapButton } from "@/components/swap/ProposeSwapButton";

export function TokenSwaps({ token, swaps }: { token: Token; swaps: SwapOrder[] }) {
  const active = swaps.filter((s) => s.status === "open" || s.status === "countered");

  return (
    <div className="flex flex-col gap-5">
      <SwapList
        swaps={active}
        variant="open"
        heading="Open swap interest"
        emptyTitle="No open swaps for this work yet"
        emptyBody="Be the first to barter. Offer a piece from your collection, balance with ETH if needed, even across chains."
        action={
          <ProposeSwapButton token={token} variant="accent" size="sm">
            Propose a swap
          </ProposeSwapButton>
        }
      />
      {active.length > 0 && (
        <div>
          <ProposeSwapButton token={token} variant="accent" size="lg" className="w-full sm:w-auto">
            Propose a swap for this work
          </ProposeSwapButton>
        </div>
      )}
    </div>
  );
}
