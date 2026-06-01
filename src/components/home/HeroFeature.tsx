/**
 * HeroFeature - OpenSea-style big featured banner.
 *
 * A large generative work of a live collection sits in a hairline frame on the
 * left; collection name, a mono stats row, and the primary accent CTA sit in a
 * gradient-overlaid panel. Art-forward, wide, commerce-first. Server component.
 *
 * Sourced from a live `Collection`. Live testnet collections have no market
 * yet, so floor / volume render as "—" honestly rather than a fabricated number.
 */
import type { Collection } from "@/lib/types";
import { ButtonLink, Badge } from "@/components/ui";
import { HeroArt3D } from "./HeroArt3D";
import { getChainMeta } from "@/lib/chains";
import { formatEth } from "@/lib/utils";

export function HeroFeature({ collection, href }: { collection: Collection; href: string }) {
  const c = collection;
  const currency = getChainMeta(c.chain).currency;
  const floor = c.floorEth > 0 ? `${formatEth(c.floorEth)} ${currency}` : "—";
  const volume = c.volumeEth > 0 ? `${formatEth(c.volumeEth)} ${currency}` : "—";

  return (
    <section className="border-b border-border">
      <div className="mx-auto w-full max-w-[1600px] px-4 pt-6 pb-10 sm:px-6 sm:pt-8 lg:pt-10">
        <div className="animate-rise grid grid-cols-1 gap-px overflow-hidden rounded-[10px] border border-border bg-border lg:grid-cols-[1.35fr_1fr]">
          {/* Left - the art, brightest element, as a tasteful 3D moment */}
          <HeroArt3D slug={c.slug} href={href} coverSeed={c.coverSeed} genre={c.genre} chain={c.chain} />

          {/* Right - the pitch + numerics + CTA */}
          <div className="relative flex flex-col justify-between gap-7 bg-surface p-5 sm:gap-8 sm:p-8 lg:p-10">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-60"
              style={{ background: "radial-gradient(120% 90% at 100% 0%, rgba(254,147,237,0.08), transparent 60%)" }}
            />
            <div className="relative">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] uppercase tracking-wider text-faint">
                  Live on-chain
                </span>
                {c.sovereign ? <Badge tone="accent">Sovereign</Badge> : null}
              </div>
              <h2 className="display-sm mt-3 font-brand text-foreground">{c.name}</h2>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">{c.description}</p>
            </div>

            <div className="relative">
              {/* mono stats row */}
              <div className="grid grid-cols-3 gap-px overflow-hidden rounded-[10px] border border-border bg-border">
                <Stat label="Floor" value={floor} />
                <Stat label="Items" value={String(c.itemCount)} />
                <Stat label="Volume" value={volume} />
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
                <ButtonLink href={href} variant="accent" size="lg">
                  View collection
                </ButtonLink>
                <ButtonLink href="/explore" variant="secondary" size="lg">
                  Browse the catalog
                </ButtonLink>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface px-4 py-3.5">
      <p className="font-mono text-[10px] uppercase tracking-wider text-faint">{label}</p>
      <p className="mt-1 font-mono text-base tabular-nums text-foreground">{value}</p>
    </div>
  );
}

export default HeroFeature;
