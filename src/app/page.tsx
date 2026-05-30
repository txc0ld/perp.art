/**
 * PERPETUAL - Home (OpenSea-style discovery surface, in our dark + pink theme).
 *
 * Dense, wide, data-forward. Server component: mock data is synchronous so no
 * fetching is needed. The layout already renders SiteHeader + SiteFooter; this
 * page returns only its own sections.
 *
 * Sections (top to bottom):
 *   1. Hero feature strip   - the top-ranked collection, art-forward banner
 *   2. Category pill row     - genre filters linking to /explore?genre=X
 *   3. Trending collections  - the signature ranked table, client window toggle
 *   4. Notable works grid    - community-voted ArtTiles
 *   5. Top movers row         - biggest 24h floor changes
 *   6. Permanence value band  - one slim differentiator strip
 *
 * `searchParams` is awaited per Next 16 (it is a Promise) and used only to set
 * the active state of the category pills. The trending table receives all five
 * windows as props and toggles client-side for a smooth, no-navigation feel.
 */
import {
  getFeaturedTokens,
  getMarketStats,
  getTrendingCollections,
  getTopMovers,
  GENRES,
} from "@/lib/mock-data";
import type { CollectionRanking, RankWindow } from "@/lib/mock-data";

import { Section } from "@/components/ui";
import { HeroFeature } from "@/components/home/HeroFeature";
import { CategoryPills } from "@/components/home/CategoryPills";
import { TrendingTable } from "@/components/home/TrendingTable";
import { FeaturedWorksGrid } from "@/components/home/FeaturedWorksGrid";
import { TopMovers } from "@/components/home/TopMovers";
import { PermanenceBand } from "@/components/home/PermanenceBand";

const WINDOWS: RankWindow[] = ["1h", "6h", "24h", "7d", "30d"];

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ genre?: string }>;
}) {
  const sp = await searchParams;
  const activeGenre = sp.genre;

  const featured = getFeaturedTokens();
  const stats = getMarketStats();

  // Precompute every window once on the server, then hand the whole map to the
  // client TrendingTable so its toggle is instant (never import data fns there).
  const trendingByWindow = Object.fromEntries(
    WINDOWS.map((w) => [w, getTrendingCollections(w)]),
  ) as Record<RankWindow, CollectionRanking[]>;

  const heroFeature = trendingByWindow["24h"][0];
  const movers = getTopMovers("24h").slice(0, 4);

  return (
    <>
      <HeroFeature feature={heroFeature} />

      <CategoryPills genres={GENRES} active={activeGenre} />

      <Section id="trending">
        <TrendingTable data={trendingByWindow} defaultWindow="24h" limit={6} />
      </Section>

      <Section id="notable" className="border-t border-border pt-12 sm:pt-14 lg:pt-16">
        <FeaturedWorksGrid tokens={featured} />
      </Section>

      <Section id="movers" className="border-t border-border pb-14 pt-12 sm:pt-14 lg:pt-16">
        <TopMovers movers={movers} />
      </Section>

      <PermanenceBand stats={stats} />

      <div className="h-12 sm:h-16" />
    </>
  );
}
