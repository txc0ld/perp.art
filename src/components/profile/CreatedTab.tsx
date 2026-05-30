"use client";

import { useMemo, useState } from "react";
import type { Token } from "@/lib/types";
import { ArtTile } from "@/components/art/ArtTile";
import { SectionHeader } from "@/components/ui";
import { EmptyState } from "./OwnedTab";
import { SortSelect } from "./SortSelect";

type SortKey = "recent" | "price-desc" | "price-asc" | "title";

const SORTS: ReadonlyArray<{ key: SortKey; label: string }> = [
  { key: "recent", label: "Recently minted" },
  { key: "price-desc", label: "Price: high to low" },
  { key: "price-asc", label: "Price: low to high" },
  { key: "title", label: "Title A to Z" },
];

function priceOf(t: Token): number {
  return t.listing?.priceEth ?? t.offers[0]?.priceEth ?? 0;
}

/**
 * Created tab (design prompt §4.5) - works the user authored. In the demo dataset
 * the connected user is treated as the first artist, so this shows their minted works.
 * Shared SectionHeader carries the count + a sort control passed as `action`.
 */
export function CreatedTab({ tokens }: { tokens: Token[] }) {
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
        return list;
    }
  }, [tokens, sort]);

  if (tokens.length === 0) {
    return (
      <EmptyState
        title="Nothing minted yet"
        body="Works you create will live here. Mint to a sovereign Forever Library contract you own outright."
        cta={{ href: "/mint", label: "Mint a work" }}
      />
    );
  }

  return (
    <div>
      <SectionHeader
        eyebrow="Created"
        title={
          <span className="font-mono tabular-nums">
            {tokens.length} {tokens.length === 1 ? "work" : "works"} created
          </span>
        }
        description="Every work you mint is hash-anchored onchain at mint and kept across independent permanence shards."
        action={
          <SortSelect value={sort} onChange={setSort} options={SORTS} label="Sort works" />
        }
      />
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
