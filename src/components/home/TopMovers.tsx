/**
 * TopMovers - a horizontal row of small cards highlighting the collections
 * with the largest floor change in the window. Big mono % change, green for
 * positive, rose for negative. Server component.
 */
import Link from "next/link";
import { GenerativeArt } from "@/components/art/GenerativeArt";
import { SectionHeader } from "@/components/ui";
import { formatEth, cn } from "@/lib/utils";
import { getChainMeta } from "@/lib/mock-data";
import type { CollectionRanking } from "@/lib/mock-data";

export function TopMovers({ movers }: { movers: CollectionRanking[] }) {
  return (
    <div>
      <SectionHeader eyebrow="Floor change / 24h" title="Top movers" />

      <div className="grid grid-cols-1 gap-3 min-[440px]:grid-cols-2 lg:grid-cols-4">
        {movers.map((row) => {
          const c = row.collection;
          const positive = row.changePct >= 0;
          return (
            <Link
              key={c.slug}
              href={`/collections/${c.slug}`}
              className="group flex min-h-[44px] items-center gap-3 rounded-[10px] border border-border bg-surface p-3 transition-colors duration-200 hover:border-border-bright hover:bg-surface-2"
            >
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-[8px] border border-border bg-background">
                <GenerativeArt seed={c.coverSeed} genre={c.genre} size={160} className="h-full w-full" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground group-hover:text-accent">{c.name}</p>
                <div className="mt-0.5 flex items-baseline justify-between gap-2">
                  <p className="truncate font-mono text-[11px] tabular-nums text-faint">
                    {formatEth(c.floorEth)} {getChainMeta(c.chain).currency}
                  </p>
                  <span
                    className={cn(
                      "shrink-0 whitespace-nowrap font-mono text-[13px] font-semibold tabular-nums",
                      positive ? "text-verify" : "text-[#fda4af]",
                    )}
                  >
                    <span aria-hidden>{positive ? "▲" : "▼"}</span> {positive ? "+" : "-"}{Math.abs(row.changePct).toFixed(1)}%
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default TopMovers;
