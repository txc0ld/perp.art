"use client";

/**
 * Coverflow3D - an Apple-style coverflow of the featured drops, in real CSS 3D.
 *
 * The centered slide faces forward; neighbours rotate on Y (~45deg) and recede
 * via translateZ/translateX with depth dimming + scale falloff, so the active
 * artwork is unambiguously the brightest thing on screen (brand: art first, UI
 * the quiet frame). Transitions are ease-out, 300-600ms, no bounce.
 *
 * Navigation: prev/next buttons, clickable side slides, a dot indicator (active
 * dot = accent), keyboard arrows when focused, and pointer/touch drag to scrub
 * with snap-to-nearest. Ends are clamped.
 *
 * Reduced-motion / coarse-pointer: degrades to a clean horizontally scrollable
 * row of framed cards (no rotation), still fully navigable. The media-query
 * decision is made in an effect and committed via a deferred setState so we do
 * not violate react-hooks/set-state-in-effect.
 *
 * Performance: transform/opacity only; will-change applied while interacting;
 * the featured list is short (~8) so every slide renders.
 */

import * as React from "react";
import Link from "next/link";
import { GenerativeArt } from "@/components/art/GenerativeArt";
import { MonoLabel } from "@/components/ui";
import { cn, formatEth } from "@/lib/utils";
import { getChainMeta } from "@/lib/mock-data";
import type { Token } from "@/lib/types";

export interface CoverflowItem {
  token: Token;
  /** Resolved display name for the artist (handle is the fallback). */
  artistName: string;
}

interface Props {
  items: CoverflowItem[];
  className?: string;
}

/** Geometry of the coverflow. Classic, restrained angles. */
const ROTATE_DEG = 44; // side-slide yaw
const STEP_X = 56; // % of slide width each neighbour shifts outward
const RECEDE_Z = 150; // px each neighbour recedes
const MAX_VISIBLE = 3; // slides drawn on each side before they fade out

