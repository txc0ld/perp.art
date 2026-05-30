import type { Metadata } from "next";
import { getTrendingCollections, GENRES, type RankWindow, type CollectionRanking } from "@/lib/mock-data";
import { Section, MonoLabel } from "@/components/ui";
import { RankingsTable } from "@/components/stats/RankingsTable";

export const metadata: Metadata = {
  title: "Rankings - Perpetual",
  description: "Top collections by volume, floor, and movement across every time window. Permanence-first, independently verifiable.",
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
      <div className="pb-8">
        <MonoLabel className="text-faint">Discover</MonoLabel>
        <h1 className="display-sm mt-2 font-brand text-foreground">Rankings</h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted">
          The top collections on Perpetual, ranked by trading volume. Filter by time window,
          category, and chain. Every floor and sale traces back to onchain-anchored, permanent work.
        </p>
      </div>

      <RankingsTable data={data} genres={GENRES} />
    </Section>
  );
}
