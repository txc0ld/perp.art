/**
 * LatestCollections - an honest, live-data strip of the on-chain collections,
 * replacing the old volume-ranked Trending/Top-movers tables (a testnet with no
 * volume can't rank by it, so we never fabricate one). Reuses CollectionCard,
 * which renders "—" for any missing market data. Server component.
 *
 * Renders nothing when there are no collections (the page's hero already carries
 * the empty-state CTA), so the section never appears as an empty region.
 */
import Link from "next/link";
import type { Collection } from "@/lib/types";
import { SectionHeader } from "@/components/ui";
import { CollectionCard } from "@/components/collections/CollectionCard";

export function LatestCollections({
  collections,
  hrefs = {},
}: {
  collections: Collection[];
  /** Serializable map of collection slug → live per-collection page href. */
  hrefs?: Record<string, string>;
}) {
  if (collections.length === 0) return null;

  return (
    <div>
      <SectionHeader
        eyebrow="Live on-chain"
        title="Latest collections"
        description="Sovereign contracts and the open collection, deployed on-chain. Real works, real provenance — no rankings until there's a market to rank."
        action={
          <Link
            href="/collections"
            className="group inline-flex shrink-0 items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:text-accent"
          >
            View all
            <svg aria-hidden viewBox="0 0 16 16" className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" fill="none">
              <path d="M3 8h9M9 4.5L12.5 8 9 11.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {collections.slice(0, 8).map((c, i) => (
          <div key={c.slug} className="h-full animate-rise" style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}>
            <CollectionCard collection={c} href={hrefs[c.slug]} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default LatestCollections;
