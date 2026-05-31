"use client";

import * as React from "react";
import { useMemo, useState } from "react";
import type { Token } from "@/lib/types";
import { ArtTile } from "@/components/art/ArtTile";
import { ButtonLink, SectionHeader } from "@/components/ui";
import { formatEth } from "@/lib/utils";
import { SortSelect } from "./SortSelect";
import { useAccount, useChainId } from "wagmi";
import Link from "next/link";

type OwnedItem = { id: string; tokenId: number; title: string; chainId: number; image: string | null };

function OnchainWorks() {
  const { address } = useAccount();
  const chainId = useChainId();
  const [items, setItems] = React.useState<OwnedItem[] | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!address) { setItems(null); return; }
    const controller = new AbortController();
    setLoading(true);
    fetch(`/api/onchain/owned?chainId=${chainId}&owner=${address}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) => setItems(d.items ?? []))
      .catch((err) => { if (err.name !== "AbortError") setItems([]); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [address, chainId]);

  if (!address) return null;
  return (
    <div className="mb-8">
      <h3 className="font-mono text-[11px] uppercase tracking-wider text-faint">Your on-chain works</h3>
      {loading && <p className="mt-2 text-[13px] text-muted">Reading the chain…</p>}
      {items && items.length === 0 && !loading && (
        <p className="mt-2 text-[13px] text-muted">No on-chain works found for this wallet on this network yet.</p>
      )}
      {items && items.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((it) => (
            <Link
              key={it.id}
              href={`/token/onchain/${it.chainId}/${it.tokenId}`}
              className="group overflow-hidden rounded-[8px] border border-border bg-surface-2 transition-colors hover:border-border-bright"
            >
              {it.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={it.image} alt={it.title} className="aspect-square w-full object-contain" loading="lazy" decoding="async" />
              )}
              <div className="p-2.5">
                <p className="truncate font-mono text-[12px] text-foreground">{it.title}</p>
                <p className="font-mono text-[10px] text-faint">#{it.tokenId}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

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
      <div>
        <OnchainWorks />
        <EmptyState
          title="Nothing collected yet"
          body="Works you acquire appear here, each one anchored onchain and independently verifiable, the day you own it and in twenty years."
          cta={{ href: "/explore", label: "Explore the catalog" }}
        />
      </div>
    );
  }

  const estValue = tokens.reduce((sum, t) => sum + priceOf(t), 0);

  return (
    <div>
      <OnchainWorks />
      <SectionHeader
        eyebrow="Collected"
        title={
          <span className="font-mono tabular-nums">
            {tokens.length} {tokens.length === 1 ? "item" : "items"}
          </span>
        }
        description={
          <>
            <span className="whitespace-nowrap">Est. value {formatEth(estValue)} ETH-eq</span>
            <span className="text-faint"> · approx, holdings span multiple chains</span>
            {preview ? " · preview, sample collection" : ""}
          </>
        }
        action={
          <SortSelect value={sort} onChange={setSort} options={SORTS} label="Sort items" />
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
