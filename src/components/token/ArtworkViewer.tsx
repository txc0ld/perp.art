"use client";

/**
 * ArtworkViewer - the hero (design prompt §4.3). The artwork is the brightest thing
 * on screen, set in a calm hairline frame on near-black with generous negative space.
 * A subtle fullscreen affordance opens a near-black lightbox (Esc / click to close).
 */
import * as React from "react";
import type { Token } from "@/lib/types";
import { GenerativeArt } from "@/components/art/GenerativeArt";
import { Tilt3D } from "@/components/visual/Tilt3D";
import { getChainMeta } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export function ArtworkViewer({ token }: { token: Token }) {
  const [zoomed, setZoomed] = React.useState(false);

  React.useEffect(() => {
    if (!zoomed) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setZoomed(false);
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [zoomed]);

  const mediaLabel =
    token.mediaType === "interactive" ? "Interactive" : token.mediaType === "video" ? "Video" : "Image";

  return (
    <div>
      {/* Gallery frame with depth - the art leans toward the cursor and reads as
          floating slightly off the wall (modest tilt, soft sheen). */}
      <Tilt3D max={6} lift={10} scale={1.005} className="rounded-[10px]">
        <div className="group relative overflow-hidden rounded-[10px] border border-border bg-background p-2 shadow-[0_40px_90px_-50px_rgba(0,0,0,0.9)]">
          {/* Thin inner frame - a quiet matte around the work. */}
          <div className="relative overflow-hidden rounded-[6px] border border-border/70 bg-background">
            <div className="aspect-square w-full">
              <GenerativeArt
                seed={token.artSeed}
                genre={token.genre}
                size={1000}
                className="h-full w-full"
              />
            </div>

            {/* Inner-edge vignette so the matte reads as recessed depth. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-[6px]"
              style={{
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), inset 0 0 40px rgba(0,0,0,0.35)",
              }}
            />
          </div>

          {/* Fullscreen / zoom affordance */}
          <button
            onClick={() => setZoomed(true)}
            aria-label="View fullscreen"
            className={cn(
              "absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-[8px]",
              "border border-border/60 bg-background/70 text-muted backdrop-blur-md",
              "opacity-0 transition-all duration-300 hover:border-accent/40 hover:text-accent",
              "group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
            )}
          >
            <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none">
              <path d="M6 2H2v4M10 2h4v4M6 14H2v-4M10 14h4v-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </Tilt3D>

      {/* Mono caption - verifiable framing details */}
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-[11px] uppercase tracking-wider text-faint">
        <span className="whitespace-nowrap">{token.id}</span>
        <span className="whitespace-nowrap">{getChainMeta(token.chain).label}</span>
        <span className="whitespace-nowrap">{mediaLabel}</span>
        <span className="whitespace-nowrap text-muted">{token.genre}</span>
      </div>

      {/* Lightbox */}
      {zoomed && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 p-4 sm:p-10 animate-fade"
          role="dialog"
          aria-modal="true"
          aria-label={`${token.title} fullscreen`}
          onMouseDown={() => setZoomed(false)}
        >
          <div
            className="relative max-h-full max-w-[min(92vh,1100px)] overflow-hidden rounded-[8px] border border-border-bright"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <GenerativeArt
              seed={token.artSeed}
              genre={token.genre}
              size={1200}
              className="h-auto w-full"
            />
          </div>
          <button
            onClick={() => setZoomed(false)}
            aria-label="Close fullscreen"
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-[8px] border border-border/60 bg-surface/70 text-muted backdrop-blur-md transition-colors hover:text-foreground"
          >
            <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
