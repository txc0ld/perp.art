/**
 * HeroFeature - OpenSea-style big featured banner.
 *
 * A large generative work of the top-ranked collection sits in a hairline
 * frame on the left; collection name, artist, a mono stats row, and the
 * primary accent CTA sit in a gradient-overlaid panel. Art-forward, wide,
 * commerce-first. Server component.
 */
import Link from "next/link";
import { ButtonLink, Badge, StatusGlyph } from "@/components/ui";
import { GenerativeArt } from "@/components/art/GenerativeArt";
import { getArtist } from "@/lib/mock-data";
import { formatEth } from "@/lib/utils";
import type { CollectionRanking } from "@/lib/mock-data";

function VerifiedMark() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4 text-accent" fill="none" aria-label="verified">
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.3" />
      <path d="M5 8.2l2 2 4-4.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function HeroFeature({ feature }: { feature: CollectionRanking }) {
  const c = feature.collection;
  const artist = getArtist(c.artistHandle);

  return (
    <section className="border-b border-border">
      <div className="mx-auto w-full max-w-[1600px] px-4 pt-6 pb-10 sm:px-6 sm:pt-8 lg:pt-10">
        <div className="animate-rise grid grid-cols-1 gap-px overflow-hidden rounded-[10px] border border-border bg-border lg:grid-cols-[1.35fr_1fr]">
          {/* Left - the art, brightest element, in a hairline frame */}
          <Link
            href={`/collections/${c.slug}`}
            className="group relative block aspect-[16/11] overflow-hidden bg-background lg:aspect-auto"
          >
            <GenerativeArt
              seed={c.coverSeed}
              genre={c.genre}
              size={1200}
              className="h-full w-full transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.03]"
            />
            {/* bottom gradient so overlaid chrome stays legible on mobile */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent lg:hidden"
            />
            <div className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-background/70 px-2.5 py-1 backdrop-blur-md">
              <StatusGlyph status="verified" />
              <span className="font-mono text-[10px] uppercase tracking-wider text-accent">Featured / Permanence verified</span>
            </div>
            <div className="absolute right-4 top-4">
              <Badge tone="muted">{c.chain === "ethereum" ? "Mainnet" : "Base"}</Badge>
            </div>
          </Link>

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
                  By {artist?.name ?? c.artistHandle}
                </span>
                {artist?.verified ? <VerifiedMark /> : null}
                {c.sovereign ? <Badge tone="accent">Sovereign</Badge> : null}
              </div>
              <h1 className="display-sm mt-3 font-brand text-foreground">{c.name}</h1>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">{c.description}</p>
            </div>

            <div className="relative">
              {/* mono stats row */}
              <div className="grid grid-cols-3 gap-px overflow-hidden rounded-[10px] border border-border bg-border">
                <Stat label="Floor" value={`${formatEth(c.floorEth)} ETH`} />
                <Stat label="Items" value={String(c.itemCount)} />
                <Stat label="Volume" value={`${formatEth(c.volumeEth)} ETH`} />
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
                <ButtonLink href={`/collections/${c.slug}`} variant="accent" size="lg">
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
