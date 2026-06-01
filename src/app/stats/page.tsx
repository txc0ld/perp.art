import type { Metadata } from "next";
import { getLiveCollections, getLiveMarketStats } from "@/lib/live/catalog";
import { GENRES } from "@/lib/catalog-constants";
import { Section, SectionHeader, MonoLabel, EmptyState, ButtonLink } from "@/components/ui";
import { StatsOverview } from "@/components/stats/StatsOverview";
import { StatsCollectionsTable } from "@/components/stats/StatsCollectionsTable";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Rankings - Perpetual",
  description:
    "Live protocol stats and on-chain collections. Works minted, verified shards, permanence integrity, and on-chain proof — every figure traces to real indexed data.",
};

/** Map a Token `chain` tag to its numeric chain id (inverse of catalog's CHAIN_BY_ID). */
const CHAIN_ID_BY_TAG: Record<string, number> = { base: 84532, ethereum: 11155111 };

/**
 * Stats / Rankings. Leads with the real protocol stats (the genuinely meaningful
 * numbers even on testnet), then lists the live on-chain collections ranked by
 * item count. Live/testnet has effectively zero trading volume, so there is no
 * volume leaderboard and no time-window selector — those would only fabricate
 * meaning. Floor and volume render honestly as "—". Server component: fetches
 * live data and hands plain data to the client table.
 */
export default async function StatsPage() {
  const [stats, collections] = await Promise.all([
    getLiveMarketStats(),
    getLiveCollections(),
  ]);

  // Serializable slug→href map across the server→client boundary (each card
  // links to its live per-collection page).
  const hrefs = Object.fromEntries(
    collections.map((c) => {
      const chainId = CHAIN_ID_BY_TAG[c.chain] ?? 84532;
      return [c.slug, `/collections/onchain/${chainId}/${c.contractAddress}`];
    }),
  );

  return (
    <Section>
      <SectionHeader
        as="h1"
        eyebrow="The Register"
        title="Rankings"
        description="Live protocol stats and every on-chain collection on Perpetual. Each figure traces back to real indexed data — works minted, shards verified, and permanence proven. No fabricated volume."
      />

      <StatsOverview stats={stats} />

      <div className="mt-12">
        <MonoLabel className="text-faint">Collections</MonoLabel>
        <p className="mt-2 mb-6 max-w-2xl text-[13px] leading-relaxed text-muted">
          Ranked by item count. Floor and volume appear as &ldquo;—&rdquo; until there is
          real trading activity — we never fabricate market numbers.
        </p>

        {collections.length > 0 ? (
          <StatsCollectionsTable collections={collections} genres={GENRES} hrefs={hrefs} />
        ) : (
          <EmptyState
            eyebrow="The Register"
            title="No collections yet"
            body="Once the first sovereign contract is deployed and works are minted, they will rank here — by real item counts, not invented volume."
            action={
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <ButtonLink href="/mint" variant="accent" size="lg">Mint a work</ButtonLink>
                <ButtonLink href="/collections" variant="secondary" size="lg">Browse collections</ButtonLink>
              </div>
            }
          />
        )}
      </div>
    </Section>
  );
}
