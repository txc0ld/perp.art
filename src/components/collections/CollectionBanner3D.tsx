"use client";

import * as React from "react";
import { GenerativeArt } from "@/components/art/GenerativeArt";
import type { Genre } from "@/lib/types";

/**
 * CollectionBanner3D - the collection-detail banner with a subtle parallax
 * shift. The art drifts a few pixels against pointer movement and scroll,
 * giving the hero a quiet sense of depth without motion that competes with the
 * work. Transform only, capped to a small range, and fully reduced-motion /
 * coarse-pointer aware (it falls back to a clean static banner).
 */
export function CollectionBanner3D({
  coverSeed,
  genre,
}: {
  coverSeed: string;
  genre: Genre;
}) {
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const artRef = React.useRef<HTMLDivElement>(null);
  const frame = React.useRef<number | null>(null);
  const pointer = React.useRef({ x: 0, y: 0 });
  const [enabled, setEnabled] = React.useState(false);

  React.useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const fine = window.matchMedia?.("(pointer: fine)").matches;
    const t = setTimeout(() => setEnabled(!reduce && !!fine), 0);
    return () => clearTimeout(t);
  }, []);

  const render = React.useCallback(() => {
    const el = artRef.current;
    const wrap = wrapRef.current;
    if (!el || !wrap) return;
    // Scroll parallax: drift as the banner moves through the viewport.
    const rect = wrap.getBoundingClientRect();
    const vh = window.innerHeight || 1;
    const progress = Math.max(-1, Math.min(1, (rect.top + rect.height / 2 - vh / 2) / vh));
    const scrollY = progress * -14; // small, capped
    const px = pointer.current.x * 10;
    const py = pointer.current.y * 8;
    el.style.transform = `scale(1.08) translate3d(${px}px, ${py + scrollY}px, 0)`;
  }, []);

  React.useEffect(() => {
    if (!enabled) return;
    const onScroll = () => {
      if (frame.current) cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(render);
    };
    render();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [enabled, render]);

  function onMove(e: React.PointerEvent) {
    if (!enabled) return;
    const wrap = wrapRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    pointer.current = {
      x: (e.clientX - rect.left) / rect.width - 0.5,
      y: (e.clientY - rect.top) / rect.height - 0.5,
    };
    if (frame.current) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(render);
  }

  function onLeave() {
    if (!enabled) return;
    pointer.current = { x: 0, y: 0 };
    if (frame.current) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(render);
  }

  return (
    <div
      ref={wrapRef}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className="relative h-[200px] overflow-hidden rounded-[10px] border border-border bg-background sm:h-[240px] lg:h-[280px]"
    >
      <div
        ref={artRef}
        className="h-full w-full will-change-transform"
        style={{
          transform: "scale(1.08)",
          transition: "transform 0.45s var(--ease-perpetual)",
        }}
      >
        <GenerativeArt seed={coverSeed} genre={genre} size={1200} className="h-full w-full" />
      </div>
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/80 via-background/10 to-transparent" />
    </div>
  );
}

export default CollectionBanner3D;
