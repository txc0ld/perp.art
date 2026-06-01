/**
 * PERPETUAL - Home (OpenSea-style discovery surface, in our dark + pink theme).
 *
 * Server component. Sourced entirely from the live on-chain data layer; the
 * testnet is sparse by design, so every section either shows real data or an
 * honest empty state — never fabricated rankings or fake rows.
 *
 * Sections (top to bottom):
 *   1. Hero feature strip    - a live collection, art-forward banner (or a
 *                              "be the first to mint" empty hero when none)
 *   2. Category pill row     - genre filters linking to /explore?genre=X
 *   3. Featured drops        - live tokens in the coverflow (hidden when none)
 *   4. Latest collections    - real live collections (no volume rankings)
 *   5. Recent works grid     - live tokens (or an empty state)
 *   6. Permanence value band - live market stats (honest zeros when empty)
 *
 * `searchParams` is awaited per Next 16 (it is a Promise) and used only to set
 * the active state of the category pills.
 */
import {
  getLiveTokensSplit,
  getOpenListings,
  enrichWithListings,
  getLiveCollections,
  computeMarketStats,
} from "@/lib/live/catalog";
import { GENRES } from "@/lib/catalog-constants";

import { Section, EmptyState, ButtonLink, MonoLabel } from "@/components/ui";
import { HeroFeature } from "@/components/home/HeroFeature";
import { Reveal3D } from "@/components/home/Reveal3D";
import { CategoryPills } from "@/components/home/CategoryPills";
import { FeaturedDrops } from "@/components/home/FeaturedDrops";
import { LatestCollections } from "@/components/home/LatestCollections";
import { FeaturedWorksGrid } from "@/components/home/FeaturedWorksGrid";
import { PermanenceBand } from "@/components/home/PermanenceBand";

/** Map a Token `chain` tag to its numeric chain id (mirrors the catalog). */
const CHAIN_ID_BY_TAG: Record<string, number> = { base: 84532, ethereum: 11155111 };

function collectionHref(chain: string, contract: string): string {
  const chainId = CHAIN_ID_BY_TAG[chain] ?? 84532;
  return `/collections/onchain/${chainId}/${contract}`;
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ genre?: string }>;
}) {
  const sp = await searchParams;
  const activeGenre = sp.genre;

  // One index pass: fetch the tier-split tokens, open listings, and collections
  // concurrently, then derive both the displayed token list (enriched with
  // listings) and the market stats from that data — no duplicate indexing.
  const [split, listings, collections] = await Promise.all([
    getLiveTokensSplit(),
    getOpenListings(),
    getLiveCollections(),
  ]);
  const tokens = enrichWithListings(split.all, listings);
  const stats = computeMarketStats(split.libraryTokens, split.dropTokens, collections);

  // Per-collection live page hrefs (serializable, computed on the server).
  const collectionHrefs = Object.fromEntries(
    collections.map((c) => [c.slug, collectionHref(c.chain, c.contractAddress)]),
  );

  // Hero: prefer a collection that actually has works; else the first one.
  const heroCollection = collections.find((c) => c.itemCount > 0) ?? collections[0];

  // Featured drops: the most recent live tokens. artistName falls back to a
  // short address (the handle is "perpetual" / the creator for live tokens).
  const recentTokens = [...tokens].reverse();
  const featuredItems = recentTokens.slice(0, 8).map((token) => ({
    token,
    artistName:
      token.artistHandle && token.artistHandle !== "perpetual"
        ? token.artistHandle
        : shortAddr(token.royalty.receiver),
  }));

  return (
    <>
      <h1 className="sr-only">Perpetual — permanence-first NFT marketplace</h1>

      {heroCollection ? (
        <HeroFeature
          collection={heroCollection}
          href={collectionHrefs[heroCollection.slug] ?? "/collections"}
        />
      ) : (
        <section className="border-b border-border">
          <div className="mx-auto w-full max-w-[1600px] px-4 pt-6 pb-10 sm:px-6 sm:pt-8 lg:pt-10">
            <div className="mb-8">
              <MonoLabel className="text-faint">Permanence-first marketplace</MonoLabel>
              <h2 className="display-lg mt-2 max-w-3xl font-brand text-foreground">
                Art that outlives the platform it’s sold on.
              </h2>
              <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted">
                Every work is stored across parallel shards, including a consensus-guaranteed
                on-chain proof. Nothing has been minted here yet — be the first.
              </p>
            </div>
            <EmptyState
              eyebrow="Open collection"
              title="Be the first to mint"
              body="There are no live works yet. Mint into the open collection or deploy your own sovereign contract."
              action={
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <ButtonLink href="/mint" variant="accent" size="lg">Mint a work</ButtonLink>
                  <ButtonLink href="/explore" variant="secondary" size="lg">Browse the catalog</ButtonLink>
                </div>
              }
            />
          </div>
        </section>
      )}

      <CategoryPills genres={GENRES} active={activeGenre} />

      {featuredItems.length > 0 && (
        <Reveal3D>
          <Section id="featured-drops">
            <FeaturedDrops items={featuredItems} />
          </Section>
        </Reveal3D>
      )}

      {collections.length > 0 && (
        <Reveal3D>
          <Section id="collections" className="border-t border-border pt-12 sm:pt-14 lg:pt-16">
            <LatestCollections collections={collections} hrefs={collectionHrefs} />
          </Section>
        </Reveal3D>
      )}

      <Reveal3D>
        <Section id="recent" className="border-t border-border pt-12 sm:pt-14 lg:pt-16">
          {recentTokens.length > 0 ? (
            <FeaturedWorksGrid tokens={recentTokens.slice(0, 10)} />
          ) : (
            <EmptyState
              eyebrow="Recent works"
              title="No works minted yet"
              body="When the first piece is minted on-chain it will appear here, with full provenance and permanence proofs."
              action={<ButtonLink href="/mint" variant="accent" size="lg">Mint the first work</ButtonLink>}
            />
          )}
        </Section>
      </Reveal3D>

      <Reveal3D>
        <PermanenceBand stats={stats} />
      </Reveal3D>

      <div className="h-12 sm:h-16" />
    </>
  );
}

function shortAddr(addr: string): string {
  if (!addr || addr.length < 10) return addr || "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
