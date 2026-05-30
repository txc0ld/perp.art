"use client";

import * as React from "react";
import Link from "next/link";
import type { Genre, Chain } from "@/lib/types";
import type { CollectionRanking, RankWindow } from "@/lib/mock-data";
import { cn, formatEth } from "@/lib/utils";
import { GenerativeArt } from "@/components/art/GenerativeArt";
import { StatusGlyph } from "@/components/ui";
import { PctChange } from "./PctChange";

const WINDOWS: RankWindow[] = ["1h", "6h", "24h", "7d", "30d"];
const WINDOW_LABEL: Record<RankWindow, string> = {
  "1h": "1H", "6h": "6H", "24h": "24H", "7d": "7D", "30d": "30D",
};

type ChainFilter = "all" | Chain;
type SortKey = "rank" | "floorEth" | "topOfferEth" | "changePct" | "volumeEth" | "salesCount";
type SortDir = "asc" | "desc";

/**
 * OpenSea-style rankings table. Receives precomputed rows for every time window
 * as props (all data access stays on the server) and toggles window / category /
 * chain on the client. Each row is a single focusable link to the collection
 * detail page; columns are sortable. A11y: semantic table with sr-only caption,
 * colgroup for stable widths, aria-sort on the active column.
 */
export function RankingsTable({
  data,
  genres,
}: {
  data: Record<RankWindow, CollectionRanking[]>;
  genres: Genre[];
}) {
  const [window, setWindow] = React.useState<RankWindow>("24h");
  const [genre, setGenre] = React.useState<Genre | "all">("all");
  const [chain, setChain] = React.useState<ChainFilter>("all");
  const [sortKey, setSortKey] = React.useState<SortKey>("volumeEth");
  const [sortDir, setSortDir] = React.useState<SortDir>("desc");

  const rows = React.useMemo(() => {
    const filtered = data[window].filter((r) => {
      if (genre !== "all" && r.collection.genre !== genre) return false;
      if (chain !== "all" && r.collection.chain !== chain) return false;
      return true;
    });
    // Stable rank by volume (the canonical ranking) is assigned first.
    const ranked = [...filtered]
      .sort((a, b) => b.volumeEth - a.volumeEth)
      .map((r, i) => ({ ...r, rank: i + 1 }));

    const dir = sortDir === "asc" ? 1 : -1;
    return [...ranked].sort((a, b) => {
      // Rank sorts ascending visually means 1..N; treat as numeric.
      const av = a[sortKey];
      const bv = b[sortKey];
      return (av - bv) * dir;
    });
  }, [data, window, genre, chain, sortKey, sortDir]);

  // Toggle: clicking the active column flips direction; a new column gets its
  // sensible default (rank asc, everything else desc).
  function requestSort(key: SortKey) {
    setSortKey((prevKey) => {
      if (prevKey === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return key;
      }
      setSortDir(key === "rank" ? "asc" : "desc");
      return key;
    });
  }

  const ariaSortFor = (key: SortKey): React.AriaAttributes["aria-sort"] =>
    sortKey === key ? (sortDir === "asc" ? "ascending" : "descending") : "none";

  return (
    <div>
      {/* Controls */}
      <div className="flex flex-col gap-4 border-b border-border pb-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <div
            className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            role="group"
            aria-label="Time window"
          >
            {WINDOWS.map((w) => (
              <Pill key={w} active={window === w} onClick={() => setWindow(w)}>
                {WINDOW_LABEL[w]}
              </Pill>
            ))}
          </div>
          <span className="mx-1 hidden h-5 w-px bg-border sm:block" aria-hidden />
          <div
            className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 sm:mx-0 sm:ml-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            role="group"
            aria-label="Chain"
          >
            <Pill active={chain === "all"} onClick={() => setChain("all")}>All chains</Pill>
            <Pill active={chain === "ethereum"} onClick={() => setChain("ethereum")}>Ethereum</Pill>
            <Pill active={chain === "base"} onClick={() => setChain("base")}>Base</Pill>
          </div>
        </div>

        <div
          className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="group"
          aria-label="Category"
        >
          <Pill active={genre === "all"} onClick={() => setGenre("all")}>All</Pill>
          {genres.map((g) => (
            <Pill key={g} active={genre === g} onClick={() => setGenre(g)}>{g}</Pill>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse">
          <caption className="sr-only">
            Collections ranked by {WINDOW_LABEL[window]} trading volume. Use the column
            headers to sort, and the filters above to narrow by chain and category.
          </caption>
          <colgroup>
            <col className="w-[52px]" />
            <col />
            <col className="w-[120px]" />
            <col className="w-[120px]" />
            <col className="w-[112px]" />
            <col className="w-[128px]" />
            <col className="w-[96px]" />
          </colgroup>
          <thead className="sticky top-0 z-10 bg-background/90 backdrop-blur-md">
            <tr className="border-b border-border text-faint">
              <SortableTh
                className="pl-2 text-left"
                active={sortKey === "rank"}
                dir={sortDir}
                ariaSort={ariaSortFor("rank")}
                onClick={() => requestSort("rank")}
                align="left"
              >
                #
              </SortableTh>
              <Th scope="col" className="text-left">Collection</Th>
              <SortableTh
                active={sortKey === "floorEth"}
                dir={sortDir}
                ariaSort={ariaSortFor("floorEth")}
                onClick={() => requestSort("floorEth")}
              >
                Floor
              </SortableTh>
              <SortableTh
                className="hidden sm:table-cell"
                active={sortKey === "topOfferEth"}
                dir={sortDir}
                ariaSort={ariaSortFor("topOfferEth")}
                onClick={() => requestSort("topOfferEth")}
              >
                Top offer
              </SortableTh>
              <SortableTh
                active={sortKey === "changePct"}
                dir={sortDir}
                ariaSort={ariaSortFor("changePct")}
                onClick={() => requestSort("changePct")}
              >
                {WINDOW_LABEL[window]} %
              </SortableTh>
              <SortableTh
                active={sortKey === "volumeEth"}
                dir={sortDir}
                ariaSort={ariaSortFor("volumeEth")}
                onClick={() => requestSort("volumeEth")}
              >
                Volume
              </SortableTh>
              <SortableTh
                className="hidden md:table-cell"
                active={sortKey === "salesCount"}
                dir={sortDir}
                ariaSort={ariaSortFor("salesCount")}
                onClick={() => requestSort("salesCount")}
              >
                Sales
              </SortableTh>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <Row key={r.collection.slug} row={r} window={window} />
            ))}
          </tbody>
        </table>

        {rows.length === 0 && (
          <p className="py-16 text-center text-sm text-muted">
            No collections match these filters. Try a wider time window or category.
          </p>
        )}
      </div>
    </div>
  );
}

