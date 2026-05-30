/**
 * OffersList - mono table of open offers (PRD §9.2). Price, from, scope, expiry.
 * Empty state when there are none.
 */
import type { Offer } from "@/lib/types";
import { formatEth, shortAddress, relativeTime } from "@/lib/utils";

export function OffersList({ offers }: { offers: Offer[] }) {
  return (
    <div>
      {offers.length === 0 ? (
        <p className="rounded-[8px] border border-dashed border-border px-4 py-6 text-center text-[13px] text-muted">
          No open offers. Be the first to make a signed, gasless offer.
        </p>
      ) : (
        <div className="overflow-hidden rounded-[8px] border border-border">
          {/* Header row */}
          <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-3 border-b border-border bg-surface px-4 py-2.5">
            {["Price", "From", "Scope", "Expires"].map((h) => (
              <span
                key={h}
                className="font-mono text-[10px] uppercase tracking-wider text-faint last:text-right"
              >
                {h}
              </span>
            ))}
          </div>

          {offers.map((o) => (
            <div
              key={o.orderId}
              className="grid grid-cols-[1fr_1fr_auto_auto] items-center gap-3 border-b border-border px-4 py-3 last:border-b-0 hover:bg-surface-2"
            >
              <span className="font-mono text-[13px] tabular-nums text-foreground">
                {formatEth(o.priceEth)} ETH
              </span>
              <span className="truncate font-mono text-[12px] text-muted">{shortAddress(o.from)}</span>
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted">{o.scope}</span>
              <span className="text-right font-mono text-[11px] uppercase tracking-wider text-faint">
                {relativeTime(o.expiresAt)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
