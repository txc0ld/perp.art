/**
 * OffersList - mono table of open offers (PRD §9.2). Price, from, scope, expiry.
 * Empty state when there are none.
 */
import type { Offer } from "@/lib/types";
import { getChainMeta } from "@/lib/mock-data";
import { formatEth, relativeTime } from "@/lib/utils";
import { Identity } from "@/components/identity/Identity";

export function OffersList({ offers }: { offers: Offer[] }) {
  return (
    <div>
      {offers.length === 0 ? (
        <p className="rounded-[8px] border border-dashed border-border px-4 py-6 text-center text-[13px] text-muted">
          No open offers yet. Be the first to make a signed, gasless bid.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-[8px] border border-border">
          <div className="min-w-[320px]">
            {/* Header row */}
            <div className="grid grid-cols-[1fr_auto] gap-3 border-b border-border bg-surface px-4 py-2.5 sm:grid-cols-[1fr_1fr_auto_auto]">
              <span className="font-mono text-[10px] uppercase tracking-wider text-faint">Price</span>
              <span className="hidden font-mono text-[10px] uppercase tracking-wider text-faint sm:block">From</span>
              <span className="hidden font-mono text-[10px] uppercase tracking-wider text-faint sm:block">Scope</span>
              <span className="font-mono text-[10px] uppercase tracking-wider text-faint text-right">Expires</span>
            </div>

            {offers.map((o) => (
              <div
                key={o.orderId}
                className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-border px-4 py-3 last:border-b-0 hover:bg-surface-2 sm:grid-cols-[1fr_1fr_auto_auto]"
              >
                <span className="whitespace-nowrap font-mono text-[13px] tabular-nums text-foreground">
                  {formatEth(o.priceEth)} {getChainMeta(o.chain).currency}
                </span>
                <Identity address={o.from} className="hidden min-w-0 text-[12px] text-muted sm:block" />
                <span className="hidden font-mono text-[10px] uppercase tracking-wider text-muted sm:block">{o.scope}</span>
                <span className="text-right font-mono text-[11px] uppercase tracking-wider text-faint">
                  {relativeTime(o.expiresAt)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
