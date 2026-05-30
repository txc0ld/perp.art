import type { Metadata } from "next";
import { getTrendingCollections, GENRES, type RankWindow, type CollectionRanking } from "@/lib/mock-data";
import { Section, SectionHeader } from "@/components/ui";
import { RankingsTable } from "@/components/stats/RankingsTable";

export const metadata: Metadata = {
  title: "Rankings - Perpetual",
  description: "Collections ranked by volume, floor, and movement across every time window. Each figure traces to onchain-anchored, permanent work.",
};

const WINDOWS: RankWindow[] = ["1h", "6h", "24h", "7d", "30d"];

/** Stats / Rankings - OpenSea-style ranked table of collections. */
export default function StatsPage() {
  // Precompute every window on the server; the client table only toggles views.
  const data = WINDOWS.reduce((acc, w) => {
    acc[w] = getTrendingCollections(w);
    return acc;
  }, {} as Record<RankWindow, CollectionRanking[]>);

  return (
    <Section>
      <SectionHeader
        as="h1"
        eyebrow="The Register"
        title="Rankings"
        description="Every collection on Perpetual, ordered by trading volume and movement. Filter by time window, category, and chain. Each floor and sale traces back to onchain-anchored, permanent work."
      />

      <RankingsTable data={data} genres={GENRES} />
    </Section>
  );
}