export function Coverflow3D({ items, className }: Props) {
  const count = items.length;
  const [active, setActive] = React.useState(0);
  // null until measured, so the very first paint matches on server + client.
  const [staticMode, setStaticMode] = React.useState(false);
  const [dragging, setDragging] = React.useState(false);

  const stageRef = React.useRef<HTMLDivElement>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const pointer = React.useRef<{ id: number; startX: number; startActive: number; moved: boolean } | null>(null);
  const [dragOffset, setDragOffset] = React.useState(0); // fractional slide offset while dragging

  // ----- reduced-motion / coarse-pointer detection (deferred setState) -----
  React.useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const coarse = window.matchMedia("(pointer: coarse)");
    const compute = () => reduce.matches || coarse.matches;
    let raf = 0;
    const apply = () => {
      const next = compute();
      // Defer the state commit out of the effect body / listener microtask.
      raf = window.setTimeout(() => setStaticMode(next), 0);
    };
    apply();
    reduce.addEventListener("change", apply);
    coarse.addEventListener("change", apply);
    return () => {
      window.clearTimeout(raf);
      reduce.removeEventListener("change", apply);
      coarse.removeEventListener("change", apply);
    };
  }, []);

  const clamp = React.useCallback(
    (i: number) => Math.max(0, Math.min(count - 1, i)),
    [count],
  );
  const go = React.useCallback((i: number) => setActive((cur) => clamp(i ?? cur)), [clamp]);
  const next = React.useCallback(() => setActive((i) => clamp(i + 1)), [clamp]);
  const prev = React.useCallback(() => setActive((i) => clamp(i - 1)), [clamp]);

  // ----- keyboard nav (only when the stage is focused / hovered) -----
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      next();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      prev();
    } else if (e.key === "Home") {
      e.preventDefault();
      go(0);
    } else if (e.key === "End") {
      e.preventDefault();
      go(count - 1);
    }
  };

  // ----- pointer / touch drag to scrub (3D mode only) -----
  const onPointerDown = (e: React.PointerEvent) => {
    if (staticMode) return;
    pointer.current = { id: e.pointerId, startX: e.clientX, startActive: active, moved: false };
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const p = pointer.current;
    if (!p || p.id !== e.pointerId) return;
    const stageW = stageRef.current?.offsetWidth ?? 600;
    // One slide step per ~28% of stage width dragged.
    const frac = (e.clientX - p.startX) / (stageW * 0.28);
    if (Math.abs(e.clientX - p.startX) > 4) p.moved = true;
    setDragOffset(-frac);
  };
  const endDrag = (e: React.PointerEvent) => {
    const p = pointer.current;
    if (!p || p.id !== e.pointerId) return;
    const settled = clamp(Math.round(p.startActive + dragOffset));
    pointer.current = null;
    setDragging(false);
    setDragOffset(0);
    setActive(settled);
  };

  // Effective (possibly fractional) center while dragging, for smooth scrub.
  const center = dragging ? active + dragOffset : active;

  // =========================================================================
  // STATIC FALLBACK: a clean horizontally-scrollable row of framed cards.
  // =========================================================================
  if (staticMode) {
    return (
      <div className={cn("relative", className)}>
        <div
          ref={scrollRef}
          className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4"
          style={{ scrollbarWidth: "thin", WebkitOverflowScrolling: "touch" }}
          aria-roledescription="carousel"
          aria-label="Featured drops"
        >
          {items.map(({ token, artistName }) => (
            <Link
              key={token.id}
              href={`/token/${token.id}`}
              className="group relative w-[68vw] max-w-[320px] shrink-0 snap-center overflow-hidden rounded-[10px] border border-border bg-surface transition-colors hover:border-border-bright focus-visible:border-accent"
            >
              <div className="aspect-square w-full overflow-hidden">
                <GenerativeArt seed={token.artSeed} genre={token.genre} className="h-full w-full" />
              </div>
              <SlideCaption token={token} artistName={artistName} compact />
            </Link>
          ))}
        </div>
        <Dots count={count} active={clamp(Math.round(active))} onDot={go} />
      </div>
    );
  }

  // =========================================================================
  // 3D COVERFLOW
  // =========================================================================
  const activeItem = items[clamp(Math.round(active))];

  return (
    <div
      className={cn("relative select-none", className)}
      role="group"
      aria-roledescription="coverflow carousel"
      aria-label="Featured drops"
    >
      <div
        ref={stageRef}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className={cn(
          "perspective-1400 relative mx-auto flex h-[clamp(320px,46vw,560px)] w-full items-center justify-center overflow-hidden rounded-[10px] outline-none",
          "focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          dragging ? "cursor-grabbing" : "cursor-grab",
        )}
        style={{ touchAction: "pan-y" }}
      >
        <div className="preserve-3d relative h-[clamp(240px,34vw,420px)] w-[clamp(240px,34vw,420px)]">
          {items.map((item, i) => {
            const dist = i - center; // signed distance from center
            const abs = Math.abs(dist);
            const dir = dist === 0 ? 0 : dist > 0 ? 1 : -1;
            const hidden = abs > MAX_VISIBLE + 0.5;
            const isActive = Math.round(center) === i;

            // Depth falloff: dim + shrink + recede with distance.
            const clampedAbs = Math.min(abs, MAX_VISIBLE);
            const translateX = dist * STEP_X; // % of slide width
            const translateZ = -clampedAbs * RECEDE_Z;
            const rotateY = -dir * Math.min(abs, 1) * ROTATE_DEG;
            const scale = 1 - clampedAbs * 0.06;
            const opacity = hidden ? 0 : 1 - clampedAbs * 0.26;
            const brightness = 1 - Math.min(clampedAbs, 2) * 0.22;

            return (
              <button
                key={item.token.id}
                type="button"
                aria-hidden={hidden}
                tabIndex={isActive ? 0 : -1}
                aria-label={
                  isActive
                    ? `${item.token.title} by ${item.artistName}`
                    : `Go to ${item.token.title}`
                }
                onClick={() => {
                  if (pointer.current?.moved) return;
                  if (isActive) {
                    window.location.assign(`/token/${item.token.id}`);
                  } else {
                    go(i);
                  }
                }}
                className={cn(
                  "preserve-3d backface-hidden absolute inset-0 origin-center rounded-[10px] outline-none",
                  !dragging && "transition-[transform,opacity] duration-[460ms] ease-[var(--ease-perpetual)]",
                  isActive ? "z-30" : "z-10",
                )}
                style={{
                  transform: `translateX(${translateX}%) translateZ(${translateZ}px) rotateY(${rotateY}deg) scale(${scale})`,
                  opacity,
                  pointerEvents: hidden ? "none" : "auto",
                  willChange: dragging ? "transform, opacity" : undefined,
                  zIndex: 100 - Math.round(clampedAbs * 10),
                }}
              >
                {/* Artwork with hairline frame */}
                <div
                  className={cn(
                    "preserve-3d relative h-full w-full overflow-hidden rounded-[10px] border bg-surface",
                    isActive ? "border-border-bright" : "border-border",
                  )}
                  style={{ filter: `brightness(${brightness})` }}
                >
                  <GenerativeArt
                    seed={item.token.artSeed}
                    genre={item.token.genre}
                    className="h-full w-full"
                  />
                  {/* Inner hairline for the framed-print feel */}
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 rounded-[10px] ring-1 ring-inset ring-white/5"
                  />
                  {/* Active slide earns a faint accent edge */}
                  {isActive && (
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-0 rounded-[10px] ring-1 ring-inset ring-accent/30"
                    />
                  )}
                </div>

                {/* Floor reflection - the luxurious coverflow signature */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute left-0 top-full h-[55%] w-full overflow-hidden rounded-[10px]"
                  style={{
                    transform: "scaleY(-1)",
                    WebkitMaskImage: "linear-gradient(to bottom, rgba(0,0,0,0.32), transparent 72%)",
                    maskImage: "linear-gradient(to bottom, rgba(0,0,0,0.32), transparent 72%)",
                    opacity: opacity * 0.6,
                  }}
                >
                  <GenerativeArt
                    seed={item.token.artSeed}
                    genre={item.token.genre}
                    className="h-full w-full"
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Caption for the active slide - links to its token. */}
      <div className="mt-5 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={prev}
          disabled={Math.round(active) <= 0}
          aria-label="Previous drop"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border text-muted transition-colors hover:border-border-bright hover:text-foreground focus-visible:border-accent focus-visible:text-foreground disabled:pointer-events-none disabled:opacity-30"
        >
          <Chevron dir="left" />
        </button>

        {activeItem && (
          <Link
            href={`/token/${activeItem.token.id}`}
            className="group min-w-0 flex-1 text-center transition-opacity hover:opacity-90 focus-visible:opacity-90"
          >
            <SlideCaption token={activeItem.token} artistName={activeItem.artistName} />
          </Link>
        )}

        <button
          type="button"
          onClick={next}
          disabled={Math.round(active) >= count - 1}
          aria-label="Next drop"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border text-muted transition-colors hover:border-border-bright hover:text-foreground focus-visible:border-accent focus-visible:text-foreground disabled:pointer-events-none disabled:opacity-30"
        >
          <Chevron dir="right" />
        </button>
      </div>

      <Dots count={count} active={clamp(Math.round(active))} onDot={go} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Caption: title (brand), artist (sans), price (mono).
// ---------------------------------------------------------------------------

function SlideCaption({
  token,
  artistName,
  compact = false,
}: {
  token: Token;
  artistName: string;
  compact?: boolean;
}) {
  // Prefer the live listing price; otherwise fall back to the best standing offer.
  const bestOffer = token.offers.reduce((max, o) => Math.max(max, o.priceEth), 0);
  const price = token.listing?.priceEth ?? bestOffer;
  return (
    <div className={cn("min-w-0", compact ? "px-3 py-3 text-left" : "")}>
      <div className={cn("truncate font-brand font-semibold tracking-[-0.01em] text-foreground", compact ? "text-sm" : "text-base sm:text-lg")}>
        {token.title}
      </div>
      <div className={cn("mt-0.5 flex items-center gap-2 truncate text-[13px] text-muted", compact ? "justify-start" : "justify-center")}>
        <span className="truncate">{artistName}</span>
      </div>
      <div className={cn("mt-1.5 flex items-center gap-1.5", compact ? "justify-start" : "justify-center")}>
        <MonoLabel className="text-faint">{token.listing ? "List" : bestOffer > 0 ? "Top offer" : "Floor"}</MonoLabel>
        <span className="font-mono text-sm tabular-nums text-foreground">
          {formatEth(price)} <span className="text-faint">{getChainMeta(token.chain).currency}</span>
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dot indicator. Active dot = accent.
// ---------------------------------------------------------------------------

function Dots({
  count,
  active,
  onDot,
}: {
  count: number;
  active: number;
  onDot: (i: number) => void;
}) {
  return (
    <div className="mt-4 flex items-center justify-center gap-2" role="tablist" aria-label="Select drop">
      {Array.from({ length: count }).map((_, i) => {
        const isActive = i === active;
        return (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-label={`Drop ${i + 1} of ${count}`}
            onClick={() => onDot(i)}
            className={cn(
              "h-1.5 rounded-full transition-all duration-300 ease-[var(--ease-perpetual)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              isActive ? "w-6 bg-accent" : "w-1.5 bg-border-bright hover:bg-muted",
            )}
          />
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chevron glyph.
// ---------------------------------------------------------------------------

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden>
      {dir === "left" ? (
        <path d="M10 3.5L5.5 8l4.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="M6 3.5L10.5 8 6 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

export default Coverflow3D;
