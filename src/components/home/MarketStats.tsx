/**
 * MarketStats - engineered, monospace stats band (design prompt §4.1).
 * Tabular-nums, hairline-separated. The permanence-integrity figure leads.
 */
import { Section } from "@/components/ui";
import { Reveal } from "./Reveal";

type Stats = {
  works: number;
  artists: number;
  collections: number;
  verifiedShards: number;
  permanenceIntegrity: number;
  onchainProofRate: number;
};

export function MarketStats({ stats }: { stats: Stats }) {
  const items: Array<{ value: string; label: string; accent?: boolean }> = [
    { value: `${stats.permanenceIntegrity}%`, label: "Permanence integrity", accent: true },
    { value: `${stats.onchainProofRate}%`, label: "Onchain proof rate" },
    { value: stats.verifiedShards.toLocaleString(), label: "Verified shards" },
    { value: stats.works.toLocaleString(), label: "Works archived" },
    { value: stats.artists.toLocaleString(), label: "Artists" },
    { value: stats.collections.toLocaleString(), label: "Collections" },
  ];

  return (
    <Section>
      <Reveal>
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[8px] border border-border bg-border sm:grid-cols-3 lg:grid-cols-6">
          {items.map((it, i) => (
            <div key={it.label} className="flex flex-col gap-2 bg-background p-6">
              <Reveal delay={i * 60}>
                <span
                  className={
                    "font-mono text-3xl font-medium tabular-nums " +
                    (it.accent ? "text-accent" : "text-foreground")
                  }
                >
                  {it.value}
                </span>
                <span className="mt-2 block font-mono text-[10px] uppercase tracking-wider text-faint">
                  {it.label}
                </span>
              </Reveal>
            </div>
          ))}
        </div>
      </Reveal>
    </Section>
  );
}

export default MarketStats;
