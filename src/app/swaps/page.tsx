import type { Metadata } from "next";
import { getOpenSwaps, CURRENT_USER } from "@/lib/mock-data";
import { Section, SectionHeader } from "@/components/ui";
import { SwapsDesk } from "@/components/swap/SwapsDesk";

export const metadata: Metadata = {
  title: "Swaps - Perpetual",
  description:
    "Trade NFT for NFT with cross-chain settlement. Barter works, balance value with ETH, and settle atomically across Ethereum and Base via escrow with rollback. Non-custodial throughout.",
};

/**
 * Swaps - the trading desk for NFT-for-NFT barter and cross-chain settlement, the
 * differentiator OpenSea abandoned. Server component: resolves the open orderbook
 * and the sample account's swaps, then hands plain data to the SwapsDesk client
 * shell, which re-resolves personal tabs against live wallet state.
 */
export default async function SwapsPage() {
  const openSwaps = getOpenSwaps();

  return (
    <Section>
      <SectionHeader
        eyebrow="Trade"
        title="Swaps"
        description="NFT for NFT, settled atomically. Barter works directly, balance value with ETH on either side, and settle across Ethereum and Base through an escrow bridge that rolls back if either leg fails. Perpetual never takes custody."
      />
      <SwapsDesk openSwaps={openSwaps} fallbackAddress={CURRENT_USER.address} />
    </Section>
  );
}
