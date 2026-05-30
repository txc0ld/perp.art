"use client";

import { useMemo, useState } from "react";
import type { Token } from "@/lib/types";
import { ArtTile } from "@/components/art/ArtTile";
import { ButtonLink, MonoLabel } from "@/components/ui";
import { formatEth } from "@/lib/utils";

type SortKey = "recent" | "price-desc" | "price-asc" | "title";

const SORTS: Array<{ key: SortKey; label: string }> = [
  { key: "recent", label: "Recently received" },
  { key: "price-desc", label: "Price: high to low" },
  { key: "price-asc", label: "Price: low to high" },
  { key: "title", label: "Title A to Z" },
];

function priceOf(t: Token): number {
  return t.listing?.priceEth ?? t.offers[0]?.priceEth ?? 0;
}

/**
 * Collected tab (OpenSea-style) - a sub-toolbar with the result count and a sort
 * control, then a dense responsive ArtTile grid of works held by the connected
 * wallet. Calm empty state when none.
 */
export function CollectedTab({ tokens, preview }: { tokens: Token[]; preview?: boolean }) {
  const [sort, setSort] = useState<SortKey>("recent");

  const sorted = useMemo(() => {
    const list = [...tokens];
    switch (sort) {
      case "price-desc":
        return list.sort((a, b) => priceOf(b) - priceOf(a));
      case "price-asc":
        return list.sort((a, b) => priceOf(a) - priceOf(b));
      case "title":
        return list.sort((a, b) => a.title.localeCompare(b.title));
      default:
        return list; // dataset order stands in for recency
    }
  }, [tokens, sort]);

  if (tokens.length === 0) {
    return (
      <EmptyState
        title="No works held yet"
        body="Artworks you collect will be held here, each one anchored onchain and independently verifiable."
        cta={{ href: "/explore", label: "Explore the catalog" }}
      />
    );
  }

  const estValue = tokens.reduce((sum, t) => sum + priceOf(t), 0);

  return (
    <div>
      {/* Sub-toolbar: result count + sort */}
      <div className="mb-6 flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <MonoLabel className="text-foreground">
            {tokens.length} {tokens.length === 1 ? "item" : "items"}
          </MonoLabel>
          <span className="hidden font-mono text-[11px] uppercase tracking-wider text-faint sm:inline">
            Est. {formatEth(estValue)} ETH
          </span>
          {preview && (
            <span className="font-mono text-[11px] uppercase tracking-wider text-faint">
              Preview, sample collection
            </span>
          )}
        </div>

        <label className="relative inline-flex items-center">
          <span className="sr-only">Sort items</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="appearance-none rounded-full border border-border bg-surface py-1.5 pl-3.5 pr-8 font-mono text-[12px] text-muted transition-colors hover:border-border-bright hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            {SORTS.map((s) => (
              <option key={s.key} value={s.key} className="bg-surface text-foreground">
                {s.label}
              </option>
            ))}
          </select>
          <svg
            viewBox="0 0 16 16"
            className="pointer-events-none absolute right-3 h-3 w-3 text-faint"
            fill="none"
            aria-hidden
          >
            <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 lg:gap-5">
        {sorted.map((t, i) => (
          <div key={t.id} className="animate-rise" style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}>
            <ArtTile token={t} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  body,
  cta,
}: {
  title: string;
  body: string;
  cta?: { href: string; label: string };
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[10px] border border-dashed border-border bg-surface/40 px-6 py-20 text-center">
      <p className="text-lg font-medium text-foreground">{title}</p>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">{body}</p>
      {cta && (
        <ButtonLink href={cta.href} variant="secondary" size="md" className="mt-6">
          {cta.label}
        </ButtonLink>
      )}
    </div>
  );
}