function Row({ row, window }: { row: CollectionRanking; window: RankWindow }) {
  const c = row.collection;
  const chainLabel = c.chain === "ethereum" ? "Ethereum" : "Base";
  const label =
    `Rank ${row.rank}: ${c.name} on ${chainLabel}. Floor ${formatEth(row.floorEth)} ETH, ` +
    `${WINDOW_LABEL[window]} volume ${formatEth(row.volumeEth)} ETH.`;
  return (
    <tr className="group border-b border-border transition-colors hover:bg-surface focus-within:bg-surface">
      <td className="h-[68px] pl-2 text-left font-mono text-sm tabular-nums text-faint">
        {row.rank}
      </td>
      <td>
        <Link
          href={`/collections/${c.slug}`}
          aria-label={label}
          className="flex items-center gap-3 py-3 pr-4 rounded-[8px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-[8px] border border-border bg-background">
            <GenerativeArt seed={c.coverSeed} genre={c.genre} size={120} className="h-full w-full" />
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-1.5">
              <span className="truncate text-sm font-medium text-foreground">{c.name}</span>
              {c.sovereign ? (
                <StatusGlyph status="verified" className="shrink-0" />
              ) : null}
            </span>
            <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-wider text-faint">
              {chainLabel}
            </span>
          </span>
        </Link>
      </td>
      <Td>{formatEth(row.floorEth)} ETH</Td>
      <Td className="hidden sm:table-cell">{formatEth(row.topOfferEth)} ETH</Td>
      <td className="py-4 pr-4 text-right">
        <PctChange value={row.changePct} className="justify-end" />
      </td>
      <Td className="text-foreground">{formatEth(row.volumeEth)} ETH</Td>
      <Td className="hidden md:table-cell">{row.salesCount.toLocaleString()}</Td>
    </tr>
  );
}

function Th({
  className,
  children,
  scope = "col",
}: {
  className?: string;
  children: React.ReactNode;
  scope?: "col" | "row";
}) {
  return (
    <th
      scope={scope}
      className={cn(
        "py-3 pr-4 font-mono text-[10px] font-semibold uppercase tracking-wider",
        className,
      )}
    >
      {children}
    </th>
  );
}

/** A sortable column header: a real button inside the th, with aria-sort on the th. */
function SortableTh({
  className,
  children,
  active,
  dir,
  ariaSort,
  onClick,
  align = "right",
}: {
  className?: string;
  children: React.ReactNode;
  active: boolean;
  dir: SortDir;
  ariaSort: React.AriaAttributes["aria-sort"];
  onClick: () => void;
  align?: "left" | "right";
}) {
  return (
    <th
      scope="col"
      aria-sort={ariaSort}
      className={cn(
        "py-3 pr-4 font-mono text-[10px] font-semibold uppercase tracking-wider",
        align === "right" ? "text-right" : "text-left",
        className,
      )}
    >
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "inline-flex min-h-[24px] items-center gap-1 rounded-[6px] px-1 -mx-1 uppercase tracking-wider transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          align === "right" && "flex-row-reverse",
          active ? "text-foreground" : "text-faint hover:text-muted",
        )}
      >
        {children}
        <span
          aria-hidden
          className={cn(
            "text-[8px] leading-none transition-opacity",
            active ? "opacity-100 text-accent" : "opacity-0",
          )}
        >
          {dir === "asc" ? "▲" : "▼"}
        </span>
      </button>
    </th>
  );
}

function Td({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <td className={cn("py-4 pr-4 text-right font-mono text-[13px] tabular-nums text-muted", className)}>
      {children}
    </td>
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex h-11 shrink-0 items-center rounded-full px-3.5 font-mono text-[11px] font-semibold uppercase tracking-wider leading-none transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        active
          ? "bg-accent text-background"
          : "border border-border bg-surface text-muted hover:border-border-bright hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
