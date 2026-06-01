/**
 * ProvenanceTimeline - vertical mono timeline (PRD §7.4, design prompt §4.3).
 * Newest-first. Each event: kind, relative time, addresses, price, and a tx hash
 * linking to a block explorer. Engineered, archival feel with a hairline connector.
 */
import type { ProvenanceEvent } from "@/lib/types";
import { shortHash, formatEth, relativeTime, cn } from "@/lib/utils";
import { explorerTx } from "@/lib/web3/contracts";
import { Identity } from "@/components/identity/Identity";

const KIND_LABEL: Record<ProvenanceEvent["kind"], string> = {
  created: "Created",
  minted: "Minted",
  listed: "Listed",
  offer: "Offer",
  sale: "Sale",
  transfer: "Transfer",
};

export function ProvenanceTimeline({ events, chainId }: { events: ProvenanceEvent[]; chainId?: number }) {
  return (
    <div>
      <ol className="space-y-0">
        {events.map((e, i) => {
          const last = i === events.length - 1;
          const accent = e.kind === "minted" || e.kind === "created";
          return (
            <li key={`${e.kind}-${e.timestamp}-${i}`} className="relative flex gap-4 pb-7 last:pb-0">
              {/* Connector + node */}
              <div className="relative flex w-3 shrink-0 flex-col items-center">
                <span
                  className={cn(
                    "mt-1 h-2.5 w-2.5 shrink-0 rounded-full border",
                    accent ? "border-accent bg-accent/30" : "border-border-bright bg-surface",
                  )}
                />
                {!last && <span className="mt-1 w-px flex-1 bg-border" />}
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1 pb-1">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-foreground">
                    {KIND_LABEL[e.kind]}
                  </span>
                  <span className="font-mono text-[11px] uppercase tracking-wider text-faint">
                    {relativeTime(e.timestamp)}
                  </span>
                  {typeof e.priceEth === "number" && (
                    <span className="font-mono text-[12px] tabular-nums text-accent">
                      {formatEth(e.priceEth)} ETH
                    </span>
                  )}
                </div>

                <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] text-muted">
                  {e.from && (
                    <span className="inline-flex items-center gap-1">
                      <span className="text-faint">from </span>
                      <Identity address={e.from} className="text-muted" />
                    </span>
                  )}
                  {e.to && (
                    <span className="inline-flex items-center gap-1">
                      <span className="text-faint">to </span>
                      <Identity address={e.to} className="text-muted" />
                    </span>
                  )}
                  {typeof e.blockNumber === "number" && (
                    <span className="text-faint tabular-nums">#{e.blockNumber.toLocaleString()}</span>
                  )}
                  {e.txHash && (
                    <a
                      href={explorerTx(chainId, e.txHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-faint underline-offset-2 transition-colors hover:text-accent hover:underline"
                    >
                      {shortHash(e.txHash, 6)}
                    </a>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
