/**
 * PermanenceBand - ONE slim band reinforcing the differentiator. Commerce
 * pages stay short, so this is a single line plus a few mono stats and a link
 * to /permanence. Server component.
 */
import { ButtonLink, StatusGlyph } from "@/components/ui";

interface MarketStats {
  works: number;
  artists: number;
  collections: number;
  verifiedShards: number;
  permanenceIntegrity: number;
  onchainProofRate: number;
}

export function PermanenceBand({ stats }: { stats: MarketStats }) {
  return (
    <div className="border-y border-border bg-surface">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 px-4 py-8 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:py-9">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 shrink-0">
            <StatusGlyph status="verified" />
          </span>
          <p className="max-w-2xl text-[15px] leading-relaxed text-foreground">
            Every work is written across four independent immutable backends and anchored by an onchain proof. It survives even if Perpetual disappears. That is the only guarantee we make, and we make it provable.
          </p>
        </div>

        <div className="flex shrink-0 flex-col gap-4 sm:flex-row sm:items-center sm:gap-px sm:overflow-hidden sm:rounded-[10px] sm:border sm:border-border sm:bg-border">
          <div className="grid grid-cols-3 gap-px overflow-hidden rounded-[10px] border border-border bg-border sm:contents">
            <BandStat label="Integrity" value={`${stats.permanenceIntegrity}%`} accent />
            <BandStat label="Onchain proof" value={`${stats.onchainProofRate}%`} />
            <BandStat label="Verified shards" value={String(stats.verifiedShards)} />
          </div>
          <div className="bg-surface sm:px-4 sm:py-3">
            <ButtonLink href="/permanence" variant="secondary" size="sm">
              How it works
            </ButtonLink>
          </div>
        </div>
      </div>
    </div>
  );
}

function BandStat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="bg-surface px-4 py-3">
      <p className="font-mono text-[10px] uppercase tracking-wider text-faint">{label}</p>
      <p className={accent ? "mt-1 font-mono text-base tabular-nums text-accent" : "mt-1 font-mono text-base tabular-nums text-foreground"}>
        {value}
      </p>
    </div>
  );
}

export default PermanenceBand;
