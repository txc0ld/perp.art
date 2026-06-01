/**
 * ProfileSwaps — the profile Swaps tab. The swaps mechanism isn't live yet, so
 * this shows an honest coming-soon state instead of fabricated incoming/outgoing
 * barter. Keeps the `address` prop in the signature so the tab wiring is
 * unchanged for when swaps ship (the value isn't read until then).
 */
import { EmptyState } from "@/components/ui";

// `address` is part of the tab's prop contract but isn't read until swaps ship,
// so it's intentionally not bound here (empty destructure = no unused binding).
export function ProfileSwaps({}: { address: string }) {
  return (
    <EmptyState
      eyebrow="Coming soon"
      title="Swaps are coming soon"
      body="Incoming and outgoing barter for your works will live here — accept, decline, or counter NFT-for-NFT trades with optional ETH balancing and cross-chain settlement. The mechanism is in build and not yet live."
    />
  );
}
