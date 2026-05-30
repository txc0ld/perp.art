/**
 * Hero - the first viewport (design prompt §4.1).
 * Full-bleed, atmospheric. AmbientField sits absolutely behind a single
 * confident thesis statement, a calm subhead, two CTAs, and a floating
 * focal generative-art object. The art is the brightest thing; the UI frames it.
 */
import { AmbientField } from "@/components/visual/AmbientField";
import { ButtonLink, MonoLabel, Badge, StatusGlyph } from "@/components/ui";
import { GenerativeArt } from "@/components/art/GenerativeArt";
import type { Token } from "@/lib/types";
import { getArtist, getMarketStats } from "@/lib/mock-data";
import { formatEth } from "@/lib/utils";

export function Hero({ focal }: { focal: Token }) {
  const artist = getArtist(focal.artistHandle);
  const stats = getMarketStats();
  const verifiedShards = focal.permanence.shards.filter((s) => s.status === "verified").length;

  return (
    <section className="relative isolate overflow-hidden border-b border-border">
      {/* atmospheric depth, behind everything */}
      <AmbientField className="-z-10" />
      {/* faint engineered baseline grid, barely there */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
          backgroundSize: "88px 88px",
          maskImage: "radial-gradient(120% 80% at 50% 0%, #000 30%, transparent 80%)",
        }}
      />

      <div className="mx-auto grid min-h-[85vh] w-full max-w-[1320px] grid-cols-1 items-center gap-12 px-6 py-24 sm:px-8 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16 lg:py-28">
        {/* Left - the thesis */}
        <div className="max-w-2xl">
          <div className="animate-rise" style={{ animationDelay: "40ms" }}>
            <MonoLabel className="text-faint">
              Permanence-first · Non-custodial
            </MonoLabel>
          </div>

          <h1 className="display-lg mt-6 text-foreground">
            <span className="block overflow-hidden">
              <span className="animate-reveal block" style={{ animationDelay: "120ms" }}>
                Art, engineered
              </span>
            </span>
            <span className="block overflow-hidden">
              <span className="animate-reveal block" style={{ animationDelay: "220ms" }}>
                to outlast everything.
              </span>
            </span>
          </h1>

          <p
            className="animate-rise mt-7 max-w-xl text-[18px] leading-relaxed text-muted"
            style={{ animationDelay: "360ms" }}
          >
            A digital conservatory for serious art. Every work is written to four
            independent immutable backends and anchored by an onchain proof - so it
            survives even if Perpetual disappears.
          </p>

          <div
            className="animate-rise mt-9 flex flex-col gap-3 sm:flex-row sm:items-center"
            style={{ animationDelay: "460ms" }}
          >
            <ButtonLink href="/explore" variant="accent" size="lg">
              Explore the collection
            </ButtonLink>
            <ButtonLink href="/mint" variant="secondary" size="lg">
              For artists
            </ButtonLink>
          </div>

          {/* quiet proof line under the CTAs */}
          <div
            className="animate-fade mt-10 flex flex-wrap items-center gap-x-6 gap-y-3"
            style={{ animationDelay: "620ms" }}
          >
            <span className="inline-flex items-center gap-2">
              <StatusGlyph status="verified" />
              <span className="font-mono text-xs uppercase tracking-wider text-muted">
                {stats.permanenceIntegrity}% permanence integrity
              </span>
            </span>
            <span className="hidden h-3 w-px bg-border sm:block" aria-hidden />
            <span className="font-mono text-xs uppercase tracking-wider text-faint">
              {stats.works} works · {stats.artists} artists
            </span>
          </div>
        </div>

        {/* Right - floating focal object */}
        <div
          className="animate-rise relative mx-auto hidden w-full max-w-md lg:block"
          style={{ animationDelay: "300ms" }}
        >
          <div className="group relative">
            {/* soft halo so the art reads as the brightest element */}
            <div
              aria-hidden
              className="absolute -inset-8 -z-10 rounded-[24px] opacity-60 blur-3xl"
              style={{ background: "radial-gradient(closest-side, rgba(254,147,237,0.10), transparent)" }}
            />
            <div className="overflow-hidden rounded-[8px] border border-border bg-surface shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)]">
              <div className="relative aspect-square overflow-hidden bg-background">
                <GenerativeArt
                  seed={focal.artSeed}
                  genre={focal.genre}
                  size={800}
                  className="h-full w-full"
                />
                <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-background/70 px-2.5 py-1 backdrop-blur-md">
                  <StatusGlyph status="verified" />
                  <span className="font-mono text-[10px] uppercase tracking-wider text-accent">
                    {verifiedShards} shards verified
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-border p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{focal.title}</p>
                  <p className="mt-0.5 truncate text-xs text-muted">{artist?.name ?? focal.artistHandle}</p>
                </div>
                <div className="shrink-0 text-right">
                  {focal.listing ? (
                    <p className="font-mono text-sm tabular-nums text-foreground">
                      {formatEth(focal.listing.priceEth)} ETH
                    </p>
                  ) : (
                    <Badge tone="muted">Archived</Badge>
                  )}
                </div>
              </div>
            </div>
            {/* mono caption pinned to the focal object */}
            <div className="mt-3 flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-wider text-faint">
                Featured · community vote
              </span>
              <span className="font-mono text-[10px] uppercase tracking-wider text-faint">
                {focal.chain === "ethereum" ? "Mainnet" : "Base"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Hero;
