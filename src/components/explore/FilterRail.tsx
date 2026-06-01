"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  STORAGE_OPTIONS,
  STATUS_OPTIONS,
  type ExploreFilters,
  type ExploreFacets,
} from "./filters";

/** A single pill toggle. Active state earns the pink accent (the only accent here). */
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
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-[44px] items-center rounded-full border px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider leading-none transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
        active
          ? "border-accent/40 bg-accent/10 text-accent"
          : "border-border bg-surface text-muted hover:border-border-bright hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

/**
 * Collapsible accordion section (OpenSea filter group). Hairline-divided,
 * mono header, chevron rotates open. Count badge surfaces active selections.
 */
function Accordion({
  label,
  count,
  defaultOpen = true,
  children,
}: {
  label: string;
  count?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div className="border-b border-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between py-3.5 text-left transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
      >
        <span className="flex items-center gap-2">
          <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-foreground">
            {label}
          </span>
          {count ? (
            <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-accent/15 px-1 font-mono text-[9px] tabular-nums text-accent">
              {count}
            </span>
          ) : null}
        </span>
        <svg
          aria-hidden
          viewBox="0 0 16 16"
          className={cn("h-3.5 w-3.5 text-muted transition-transform duration-200", open && "rotate-180")}
          fill="none"
        >
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open ? <div className="pb-4">{children}</div> : null}
    </div>
  );
}

function toggle<T>(arr: T[], v: T): T[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

export function FilterRail({
  filters,
  setFilters,
  onReset,
  facets,
  className,
}: {
  filters: ExploreFilters;
  setFilters: React.Dispatch<React.SetStateAction<ExploreFilters>>;
  onReset: () => void;
  /** Genre/chain options actually present in the live token set. */
  facets: ExploreFacets;
  className?: string;
}) {
  const hasAny =
    filters.genres.length ||
    filters.chains.length ||
    filters.storage.length ||
    filters.status.length ||
    filters.lockedOnly ||
    filters.minEth.trim() ||
    filters.maxEth.trim() ||
    filters.q.trim();

  return (
    <div className={cn("flex flex-col", className)}>
      <div className="flex items-center justify-between pb-1">
        <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-foreground">
          Filters
        </span>
        {hasAny ? (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex min-h-[32px] items-center rounded-[6px] font-mono text-[10px] uppercase tracking-wider text-faint transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            Clear all
          </button>
        ) : null}
      </div>

      <Accordion label="Status" count={filters.status.length}>
        <div className="flex flex-wrap gap-2">
          {STATUS_OPTIONS.map((s) => (
            <Pill
              key={s.value}
              active={filters.status.includes(s.value)}
              onClick={() => setFilters((f) => ({ ...f, status: toggle(f.status, s.value) }))}
            >
              {s.label}
            </Pill>
          ))}
        </div>
      </Accordion>

      {facets.genres.length > 0 && (
        <Accordion label="Genre" count={filters.genres.length}>
          <div className="flex flex-wrap gap-2">
            {facets.genres.map((g) => (
              <Pill
                key={g}
                active={filters.genres.includes(g)}
                onClick={() => setFilters((f) => ({ ...f, genres: toggle(f.genres, g) }))}
              >
                {g}
              </Pill>
            ))}
          </div>
        </Accordion>
      )}

      {facets.chains.length > 0 && (
        <Accordion label="Chain" count={filters.chains.length}>
          <div className="flex flex-wrap gap-2">
            {facets.chains.map((c) => (
              <Pill
                key={c.value}
                active={filters.chains.includes(c.value)}
                onClick={() => setFilters((f) => ({ ...f, chains: toggle(f.chains, c.value) }))}
              >
                {c.label}
              </Pill>
            ))}
          </div>
        </Accordion>
      )}

      <Accordion label="Price (ETH)" count={(filters.minEth.trim() ? 1 : 0) + (filters.maxEth.trim() ? 1 : 0)}>
        <div className="flex items-center gap-2">
          <PriceInput
            placeholder="Min"
            value={filters.minEth}
            onChange={(v) => setFilters((f) => ({ ...f, minEth: v }))}
          />
          <span className="font-mono text-xs text-faint">to</span>
          <PriceInput
            placeholder="Max"
            value={filters.maxEth}
            onChange={(v) => setFilters((f) => ({ ...f, maxEth: v }))}
          />
        </div>
      </Accordion>

      <Accordion label="Storage" count={filters.storage.length}>
        <div className="flex flex-wrap gap-2">
          {STORAGE_OPTIONS.map((s) => (
            <Pill
              key={s.value}
              active={filters.storage.includes(s.value)}
              onClick={() => setFilters((f) => ({ ...f, storage: toggle(f.storage, s.value) }))}
            >
              {s.label}
            </Pill>
          ))}
        </div>
      </Accordion>

      <Accordion label="Permanence" count={filters.lockedOnly ? 1 : 0}>
        <div className="flex flex-wrap gap-2">
          <Pill
            active={filters.lockedOnly}
            onClick={() => setFilters((f) => ({ ...f, lockedOnly: !f.lockedOnly }))}
          >
            Locked / Immutable only
          </Pill>
        </div>
      </Accordion>
    </div>
  );
}

function PriceInput({
  placeholder,
  value,
  onChange,
}: {
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <input
      type="text"
      inputMode="decimal"
      placeholder={placeholder}
      value={value}
      onChange={(e) => {
        const v = e.target.value;
        // permit only numeric / decimal input
        if (v === "" || /^\d*\.?\d*$/.test(v)) onChange(v);
      }}
      className="h-9 w-full min-w-0 rounded-[8px] border border-border bg-surface px-3 font-mono text-sm tabular-nums text-foreground placeholder:text-faint focus-visible:border-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
      aria-label={`${placeholder} price in ETH`}
    />
  );
}
