import type { Metadata } from "next";
import { getAllTokens } from "@/lib/mock-data";
import { ExploreClient } from "@/components/explore/ExploreClient";
import { filtersFromSearchParams } from "@/components/explore/filters";

export const metadata: Metadata = {
  title: "Explore - Perpetual",
  description: "Browse art engineered to outlast everything. Filter by genre, chain, permanence, and price.",
};

/**
 * Explore / Browse (design prompt §4.2).
 * Server component: reads searchParams (a Promise in Next 16) and does all data
 * access, then hands a plain token list + initial filter state to the client shell.
 */
export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const tokens = getAllTokens();
  const initialFilters = filtersFromSearchParams(sp);

  return (
    <div className="py-8 sm:py-10">
      <ExploreClient tokens={tokens} initialFilters={initialFilters} />
    </div>
  );
}
