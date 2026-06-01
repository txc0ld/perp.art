import type { Metadata } from "next";
import { Section, SectionHeader, EmptyState, ButtonLink } from "@/components/ui";

export const metadata: Metadata = {
  title: "Swaps - Perpetual",
  description:
    "NFT-for-NFT barter with cross-chain settlement — coming soon. Trade work for work, balance value with ETH, and settle atomically across chains. Not yet live.",
};

/**
 * Swaps — the trading desk for NFT-for-NFT barter and cross-chain settlement, the
 * differentiator OpenSea abandoned. The mechanism isn't live yet, so rather than
 * fabricate an orderbook we present it honestly as forthcoming. The route and nav
 * entry stay so the concept is discoverable; the swap-criteria logic is retained
 * for when it ships.
 */
export default function SwapsPage() {
  return (
    <Section>
      <SectionHeader
        eyebrow="Trade"
        title="Swaps"
        description="NFT for NFT, settled atomically. Barter work directly, balance value with ETH on either side, and settle across chains through an escrow bridge that rolls back if either leg fails. Perpetual never takes custody."
      />

      <EmptyState
        eyebrow="Coming soon"
        title="Swaps are coming soon"
        body="On-chain barter and cross-chain trades — NFT for NFT, balanced with ETH, settled atomically via escrow. The mechanism is in build and not yet live. We won't show fabricated orders in the meantime."
        action={
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <ButtonLink href="/explore" variant="accent" size="lg">Explore works</ButtonLink>
            <ButtonLink href="/permanence" variant="secondary" size="lg">How permanence works</ButtonLink>
          </div>
        }
      />
    </Section>
  );
}
