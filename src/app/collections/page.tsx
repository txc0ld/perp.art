import type { Metadata } from "next";
import { getCollections, GENRES } from "@/lib/mock-data";
import { indexedCollections } from "@/lib/web3/indexer";
import { Section, MonoLabel } from "@/components/ui";
import { CollectionsBrowser } from "@/components/collections/CollectionsBrowser";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Collections - Perpetual",
  description: "Bodies of permanence-first art, each anchored to immutable storage and independently verifiable.",
};

/**
 * Collections index - OpenSea-style grid of collection cards.
 * Live on-chain collections (Base Sepolia) are prepended to the mock grid.
 * Live collection slugs (e.g. "onchain-84532") have no dedicated page, so their
 * cards link to /explore (the merged catalog) instead of /collections/{slug}.
 */
export default async function CollectionsPage() {
  const liveCollections = await indexedCollections(84532);
  // Pass serializable slugs (not a function) across the server→client boundary;
  // the client computes the live cards' href from this list.
  const liveSlugs = liveCollections.map((c) => c.slug);
  const collections = [...liveCollections, ...getCollections()];

  return (
    <Section>
      <div className="pb-8">
        <MonoLabel className="text-faint">The Conservatory</MonoLabel>
        <h1 className="display-sm mt-2 font-brand text-foreground">Collections</h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted">
          Bodies of work held for the long term. Each one rendered once, fixed forever, and
          independently verifiable.
        </p>
      </div>

      <CollectionsBrowser collections={collections} genres={GENRES} liveChainId={84532} liveSlugs={liveSlugs} />
    </Section>
  );
}
