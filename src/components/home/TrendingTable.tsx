"use client";

/**
 * TrendingTable - THE signature OpenSea element.
 *
 * A ranked collections table with a client-side time-window toggle. All
 * windows are precomputed on the server and passed in as props (never import
 * data fns into a client component), so toggling is instant and smooth with
 * no navigation. Rows link to /collections/[slug]. Less-important columns
 * collapse on small screens.
 */
import * as React from "react";
import Link from "next/link";
import { GenerativeArt } from "@/components/art/GenerativeArt";
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
      {positive ? "▲" : "▼"} {Math.abs(pct).toFixed(1)}%
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
  const rows = data[window].slice(0, limit);

  return (
    <div>
      {/* header + window toggle */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label-mono text-faint">Live rankings</p>
          <h2 className="display-sm mt-3 font-brand text-foreground">Trending collections</h2>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-1 rounded-full border border-border bg-surface p-1">
            {WINDOWS.map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setWindow(w)}
                aria-pressed={w === window}
                className={cn(
                  "rounded-full px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider tabular-nums transition-colors duration-200",
                  w === window ? "bg-accent text-background" : "text-muted hover:text-foreground",
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
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" fill="none">
              <path d="M3 8h9M9 4.5L12.5 8 9 11.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>
      </div>

      {/* table */}
      <div className="mt-7 overflow-hidden rounded-[10px] border border-border bg-surface">
        {/* column header row */}
        <div className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-4 border-b border-border px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-faint sm:grid-cols-[32px_minmax(0,1fr)_repeat(5,minmax(72px,0.7fr))] sm:px-5">
          <span className="text-center">#</span>
          <span>Collection</span>
          <span className="hidden text-right sm:block">Floor</span>
          <span className="hidden text-right md:block">Top offer</span>
          <span className="text-right">24h</span>
          <span className="hidden text-right sm:block">Volume</span>
          <span className="hidden text-right lg:block">Sales</span>
        </div>

        {rows.map((row) => {
          const c = row.collection;
          return (
            <Link
              key={c.slug}
              href={`/collections/${c.slug}`}
              className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-4 border-b border-border px-4 py-3 transition-colors duration-150 last:border-b-0 hover:bg-surface-2 sm:grid-cols-[32px_minmax(0,1fr)_repeat(5,minmax(72px,0.7fr))] sm:px-5"
            >
              <span className="text-center font-mono text-sm tabular-nums text-faint">{row.rank}</span>

              {/* collection cell: avatar + name + badges */}
              <div className="flex min-w-0 items-center gap-3">
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-[8px] border border-border bg-background">
                  <GenerativeArt seed={c.coverSeed} genre={c.genre} size={120} className="h-full w-full" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-semibold text-foreground">{c.name}</span>
                    {c.sovereign ? <VerifiedMark className="shrink-0" /> : null}
                  </div>
                  {/* mobile-only inline floor, since the Floor column is hidden */}
                  <span className="font-mono text-[11px] tabular-nums text-faint sm:hidden">
                    Floor {formatEth(c.floorEth)} ETH
                  </span>
                </div>
              </div>

              <span className="hidden text-right font-mono text-sm tabular-nums text-foreground sm:block">
                {formatEth(row.floorEth)} ETH
              </span>
              <span className="hidden text-right font-mono text-sm tabular-nums text-muted md:block">
                {formatEth(row.topOfferEth)} ETH
              </span>
              <span className="text-right">
                <ChangeCell pct={row.changePct} />
              </span>
              <span className="hidden text-right font-mono text-sm tabular-nums text-foreground sm:block">
                {formatEth(row.volumeEth)} ETH
              </span>
              <span className="hidden text-right font-mono text-sm tabular-nums text-muted lg:block">
                {row.salesCount}
              </span>
            </Link>
          );
        })}
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
