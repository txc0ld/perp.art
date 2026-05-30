"use client";

/**
 * ProfileSwaps - the connected user's incoming + outgoing swaps. Resolved against
 * the live wallet address so the lists track whichever account is connected.
 */
import { useMemo } from "react";
import { getSwapsForUser } from "@/lib/mock-data";
import { SwapList } from "@/components/swap/SwapList";

export function ProfileSwaps({ address }: { address: string }) {
  const { incoming, outgoing } = useMemo(() => getSwapsForUser(address), [address]);

  return (
    <div className="flex flex-col gap-10">
      <SwapList
        swaps={incoming}
        variant="incoming"
        heading="Incoming"
        emptyTitle="No incoming swaps"
        emptyBody="When a collector proposes a barter for one of your works, it lands here to accept, decline, or counter."
      />
      <SwapList
        swaps={outgoing}
        variant="outgoing"
        heading="Outgoing"
        emptyTitle="No outgoing swaps"
        emptyBody="Swaps you propose from any token page appear here while they wait on the counterparty."
      />
    </div>
  );
}
