"use client";

/**
 * TrendingTable - THE signature OpenSea element.
 *
 * A ranked collections table with a client-side time-window toggle. All
 * windows are precomputed on the server and passed in as props (never import
 * data fns into a client component), so toggling is instant and smooth with
 * no navigation. Rows link to /collections/[slug]. Less-important columns
 * collapse on small screens.
 *
 * Semantics: a real <table> with <thead>/<th scope="col"> for screen readers
 * and right-aligned tabular-nums numeric columns. The change column header is
 * driven by the active window so the data and label always agree.
 */
import * as React from "react";
import Link from "next/link";
import { GenerativeArt } from "@/components/art/GenerativeArt";
import { SectionHeader } from "@/components/ui";
import { formatEth, cn } from "@/lib/utils";
import type { CollectionRanking, RankWindow } from "@/lib/mock-data";

const WINDOWS: RankWindow[] = ["1h", "6h", "24h", "7d", "30d"];

function VerifiedMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={cn("h-3.5 w-3.5 text-accent", className)} fill="none" aria-label="verified">
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.3" />
      <path d="M5 8.2l2 2 4-4.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChangeCell({ pct }: { pct: number }) {
  const positive = pct >= 0;
  return (
    <span className={cn("font-mono text-sm tabular-nums", positive ? "text-verify" : "text-[#fda4af]")}>
      <span aria-hidden>{positive ? "▲" : "▼"}</span> {positive ? "+" : "-"}
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

export function TrendingTable({
  data,
  defaultWindow = "24h",
  limit = 6,
}: {
  data: Record<RankWindow, CollectionRanking[]>;
  defaultWindow?: RankWindow;
  limit?: number;
}) {
  const [window, setWindow] = React.useState<RankWindow>(defaultWindow);
  const rows = React.useMemo(() => data[window].slice(0, limit), [data, window, limit]);

  const windowToggle = (
    <div className="flex items-center gap-2">
      <div
        role="group"
        aria-label="Trending time window"
        className="inline-flex items-center gap-1 rounded-full border border-border bg-surface p-1"
      >
        {WINDOWS.map((w) => (
          <button
            key={w}
            type="button"
            onClick={() => setWindow(w)}
            aria-pressed={w === window}
            aria-label={`Show ${w} window`}
            className={cn(
              "min-h-[34px] rounded-full px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider tabular-nums transition-colors duration-200",
              w === window
                ? "bg-accent text-background"
                : "text-muted hover:text-foreground focus-visible:text-foreground",
            )}
          >
            {w}
          </button>
        ))}
      </div>
      <Link
        href="/stats"
        className="group hidden shrink-0 items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:text-accent sm:inline-flex"
      >
        View all
        <svg aria-hidden viewBox="0 0 16 16" className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" fill="none">
          <path d="M3 8h9M9 4.5L12.5 8 9 11.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Link>
    </div>
  );

  return (
    <div>
      <SectionHeader
        eyebrow="Live rankings"
        title="Trending collections"
        action={windowToggle}
      />

      {/* table - overflow-x-auto so it never forces page-level horizontal scroll */}
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="min-w-[340px] overflow-hidden rounded-[10px] border border-border bg-surface">
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">
              Top trending collections over the {window} window, ranked by volume.
            </caption>
            <colgroup>
              <col className="w-[44px] sm:w-[52px]" />
              <col />
              <col className="w-0 sm:w-[112px]" />
              <col className="w-0 md:w-[112px]" />
              <col className="w-[84px]" />
              <col className="w-0 sm:w-[112px]" />
              <col className="w-0 lg:w-[80px]" />
            </colgroup>
            <thead>
              <tr className="border-b border-border font-mono text-[10px] uppercase tracking-wider text-faint">
                <th scope="col" className="px-3 py-3 text-center font-semibold sm:px-4">#</th>
                <th scope="col" className="py-3 pr-3 font-semibold">Collection</th>
                <th scope="col" className="hidden px-3 py-3 text-right font-semibold sm:table-cell">Floor</th>
                <th scope="col" className="hidden px-3 py-3 text-right font-semibold md:table-cell">Top offer</th>
                <th scope="col" className="px-3 py-3 text-right font-semibold sm:px-4">{window}</th>
                <th scope="col" className="hidden px-3 py-3 text-right font-semibold sm:table-cell">Volume</th>
                <th scope="col" className="hidden px-3 py-3 text-right font-semibold lg:table-cell sm:px-4">Sales</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const c = row.collection;
                return (
                  <tr key={c.slug} className="group border-b border-border transition-colors duration-150 last:border-b-0 hover:bg-surface-2">
                    <td className="px-3 py-3 text-center align-middle font-mono text-sm tabular-nums text-faint sm:px-4">
                      {row.rank}
                    </td>
                    <td className="py-3 pr-3 align-middle">
                      <Link
                        href={`/collections/${c.slug}`}
                        className="flex min-w-0 items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 rounded-[6px]"
                      >
                        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-[8px] border border-border bg-background">
                          <GenerativeArt seed={c.coverSeed} genre={c.genre} size={120} className="h-full w-full" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-sm font-semibold text-foreground group-hover:text-accent">{c.name}</span>
                            {c.sovereign ? <VerifiedMark className="shrink-0" /> : null}
                          </div>
                          {/* mobile-only inline floor, since the Floor column is hidden */}
                          <span className="font-mono text-[11px] tabular-nums text-faint sm:hidden">
                            Floor {formatEth(c.floorEth)} ETH
                          </span>
                        </div>
                      </Link>
                    </td>
                    <td className="hidden px-3 py-3 text-right align-middle font-mono text-sm tabular-nums text-foreground sm:table-cell">
                      {formatEth(row.floorEth)} ETH
                    </td>
                    <td className="hidden px-3 py-3 text-right align-middle font-mono text-sm tabular-nums text-muted md:table-cell">
                      {formatEth(row.topOfferEth)} ETH
                    </td>
                    <td className="px-3 py-3 text-right align-middle sm:px-4">
                      <ChangeCell pct={row.changePct} />
                    </td>
                    <td className="hidden px-3 py-3 text-right align-middle font-mono text-sm tabular-nums text-foreground sm:table-cell">
                      {formatEth(row.volumeEth)} ETH
                    </td>
                    <td className="hidden px-3 py-3 text-right align-middle font-mono text-sm tabular-nums text-muted lg:table-cell sm:px-4">
                      {row.salesCount}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* mobile "view all" */}
      <div className="mt-5 sm:hidden">
        <Link href="/stats" className="font-mono text-[11px] uppercase tracking-wider text-muted hover:text-accent">
          View all rankings
        </Link>
      </div>
    </div>
  );
}

export default TrendingTable;
