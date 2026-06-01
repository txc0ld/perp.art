/**
 * StatsOverview — the lead protocol stats for the Rankings page. These are the
 * numbers that are genuinely meaningful on a permanence-first protocol (even on
 * testnet): works minted, live collections, verified shards, permanence
 * integrity, and on-chain proof rate. Real values straight from
 * getLiveMarketStats() — honest zeros when the chain is empty, never fabricated.
 * Server component.
 */
import type { LiveMarketStats } from "@/lib/live/catalog";

export function StatsOverview({ stats }: { stats: LiveMarketStats }) {
  const cells: Array<{ label: string; value: string; accent?: boolean }> = [
    { label: "Works minted", value: stats.works.toLocaleString() },
    { label: "Collections", value: stats.collections.toLocaleString() },
    { label: "Verified shards", value: stats.verifiedShards.toLocaleString() },
    { label: "Permanence integrity", value: `${stats.permanenceIntegrity}%`, accent: true },
    { label: "Onchain proof", value: `${stats.onchainProofRate}%` },
  ];

  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[10px] border border-border bg-border sm:grid-cols-3 lg:grid-cols-5">
      {cells.map((c) => (
        <div key={c.label} className="bg-surface px-4 py-5">
          <p className="font-mono text-[10px] uppercase tracking-wider text-faint">{c.label}</p>
          <p
            className={
              c.accent
                ? "mt-1.5 font-mono text-2xl tabular-nums text-accent"
                : "mt-1.5 font-mono text-2xl tabular-nums text-foreground"
            }
          >
            {c.value}
          </p>
        </div>
      ))}
    </div>
  );
}

export default StatsOverview;
