"use client";

import * as React from "react";

/**
 * GridReveal - a tasteful staggered depth reveal for grid items on mount. Each
 * tile fades in, rises, and gently un-rotates on X. Transform + opacity only,
 * stagger is capped so long lists never ripple forever, and under
 * prefers-reduced-motion the final resting state shows immediately (content is
 * usable at once). Wraps ArtTile (which owns its own tilt) without touching it.
 */
export function GridReveal({
  index,
  children,
}: {
  index: number;
  children: React.ReactNode;
}) {
  const [shown, setShown] = React.useState(false);

  React.useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      const rt = setTimeout(() => setShown(true), 0);
      return () => clearTimeout(rt);
    }
    // Cap the stagger so deep grids do not animate for seconds.
    const delay = Math.min(index, 11) * 40;
    const t = window.setTimeout(() => setShown(true), delay);
    return () => window.clearTimeout(t);
  }, [index]);

  return (
    <div
      className="perspective-1000"
      style={{
        transformStyle: "preserve-3d",
        transition:
          "opacity 0.5s var(--ease-perpetual), transform 0.5s var(--ease-perpetual)",
        opacity: shown ? 1 : 0,
        transform: shown
          ? "translateY(0) rotateX(0deg)"
          : "translateY(14px) rotateX(7deg)",
        willChange: shown ? "auto" : "transform, opacity",
      }}
    >
      {children}
    </div>
  );
}

export default GridReveal;
