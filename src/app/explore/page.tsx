import type { Metadata } from "next";
import { getAllTokens } from "@/lib/mock-data";
import { indexAllTokens, mergeForExplore } from "@/lib/web3/indexer";
import { ExploreClient } from "@/components/explore/ExploreClient";
import { filtersFromSearchParams } from "@/components/explore/filters";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Explore - Perpetual",
  description: "Browse art engineered to outlast its operator. Filter by genre, chain, storage, and price, then verify permanence per shard.",
};

/**
 * Explore / Browse (design prompt §4.2).
 * Server component: reads searchParams (a Promise in Next 16) and does all data
 * access, then hands a plain token list + initial filter state to the client shell.
 * Live on-chain tokens (Base Sepolia 84532) are merged first; mock tokens follow.
 */
export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const live = await indexAllTokens(84532);
  const tokens = mergeForExplore(live, getAllTokens());
  const initialFilters = filtersFromSearchParams(sp);

  return (
    <div className="py-8 sm:py-10">
      <h1 className="sr-only">Explore</h1>
      <ExploreClient tokens={tokens} initialFilters={initialFilters} />
    </div>
  );
}
