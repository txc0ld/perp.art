/**
 * TopMovers - a horizontal row of small cards highlighting the collections
 * with the largest floor change in the window. Big mono % change, green for
 * positive, rose for negative. Server component.
 */
import Link from "next/link";
import { GenerativeArt } from "@/components/art/GenerativeArt";
import { formatEth, cn } from "@/lib/utils";
import type { CollectionRanking } from "@/lib/mock-data";

export function TopMovers({ movers }: { movers: CollectionRanking[] }) {
  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="label-mono text-faint">Last 24 hours</p>
          <h2 className="display-sm mt-3 font-brand text-foreground">Top movers</h2>
        </div>
      </div>

      <div className="mt-7 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {movers.map((row) => {
          const c = row.collection;
          const positive = row.changePct >= 0;
          return (
            <Link
              key={c.slug}
              href={`/collections/${c.slug}`}
              className="group flex items-center gap-3 rounded-[10px] border border-border bg-surface p-3 transition-colors duration-200 hover:border-border-bright hover:bg-surface-2"
            >
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-[8px] border border-border bg-background">
                <GenerativeArt seed={c.coverSeed} genre={c.genre} size={160} className="h-full w-full" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{c.name}</p>
                <p className="font-mono text-[11px] tabular-nums text-faint">
                  Floor {formatEth(c.floorEth)} ETH
                </p>
              </div>
              <span
                className={cn(
                  "shrink-0 font-mono text-base font-semibold tabular-nums",
                  positive ? "text-verify" : "text-[#fda4af]",
                )}
              >
                {positive ? "▲" : "▼"} {Math.abs(row.changePct).toFixed(1)}%
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default TopMovers;
