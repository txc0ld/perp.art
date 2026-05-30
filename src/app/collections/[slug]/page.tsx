import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getCollection,
  getCollections,
  getTokensByCollection,
  getArtist,
  getTrendingCollections,
} from "@/lib/mock-data";
import { Section } from "@/components/ui";
import { CollectionHero } from "@/components/collections/CollectionHero";
import { CollectionStatsBar } from "@/components/collections/CollectionStatsBar";
import { CollectionItems } from "@/components/collections/CollectionItems";

/** Pre-render the known collection routes. */
export function generateStaticParams() {
  return getCollections().map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const collection = getCollection(slug);
  if (!collection) return { title: "Collection not found - Perpetual" };
  return {
    title: `${collection.name} - Perpetual`,
    description: collection.description,
  };
}

/** Collection detail (Next 16 async params) - OpenSea-style banner + stats + items. */
export default async function CollectionDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const collection = getCollection(slug);
  if (!collection) notFound();

  const artist = getArtist(collection.artistHandle);
  const tokens = getTokensByCollection(slug);
  const ranking = getTrendingCollections("24h").find((r) => r.collection.slug === slug);
  const listedCount = tokens.filter((t) => t.listing).length;

  return (
    <Section className="pt-6 sm:pt-8">
      <CollectionHero collection={collection} artist={artist} />

      <div className="mt-8">
        <CollectionStatsBar collection={collection} ranking={ranking} listedCount={listedCount} />
      </div>

      <div className="mt-10">
        <CollectionItems tokens={tokens} />
      </div>
    </Section>
  );
}
