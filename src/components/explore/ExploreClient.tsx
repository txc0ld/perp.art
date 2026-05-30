"use client";

import * as React from "react";
import type { Token } from "@/lib/types";
import { cn } from "@/lib/utils";
import { searchTokens } from "@/lib/mock-data";
import { FilterRail } from "./FilterRail";
import { SortMenu } from "./SortMenu";
import { DensityToggle } from "./DensityToggle";
import { ExploreGrid } from "./ExploreGrid";
import {
  EMPTY_FILTERS,
  applyFilters,
  activeChips,
  type Density,
  type ExploreFilters,
} from "./filters";

/**
 * OpenSea-style browse shell for Explore. Receives the full token list as a prop
 * (all data access stays on the server) and owns every interaction: client-side
 * filtering / sorting, a collapsible left filter rail, a sticky toolbar
 * (search, count, sort, density) and a removable filter-chip row.
 */
export function ExploreClient({
  tokens,
  initialFilters,
}: {
  tokens: Token[];
  initialFilters: ExploreFilters;
}) {
  const [filters, setFilters] = React.useState<ExploreFilters>(initialFilters);
  const [railOpen, setRailOpen] = React.useState(true);
  const [density, setDensity] = React.useState<Density>("comfortable");

  // searchTokens is a pure local lookup over the same mock dataset - safe in the client.
  const searchHits = React.useMemo(
    () => (filters.q.trim() ? searchTokens(filters.q) : tokens),
    [filters.q, tokens],
  );

  const results = React.useMemo(
    () => applyFilters(tokens, searchHits, filters),
    [tokens, searchHits, filters],
  );

  const chips = activeChips(filters);
  const reset = () => setFilters({ ...EMPTY_FILTERS, sort: filters.sort });

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 sm:px-6">
      {/* Page heading */}
      <div className="pb-5">
        <p className="label-mono text-faint">Catalog</p>
        <h1 className="display-sm mt-2 font-brand text-foreground">Explore</h1>
      </div>

      {/* Sticky toolbar: filter toggle, search, count, sort, density */}
      <div className="sticky top-0 z-30 -mx-4 border-y border-border bg-background/85 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setRailOpen((v) => !v)}
            aria-expanded={railOpen}
            className={cn(
              "inline-flex h-9 shrink-0 items-center gap-2 rounded-[8px] border px-3 font-mono text-[11px] uppercase tracking-wider transition-colors",
              railOpen
                ? "border-border-bright bg-surface-2 text-foreground"
                : "border-border bg-surface text-muted hover:border-border-bright hover:text-foreground",
            )}
          >
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none">
              <path d="M2 4h12M4 8h8M6 12h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            Filters
          </button>

          <SearchInput
            value={filters.q}
            onChange={(v) => setFilters((f) => ({ ...f, q: v }))}
          />

          <span className="hidden font-mono text-[13px] tabular-nums text-muted sm:inline-flex sm:items-baseline sm:gap-1.5">
            <span className="text-foreground">{results.length}</span>
            <span className="text-faint">{results.length === 1 ? "item" : "items"}</span>
          </span>

          <div className="ml-auto flex items-center gap-2">
            <SortMenu value={filters.sort} onChange={(sort) => setFilters((f) => ({ ...f, sort }))} />
            <DensityToggle value={density} onChange={setDensity} />
          </div>
        </div>
      </div>

      <div className="flex items-start gap-6 pt-6 lg:gap-8">
        {/* Collapsible filter rail */}
        {railOpen ? (
          <aside className="animate-fade w-full shrink-0 lg:w-64">
            <div className="lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:pr-1">
              <FilterRail filters={filters} setFilters={setFilters} onReset={reset} />
            </div>
          </aside>
        ) : null}

        {/* Results column */}
        <div className={cn("min-w-0 flex-1", railOpen && "hidden lg:block")}>
          {/* Mobile count + active chips */}
          <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="font-mono text-[13px] tabular-nums text-muted sm:hidden">
              <span className="text-foreground">{results.length}</span>{" "}
              {results.length === 1 ? "item" : "items"}
            </span>

            {chips.length > 0 && (
              <>
                <ul className="flex flex-wrap items-center gap-2">
                  {chips.map((c) => (
                    <li key={c.key}>
                      <button
                        type="button"
                        onClick={() => setFilters(c.clear)}
                        className="group inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider leading-none text-accent transition-colors hover:bg-accent/20"
                      >
                        {c.label}
                        <svg viewBox="0 0 16 16" className="h-3 w-3 opacity-70 group-hover:opacity-100" fill="none">
                          <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={reset}
                  className="font-mono text-[10px] uppercase tracking-wider text-faint transition-colors hover:text-accent"
                >
                  Clear all
                </button>
              </>
            )}
          </div>

          {results.length > 0 ? (
            <ExploreGrid tokens={results} density={density} />
          ) : (
            <EmptyState onReset={reset} />
          )}
        </div>
      </div>
    </div>
  );
}

function SearchInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative w-full min-w-0 flex-1 sm:max-w-72">
      <svg
        viewBox="0 0 16 16"
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint"
        fill="none"
      >
        <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.4" />
        <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="SEARCH WORKS, ARTISTS, TRAITS"
        className="h-9 w-full rounded-[8px] border border-border bg-surface pl-9 pr-3 font-mono text-xs uppercase tracking-wider text-foreground placeholder:text-faint focus:border-accent/50 focus:outline-none"
        aria-label="Search the catalog"
      />
    </div>
  );
}

function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[10px] border border-dashed border-border px-6 py-24 text-center">
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full border border-border text-faint">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
          <circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M15.5 15.5L21 21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
      <p className="text-base text-foreground">No works match these filters</p>
      <p className="mt-2 max-w-sm text-sm text-muted">
        The catalog is deliberate, not endless. Try widening the storage, chain, or price constraints.
      </p>
      <button
        type="button"
        onClick={onReset}
        className="mt-6 font-mono text-[11px] uppercase tracking-wider text-accent transition-opacity hover:opacity-80"
      >
        Clear all filters
      </button>
    </div>
  );
}
