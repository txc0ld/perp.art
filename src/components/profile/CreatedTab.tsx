"use client";

import { useMemo, useState } from "react";
import type { Token } from "@/lib/types";
import { ArtTile } from "@/components/art/ArtTile";
import { SectionHeader, EmptyState, ButtonLink } from "@/components/ui";
import { TileGridSkeleton } from "./OwnedTab";
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
 * Created tab (design prompt §4.5) - works authored by the connected wallet
 * (creator = the ERC-2981 royalty receiver, from the live catalog). Shared
 * SectionHeader carries the count + a sort control passed as `action`.
 */
export function CreatedTab({ tokens, loading }: { tokens: Token[]; loading?: boolean }) {
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

  if (loading) return <TileGridSkeleton />;

  if (tokens.length === 0) {
    return (
      <EmptyState
        title="You haven't minted anything yet"
        body="Works you create live here. Mint your first to a sovereign Forever Library contract you own outright, with permanence configured from the first block."
        action={
          <ButtonLink href="/mint" variant="secondary" size="md">
            Mint your first work
          </ButtonLink>
        }
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
        description="Every work you mint is hash-anchored onchain at mint and held across independent permanence shards."
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
