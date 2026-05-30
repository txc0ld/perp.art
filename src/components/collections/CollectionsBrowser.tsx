"use client";

import * as React from "react";
import type { Collection, Genre } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CollectionCard } from "./CollectionCard";

/**
 * Client browser for the collections index: a category pill row that filters
 * the server-provided collection list, rendered into a dense responsive grid.
 */
export function CollectionsBrowser({
  collections,
  genres,
}: {
  collections: Collection[];
  genres: Genre[];
}) {
  const [genre, setGenre] = React.useState<Genre | "all">("all");

  const results = React.useMemo(
    () => (genre === "all" ? collections : collections.filter((c) => c.genre === genre)),
    [collections, genre],
  );

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-6">
        <Pill active={genre === "all"} onClick={() => setGenre("all")}>All</Pill>
        {genres.map((g) => (
          <Pill key={g} active={genre === g} onClick={() => setGenre(g)}>{g}</Pill>
        ))}
        <span className="ml-auto font-mono text-xs tabular-nums text-muted">
          {results.length} {results.length === 1 ? "COLLECTION" : "COLLECTIONS"}
        </span>
      </div>

      {results.length > 0 ? (
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {results.map((c, i) => (
            <div key={c.slug} className="animate-rise" style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}>
              <CollectionCard collection={c} />
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-16 text-center text-sm text-muted">No collections in this category.</p>
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
