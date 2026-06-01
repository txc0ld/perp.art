import type { Metadata } from "next";
import { getLiveCollection, getLiveTokens } from "@/lib/live/catalog";
import { Section, EmptyState, ButtonLink } from "@/components/ui";
import { CollectionHero } from "@/components/collections/CollectionHero";
import { CollectionStatsBar } from "@/components/collections/CollectionStatsBar";
import { CollectionItems } from "@/components/collections/CollectionItems";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const collection = await getLiveCollection(slug);
  if (!collection) return { title: "Collection not found - Perpetual" };
  return {
    title: `${collection.name} - Perpetual`,
    description: collection.description,
  };
}

/**
 * Collection detail (Next 16 async params). The `[slug]` is treated as a live
 * collection contract address and resolved via `getLiveCollection`. When it
 * resolves we render the live hero + stats + items; otherwise an honest
 * "Collection not found" empty state. No mock collections are rendered.
 */
export default async function CollectionDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const collection = await getLiveCollection(slug);

  if (!collection) {
    return (
      <Section className="pt-6 sm:pt-8">
        <EmptyState
          eyebrow="Collections"
          title="Collection not found"
          body="This collection isn’t on-chain yet, or the address didn’t resolve. Browse the live collections instead."
          action={<ButtonLink href="/collections" variant="secondary" size="lg">Back to collections</ButtonLink>}
        />
      </Section>
    );
  }

  const allTokens = await getLiveTokens();
  const tokens = allTokens.filter((t) => t.collectionSlug === collection.slug);
  const listedCount = tokens.filter((t) => t.listing).length;

  return (
    <Section className="pt-6 sm:pt-8">
      {/* Banner -> identity */}
      <CollectionHero collection={collection} />

      {/* Stats bar */}
      <section aria-label="Collection statistics" className="mt-8">
        <CollectionStatsBar collection={collection} listedCount={listedCount} />
      </section>

      {/* Toolbar / tabs -> grid */}
      <div className="mt-10">
        <CollectionItems tokens={tokens} collectionName={collection.name} />
      </div>
    </Section>
  );
}
