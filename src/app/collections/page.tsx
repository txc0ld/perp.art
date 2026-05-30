import type { Metadata } from "next";
import { getCollections, GENRES } from "@/lib/mock-data";
import { Section, MonoLabel } from "@/components/ui";
import { CollectionsBrowser } from "@/components/collections/CollectionsBrowser";

export const metadata: Metadata = {
  title: "Collections - Perpetual",
  description: "Bodies of permanence-first art, each anchored to immutable storage and independently verifiable.",
};

/** Collections index - OpenSea-style grid of collection cards from getCollections(). */
export default function CollectionsPage() {
  const collections = getCollections();

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

      <CollectionsBrowser collections={collections} genres={GENRES} />
    </Section>
  );
}
