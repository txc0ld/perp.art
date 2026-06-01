/**
 * ProfileSwaps — the profile Swaps tab. The swaps mechanism isn't live yet, so
 * this shows an honest coming-soon state instead of fabricated incoming/outgoing
 * barter. Keeps the `address` prop so the tab wiring is unchanged for when swaps
 * ship (address is intentionally unused for now).
 */
import { EmptyState } from "@/components/ui";

export function ProfileSwaps({ address: _address }: { address: string }) {
  return (
    <EmptyState
      eyebrow="Coming soon"
      title="Swaps are coming soon"
      body="Incoming and outgoing barter for your works will live here — accept, decline, or counter NFT-for-NFT trades with optional ETH balancing and cross-chain settlement. The mechanism is in build and not yet live."
    />
  );
}
