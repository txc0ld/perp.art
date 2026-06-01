"use client";

import * as React from "react";
import type { Collection, Genre, Chain } from "@/lib/types";
import { getChainMeta, getChains } from "@/lib/chains";
import { cn } from "@/lib/utils";
import { GenerativeArt } from "@/components/art/GenerativeArt";
import { VerifiedBadge } from "@/components/ui";

type ChainFilter = "all" | Chain;
type SortKey = "rank" | "itemCount" | "ownerCount";
type SortDir = "asc" | "desc";

/** Map a Token `chain` tag to its numeric chain id (inverse of catalog's CHAIN_BY_ID). */
const CHAIN_ID_BY_TAG: Record<string, number> = { base: 84532, ethereum: 11155111 };

/**
 * Live collections table. Live/testnet has effectively zero trading volume, so a
 * volume-ranked leaderboard would be meaningless. Instead this ranks the real
 * on-chain collections by item count (then owners), and renders floor/volume
 * honestly as "—" rather than fabricating numbers. Receives the precomputed
 * collections + slug→href map as props (all data access stays on the server) and
 * only toggles chain / category filters and sort on the client.
 */
export function StatsCollectionsTable({
  collections,
  genres,
  hrefs,
}: {
  collections: Collection[];
  genres: Genre[];
  hrefs: Record<string, string>;
}) {
  const [genre, setGenre] = React.useState<Genre | "all">("all");
  const [chain, setChain] = React.useState<ChainFilter>("all");
  const [sortKey, setSortKey] = React.useState<SortKey>("itemCount");
  const [sortDir, setSortDir] = React.useState<SortDir>("desc");

  // Only show chain pills for chains that actually have a collection.
  const presentChains = React.useMemo(() => {
    const set = new Set(collections.map((c) => c.chain));
    return getChains().filter((m) => set.has(m.id));
  }, [collections]);

  const rows = React.useMemo(() => {
    const filtered = collections.filter((c) => {
      if (genre !== "all" && c.genre !== genre) return false;
      if (chain !== "all" && c.chain !== chain) return false;
      return true;
    });
    // Canonical rank by item count (descending), assigned first.
    const ranked = [...filtered]
      .sort((a, b) => b.itemCount - a.itemCount || b.ownerCount - a.ownerCount)
      .map((c, i) => ({ collection: c, rank: i + 1 }));

    const dir = sortDir === "asc" ? 1 : -1;
    return [...ranked].sort((a, b) => {
      const av = sortKey === "rank" ? a.rank : a.collection[sortKey];
      const bv = sortKey === "rank" ? b.rank : b.collection[sortKey];
      return (av - bv) * dir;
    });
  }, [collections, genre, chain, sortKey, sortDir]);

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
        {presentChains.length > 1 && (
          <div
            className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            role="group"
            aria-label="Chain"
          >
            <Pill active={chain === "all"} onClick={() => setChain("all")}>All chains</Pill>
            {presentChains.map((m) => (
              <Pill key={m.id} active={chain === m.id} onClick={() => setChain(m.id)}>
                {m.short}
              </Pill>
            ))}
          </div>
        )}

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
        <table className="w-full min-w-[560px] border-collapse">
          <caption className="sr-only">
            Live on-chain collections ranked by item count. Floor and volume are shown
            as &ldquo;—&rdquo; where there is no trading activity yet. Use the column
            headers to sort and the filters above to narrow by chain and category.
          </caption>
          <colgroup>
            <col className="w-[52px]" />
            <col />
            <col className="w-[112px]" />
            <col className="w-[112px]" />
            <col className="w-[112px]" />
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
                active={sortKey === "itemCount"}
                dir={sortDir}
                ariaSort={ariaSortFor("itemCount")}
                onClick={() => requestSort("itemCount")}
              >
                Items
              </SortableTh>
              <SortableTh
                className="hidden sm:table-cell"
                active={sortKey === "ownerCount"}
                dir={sortDir}
                ariaSort={ariaSortFor("ownerCount")}
                onClick={() => requestSort("ownerCount")}
              >
                Owners
              </SortableTh>
              <Th scope="col" className="text-right">Floor</Th>
              <Th scope="col" className="hidden md:table-cell text-right">Volume</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <Row key={r.collection.slug} collection={r.collection} rank={r.rank} href={hrefs[r.collection.slug]} />
            ))}
          </tbody>
        </table>

        {rows.length === 0 && (
          <p className="py-16 text-center text-sm text-muted">
            No collections match these filters. Try a wider category or chain.
          </p>
        )}
      </div>
    </div>
  );
}

function Row({ collection, rank, href }: { collection: Collection; rank: number; href?: string }) {
  const c = collection;
  const meta = getChainMeta(c.chain);
  const chainLabel = meta.short;
  const chainId = CHAIN_ID_BY_TAG[c.chain] ?? 84532;
  const target = href ?? `/collections/onchain/${chainId}/${c.contractAddress}`;
  const label = `Rank ${rank}: ${c.name} on ${chainLabel}. ${c.itemCount} items, ${c.ownerCount} owners.`;
  return (
    <tr className="group border-b border-border transition-colors hover:bg-surface focus-within:bg-surface">
      <td className="h-[68px] pl-2 text-left font-mono text-sm tabular-nums text-faint">
        {rank}
      </td>
      <td>
        <a
          href={target}
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
                <VerifiedBadge size={14} className="shrink-0" label="Sovereign contract" />
              ) : null}
            </span>
            <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-wider text-faint">
              {chainLabel}
            </span>
          </span>
        </a>
      </td>
      <Td className="text-foreground">{c.itemCount.toLocaleString()}</Td>
      <Td className="hidden sm:table-cell">{c.ownerCount.toLocaleString()}</Td>
      {/* No live trading yet — render honestly rather than fabricate. */}
      <Td className="text-faint">—</Td>
      <Td className="hidden md:table-cell text-faint">—</Td>
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
        "py-3 pr-4 font-mono text-[10px] font-semibold uppercase tracking-wider text-right",
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
          // Expand the tap area to >=44px without growing the visible header row
          // (the th padding stays the same): the extra height is absorbed by the
          // negative vertical margin so there's no layout shift.
          "inline-flex min-h-[44px] -my-2.5 items-center gap-1 rounded-[6px] px-1 -mx-1 uppercase tracking-wider transition-colors",
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
