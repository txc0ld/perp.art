"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Reveal3D - a restrained scroll-driven depth reveal. As the wrapped section
 * enters the viewport it fades in, rises a few pixels, and gently un-rotates on
 * the X axis so the page assembles with a soft sense of depth. Transform +
 * opacity only, GPU friendly, and fully reduced-motion aware: under
 * prefers-reduced-motion (or before hydration) the final, resting state shows
 * immediately so content is never delayed or obscured.
 *
 * Gallery, not arcade: small angle (~6deg), short rise, ease-out, ~560ms.
 */
export function Reveal3D({
  children,
  className,
  delay = 0,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  className?: string;
  /** stagger delay in ms (capped by caller) */
  delay?: number;
  as?: React.ElementType;
}) {
  const ref = React.useRef<HTMLElement | null>(null);
  const [shown, setShown] = React.useState(false);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce || typeof IntersectionObserver === "undefined") {
      const t = setTimeout(() => setShown(true), 0);
      return () => clearTimeout(t);
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true);
            io.disconnect();
            break;
          }
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.08 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      className={cn("perspective-1000", className)}
      style={{
        transformStyle: "preserve-3d",
        transition:
          "opacity 0.56s var(--ease-perpetual), transform 0.56s var(--ease-perpetual)",
        transitionDelay: shown ? `${delay}ms` : "0ms",
        opacity: shown ? 1 : 0,
        transform: shown
          ? "translateY(0) rotateX(0deg)"
          : "translateY(18px) rotateX(6deg)",
        willChange: shown ? "auto" : "transform, opacity",
      }}
    >
      {children}
    </Tag>
  );
}

export default Reveal3D;
