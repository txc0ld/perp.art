"use client";

import Link from "next/link";
import { Tilt3D } from "@/components/visual/Tilt3D";
import { BrandMark } from "@/components/chrome/Brand";
import { GenerativeArt } from "@/components/art/GenerativeArt";
import { Badge, StatusGlyph } from "@/components/ui";
import type { Genre, Chain } from "@/lib/types";

/**
 * HeroArt3D - the featured artwork rendered as a tasteful 3D moment. The art is
 * wrapped in a modest Tilt3D (max ~7) with sheen, sits above soft accent depth
 * layers (translateZ via preserve-3d), and carries a small floating BrandMark
 * medallion as a luxurious accent. The artwork stays the brightest element:
 * depth layers are faint glows and the medallion is small + low-contrast.
 *
 * Client island so the tilt + float can run; the surrounding HeroFeature stays
 * a server component. Reduced-motion + coarse-pointer handling lives in Tilt3D
 * and the animate-float helper, so this degrades to a clean static frame.
 */
export function HeroArt3D({
  slug,
  coverSeed,
  genre,
  chain,
}: {
  slug: string;
  coverSeed: string;
  genre: Genre;
  chain: Chain;
}) {
  return (
    <div className="perspective-1400 relative bg-background lg:h-full">
      {/* Soft depth layers behind the art - pushed back in Z, faint, never
          competing with the work. Hidden from a11y tree. */}
      <div aria-hidden className="preserve-3d pointer-events-none absolute inset-0">
        <div
          className="absolute -inset-6 opacity-70"
          style={{
            transform: "translateZ(-120px)",
            background:
              "radial-gradient(60% 55% at 28% 30%, rgba(254,147,237,0.10), transparent 70%)",
          }}
        />
        <div
          className="absolute -inset-10 opacity-60"
          style={{
            transform: "translateZ(-220px)",
            background:
              "radial-gradient(70% 60% at 75% 80%, rgba(255,255,255,0.05), transparent 72%)",
          }}
        />
      </div>

      <Tilt3D
        max={7}
        lift={14}
        glare
        scale={1.01}
        className="relative h-full rounded-none"
      >
        <Link
          href={`/collections/${slug}`}
          className="group/art relative block aspect-[16/11] overflow-hidden bg-background lg:aspect-auto lg:h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-inset"
        >
          <GenerativeArt
            seed={coverSeed}
            genre={genre}
            size={1200}
            className="h-full w-full transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/art:scale-[1.03]"
          />
          {/* bottom gradient so overlaid chrome stays legible on mobile */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent lg:hidden"
          />
          <div className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-background/70 px-2.5 py-1 backdrop-blur-md">
            <StatusGlyph status="verified" />
            <span className="font-mono text-[10px] uppercase tracking-wider text-accent">
              Featured / Permanence verified
            </span>
          </div>
          <div className="absolute right-4 top-4">
            <Badge tone="muted">{chain === "ethereum" ? "Mainnet" : "Base"}</Badge>
          </div>

          {/* Floating brand medallion - a small luxurious accent that lifts off
              the surface. Lives in its own perspective container so the float
              reads as depth, not a flat bob. Small + faint: never outshines art. */}
          <div className="perspective-1000 pointer-events-none absolute bottom-4 right-4 hidden sm:block">
            <div className="animate-float">
              <span className="flex h-12 w-12 items-center justify-center rounded-full border border-border-bright/70 bg-background/60 text-foreground/90 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.9)] backdrop-blur-md">
                <BrandMark size={22} strokeWidth={3.2} />
              </span>
            </div>
          </div>
        </Link>
      </Tilt3D>
    </div>
  );
}

export default HeroArt3D;
