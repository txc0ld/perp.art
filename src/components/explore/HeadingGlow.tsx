"use client";

import * as React from "react";

/**
 * HeadingGlow - a faint accent glow behind the Explore heading that drifts
 * subtly on scroll for a quiet sense of depth. Decorative only (aria-hidden),
 * transform/opacity, and frozen under prefers-reduced-motion. It never touches
 * the heading text, so legibility is untouched.
 */
export function HeadingGlow() {
  const ref = React.useRef<HTMLDivElement>(null);
  const frame = React.useRef<number | null>(null);

  React.useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const el = ref.current;
    if (!el) return;

    const render = () => {
      const y = (window.scrollY || 0) * 0.06; // small, capped by short page travel
      el.style.transform = `translate3d(0, ${Math.min(y, 40)}px, 0)`;
    };
    const onScroll = () => {
      if (frame.current) cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(render);
    };
    render();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute -top-10 left-0 h-40 w-[440px] max-w-full opacity-60 will-change-transform"
      style={{
        background:
          "radial-gradient(55% 70% at 12% 30%, rgba(254,147,237,0.10), transparent 70%)",
      }}
    />
  );
}

export default HeadingGlow;
