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

/**
 * OpenSea-style rankings table. Receives precomputed rows for every time window
 * as props (all data access stays on the server) and toggles window / category /
 * chain on the client. Rows link to the collection detail page.
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

  const rows = React.useMemo(() => {
    const filtered = data[window].filter((r) => {
      if (genre !== "all" && r.collection.genre !== genre) return false;
      if (chain !== "all" && r.collection.chain !== chain) return false;
      return true;
    });
    // Re-rank within the current filtered view so # stays 1..N.
    return filtered.map((r, i) => ({ ...r, rank: i + 1 }));
  }, [data, window, genre, chain]);

  return (
    <div>
      {/* Controls */}
      <div className="flex flex-col gap-4 border-b border-border pb-6">
        <div className="flex flex-wrap items-center gap-2">
          {WINDOWS.map((w) => (
            <Pill key={w} active={window === w} onClick={() => setWindow(w)}>
              {WINDOW_LABEL[w]}
            </Pill>
          ))}
          <span className="mx-1 hidden h-5 w-px bg-border sm:block" aria-hidden />
          <div className="ml-auto flex items-center gap-2 sm:ml-0">
            <Pill active={chain === "all"} onClick={() => setChain("all")}>All chains</Pill>
            <Pill active={chain === "ethereum"} onClick={() => setChain("ethereum")}>Ethereum</Pill>
            <Pill active={chain === "base"} onClick={() => setChain("base")}>Base</Pill>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Pill active={genre === "all"} onClick={() => setGenre("all")}>All</Pill>
          {genres.map((g) => (
            <Pill key={g} active={genre === g} onClick={() => setGenre(g)}>{g}</Pill>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse">
          <thead className="sticky top-0 z-10 bg-background/90 backdrop-blur-md">
            <tr className="border-b border-border text-faint">
              <Th className="w-12 pl-2 text-left">#</Th>
              <Th className="text-left">Collection</Th>
              <Th className="text-right">Floor</Th>
              <Th className="hidden text-right sm:table-cell">Top offer</Th>
              <Th className="text-right">{WINDOW_LABEL[window]} %</Th>
              <Th className="text-right">Volume</Th>
              <Th className="hidden text-right md:table-cell">Sales</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <Row key={r.collection.slug} row={r} />
            ))}
          </tbody>
        </table>

        {rows.length === 0 && (
          <p className="py-16 text-center text-sm text-muted">
            No collections match these filters.
          </p>
        )}
      </div>
    </div>
  );
}

function Row({ row }: { row: CollectionRanking }) {
  const c = row.collection;
  return (
    <tr className="group border-b border-border transition-colors hover:bg-surface">
      <td className="pl-2">
        <Link href={`/collections/${c.slug}`} className="block py-4 font-mono text-sm tabular-nums text-faint">
          {row.rank}
        </Link>
      </td>
      <td>
        <Link href={`/collections/${c.slug}`} className="flex items-center gap-3 py-3 pr-4">
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
              {c.chain === "ethereum" ? "Ethereum" : "Base"}
            </span>
          </span>
        </Link>
      </td>
      <Td>{formatEth(row.floorEth)} ETH</Td>
      <Td className="hidden sm:table-cell">{formatEth(row.topOfferEth)} ETH</Td>
      <td className="py-4 pr-4 text-right">
        <Link href={`/collections/${c.slug}`} className="block">
          <PctChange value={row.changePct} />
        </Link>
      </td>
      <Td className="text-foreground">{formatEth(row.volumeEth)} ETH</Td>
      <Td className="hidden md:table-cell">{row.salesCount.toLocaleString()}</Td>
    </tr>
  );
}

function Th({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <th
      scope="col"
      className={cn(
        "py-3 pr-4 font-mono text-[10px] font-semibold uppercase tracking-wider",
        className,
      )}
    >
      {children}
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
        "inline-flex h-8 items-center rounded-full px-3.5 font-mono text-[11px] font-semibold uppercase tracking-wider leading-none transition-colors",
        active
          ? "bg-accent text-background"
          : "border border-border bg-surface text-muted hover:border-border-bright hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
