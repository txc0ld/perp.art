"use client";

import * as React from "react";
import type { Collection, Genre } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CollectionCard } from "./CollectionCard";

/**
 * Client browser for the collections index: a category pill row that filters
 * the server-provided collection list, rendered into a dense responsive grid.
 *
 * Live on-chain collection slugs (42-char contract addresses) link to their
 * per-collection page at `/collections/onchain/{liveChainId}/{slug}`.
 */
export function CollectionsBrowser({
  collections,
  genres,
  liveChainId,
  liveSlugs = [],
}: {
  collections: Collection[];
  genres: Genre[];
  /** The chainId for live on-chain collections (used to build /collections/onchain/... links). */
  liveChainId?: number;
  /** Slugs of live on-chain collections. */
  liveSlugs?: string[];
}) {
  const [genre, setGenre] = React.useState<Genre | "all">("all");
  const liveSet = React.useMemo(() => new Set(liveSlugs), [liveSlugs]);

  const results = React.useMemo(
    () => (genre === "all" ? collections : collections.filter((c) => c.genre === genre)),
    [collections, genre],
  );

  return (
    <div>
      <div className="flex flex-col gap-3 border-b border-border pb-6 sm:flex-row sm:flex-wrap sm:items-center">
        <div
          className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="group"
          aria-label="Filter by category"
        >
          <Pill active={genre === "all"} onClick={() => setGenre("all")}>All</Pill>
          {genres.map((g) => (
            <Pill key={g} active={genre === g} onClick={() => setGenre(g)}>{g}</Pill>
          ))}
        </div>
        <span className="font-mono text-xs tabular-nums text-faint sm:ml-auto" aria-live="polite">
          {results.length} {results.length === 1 ? "COLLECTION" : "COLLECTIONS"}
        </span>
      </div>

      {results.length > 0 ? (
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {results.map((c, i) => (
            <div key={c.slug} className="h-full animate-rise" style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}>
              <CollectionCard collection={c} href={liveSet.has(c.slug) && liveChainId ? `/collections/onchain/${liveChainId}/${c.slug}` : undefined} />
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-16 text-center text-sm text-muted">No collections in this category yet.</p>
      )}
    </div>
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
