"use client";

/**
 * BuyPanel - the primary commerce surface (design prompt §4.3, PRD §10.2).
 * Price (mono, large), chain badge, the single accent CTA (Buy now), a secondary
 * Make offer, and the best current offer. Wallet-aware: when disconnected, the CTA
 * connects first. Buy opens the fee-breakdown modal.
 */
import * as React from "react";
import type { Token } from "@/lib/types";
import { Button, Badge, MonoLabel } from "@/components/ui";
import { useWallet, connectWallet } from "@/lib/wallet";
import { formatEth, shortAddress, relativeTime } from "@/lib/utils";
import { BuyModal } from "./BuyModal";

export function BuyPanel({ token }: { token: Token }) {
  const { connected } = useWallet();
  const [modalOpen, setModalOpen] = React.useState(false);

  const listing = token.listing;
  const bestOffer = token.offers.length > 0 ? token.offers[0] : undefined;
  const chainLabel = token.chain === "ethereum" ? "Mainnet" : "Base";

  function handleBuy() {
    if (!connected) {
      connectWallet();
      return;
    }
    setModalOpen(true);
  }

  function handleOffer() {
    if (!connected) {
      connectWallet();
    }
    // Offer composer is out of scope for this surface; the listing/offer flow is
    // gasless and signature-based (PRD §9.2). Intentional no-op beyond connect.
  }

  return (
    <div className="rounded-[8px] border border-border bg-surface p-5">
      {listing ? (
        <>
          <div className="flex items-end justify-between gap-4">
            <div>
              <MonoLabel className="text-faint">Price</MonoLabel>
              <p className="mt-1.5 font-mono text-[28px] font-semibold leading-none tabular-nums text-foreground">
                {formatEth(listing.priceEth)}
                <span className="ml-1.5 text-base font-medium text-muted">ETH</span>
              </p>
            </div>
            <Badge tone="muted">{chainLabel}</Badge>
          </div>

          <p className="mt-2 font-mono text-[11px] uppercase tracking-wider text-faint">
            Listing expires {relativeTime(listing.expiresAt)}
          </p>

          <div className="mt-5 flex flex-col gap-2.5">
            <Button variant="accent" size="lg" onClick={handleBuy} className="w-full">
              {connected ? "Buy now" : "Connect wallet to buy"}
            </Button>
            <Button variant="secondary" size="lg" onClick={handleOffer} className="w-full">
              Make offer
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between gap-4">
            <div>
              <MonoLabel className="text-faint">Status</MonoLabel>
              <p className="mt-1.5 text-lg font-medium text-foreground">Not listed</p>
            </div>
            <Badge tone="muted">{chainLabel}</Badge>
          </div>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">
            This work is not for sale right now. You can make a signed, gasless offer the
            owner can accept at any time.
          </p>
          <Button variant="accent" size="lg" onClick={handleOffer} className="mt-5 w-full">
            {connected ? "Make offer" : "Connect wallet to offer"}
          </Button>
        </>
      )}

      {/* Best current offer */}
      <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
        <MonoLabel className="text-faint">Best offer</MonoLabel>
        {bestOffer ? (
          <span className="font-mono text-[13px] tabular-nums text-foreground">
            {formatEth(bestOffer.priceEth)} ETH
            <span className="ml-2 text-faint">{shortAddress(bestOffer.from)}</span>
          </span>
        ) : (
          <span className="font-mono text-[12px] uppercase tracking-wider text-faint">None yet</span>
        )}
      </div>

      {modalOpen && listing && <BuyModal token={token} onClose={() => setModalOpen(false)} />}
    </div>
  );
}
