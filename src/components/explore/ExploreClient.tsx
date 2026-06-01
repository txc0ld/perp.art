"use client";

import * as React from "react";
import Link from "next/link";
import type { Token } from "@/lib/types";
import { cn } from "@/lib/utils";
import { SectionHeader, EmptyState } from "@/components/ui";
import { FilterRail } from "./FilterRail";
import { SortMenu } from "./SortMenu";
import { DensityToggle } from "./DensityToggle";
import { ExploreGrid } from "./ExploreGrid";
import { HeadingGlow } from "./HeadingGlow";
import {
  EMPTY_FILTERS,
  applyFilters,
  activeChips,
  facetsFromTokens,
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
  const [railOpen, setRailOpen] = React.useState(false);
  const [density, setDensity] = React.useState<Density>("comfortable");

  // Facets are derived from the live token set so no filter can offer a value
  // that would silently empty the grid (e.g. a chain with zero live tokens).
  const facets = React.useMemo(() => facetsFromTokens(tokens), [tokens]);

  const results = React.useMemo(
    () => applyFilters(tokens, filters),
    [tokens, filters],
  );

  const chips = activeChips(filters);
  const reset = () => setFilters({ ...EMPTY_FILTERS, sort: filters.sort });
  // No live data at all vs. an active-filter miss — distinct empty states.
  const noData = tokens.length === 0;

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 sm:px-6">
      {/* Page heading - faint accent glow drifts on scroll for quiet depth */}
      <div className="relative overflow-hidden">
        <HeadingGlow />
        <SectionHeader
          as="h1"
          eyebrow="The catalog"
          title="Explore"
          description="Every work here is engineered to outlast its operator. Filter by genre, chain, storage, and price, then verify permanence per shard."
          className="relative border-b-0 pb-5"
        />
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        {results.length} {results.length === 1 ? "item" : "items"} match the current filters.
      </p>

      {/* Sticky toolbar: filter toggle, search, count, sort, density */}
      <div className="sticky top-0 z-30 -mx-4 border-y border-border bg-background/85 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setRailOpen((v) => !v)}
            aria-expanded={railOpen}
            aria-controls="explore-filter-rail"
            className={cn(
              "inline-flex h-11 shrink-0 items-center gap-2 rounded-[8px] border px-3.5 font-mono text-[11px] uppercase tracking-wider transition-colors sm:h-10 sm:px-3",
              railOpen
                ? "border-border-bright bg-surface-2 text-foreground"
                : "border-border bg-surface text-muted hover:border-border-bright hover:text-foreground",
            )}
          >
            <svg aria-hidden viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none">
              <path d="M2 4h12M4 8h8M6 12h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            Filters
            {chips.length > 0 && (
              <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-accent/15 px-1 font-mono text-[9px] tabular-nums text-accent">
                {chips.length}
              </span>
            )}
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
        {/* Collapsible filter rail — overlay on mobile, static sidebar on lg+ */}
        <aside
          id="explore-filter-rail"
          aria-label="Filters"
          className={cn(
            "shrink-0 lg:w-64 lg:block",
            railOpen ? "w-full" : "hidden lg:block",
          )}
        >
          <div className="lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:pr-1">
            <FilterRail filters={filters} setFilters={setFilters} onReset={reset} facets={facets} />
          </div>
        </aside>

        {/* Results column — always visible */}
        <div className="min-w-0 flex-1">
          {/* Mobile count + active chips */}
          <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="font-mono text-[13px] tabular-nums text-muted sm:hidden">
              <span className="text-foreground">{results.length}</span>{" "}
              {results.length === 1 ? "item" : "items"}
            </span>

            {chips.length > 0 && (
              <>
                <ul aria-label="Active filters" className="flex flex-wrap items-center gap-2">
                  {chips.map((c) => (
                    <li key={c.key}>
                      <button
                        type="button"
                        onClick={() => setFilters(c.clear)}
                        aria-label={`Remove filter ${c.label}`}
                        className="group inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider leading-none text-accent transition-colors hover:bg-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                      >
                        {c.label}
                        <svg aria-hidden viewBox="0 0 16 16" className="h-3 w-3 opacity-70 group-hover:opacity-100" fill="none">
                          <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={reset}
                  className="inline-flex min-h-[44px] items-center font-mono text-[10px] uppercase tracking-wider text-faint transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 rounded-[6px]"
                >
                  Clear all
                </button>
              </>
            )}
          </div>

          {results.length > 0 ? (
            <ExploreGrid tokens={results} density={density} />
          ) : noData ? (
            <EmptyState
              eyebrow="The catalog"
              title="No works yet — be the first to mint"
              body="Nothing has been minted on-chain yet. Mint a work with a permanent on-chain proof and it appears here instantly."
              action={
                <Link
                  href="/mint"
                  className="inline-flex min-h-[44px] items-center rounded-[8px] border border-accent/40 bg-accent/10 px-4 font-mono text-[11px] uppercase tracking-wider text-accent transition-colors hover:bg-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                >
                  Mint a work
                </Link>
              }
            />
          ) : (
            <EmptyState
              eyebrow="No matches"
              title="No works match these filters"
              body="The catalog is deliberate, not endless. Try widening the storage, chain, or price constraints."
              action={
                <button
                  type="button"
                  onClick={reset}
                  className="inline-flex min-h-[44px] items-center rounded-[8px] border border-accent/40 bg-accent/10 px-4 font-mono text-[11px] uppercase tracking-wider text-accent transition-colors hover:bg-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                >
                  Clear all filters
                </button>
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}

function SearchInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative w-full min-w-0 flex-1 sm:max-w-72">
      <label htmlFor="explore-search" className="sr-only">
        Search the catalog
      </label>
      <svg
        aria-hidden
        viewBox="0 0 16 16"
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint"
        fill="none"
      >
        <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.4" />
        <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
      <input
        id="explore-search"
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="SEARCH WORKS, ARTISTS, TRAITS"
        className="h-11 w-full rounded-[8px] border border-border bg-surface pl-9 pr-3 font-mono text-xs uppercase tracking-wider text-foreground placeholder:text-faint focus-visible:border-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 sm:h-10"
      />
    </div>
  );
}

