import type { Metadata } from "next";
import { getLiveCollections } from "@/lib/live/catalog";
import { GENRES } from "@/lib/catalog-constants";
import { Section, MonoLabel, EmptyState, ButtonLink } from "@/components/ui";
import { CollectionsBrowser } from "@/components/collections/CollectionsBrowser";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Collections - Perpetual",
  description: "Bodies of permanence-first art, each anchored to immutable storage and independently verifiable.",
};

/** Map a Token `chain` tag to its numeric chain id (inverse of catalog's CHAIN_BY_ID). */
const CHAIN_ID_BY_TAG: Record<string, number> = { base: 84532, ethereum: 11155111 };

/**
 * Collections index — live on-chain collections only (Base/Ethereum Sepolia).
 * Each card links to its live per-collection page at
 * `/collections/onchain/{chainId}/{contract}`. Sparse by design: when there are
 * no collections yet we render an honest EmptyState, never fabricated grids.
 */
export default async function CollectionsPage() {
  const collections = await getLiveCollections();

  // The browser links each card to its live per-collection page. Collections
  // carry only a chain tag, so derive the chainId here and pass a serializable
  // slug→href map across the server→client boundary.
  const hrefs = Object.fromEntries(
    collections.map((c) => {
      const chainId = CHAIN_ID_BY_TAG[c.chain] ?? 84532;
      return [c.slug, `/collections/onchain/${chainId}/${c.contractAddress}`];
    }),
  );

  return (
    <Section>
      <div className="pb-8">
        <MonoLabel className="text-faint">The Conservatory</MonoLabel>
        <h1 className="display-sm mt-2 font-brand text-foreground">Collections</h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted">
          Bodies of work held for the long term. Each one rendered once, fixed forever, and
          independently verifiable. Live collections are sovereign contracts deployed on-chain
          via ForeverLibraryFactory — each artist owns their contract outright.
        </p>
      </div>

      {collections.length > 0 ? (
        <CollectionsBrowser collections={collections} genres={GENRES} hrefs={hrefs} />
      ) : (
        <EmptyState
          eyebrow="The Conservatory"
          title="No collections yet"
          body="Deploy one from your profile or mint into the open collection — the first works held here will be yours."
          action={
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <ButtonLink href="/mint" variant="accent" size="lg">Mint a work</ButtonLink>
              <ButtonLink href="/profile" variant="secondary" size="lg">Deploy a collection</ButtonLink>
            </div>
          }
        />
      )}
    </Section>
  );
}
