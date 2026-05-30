"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Tilt3D - a tasteful pointer-driven 3D tilt. Wraps content in a perspective
 * context and rotates it toward the cursor with a gentle parallax lift and an
 * optional specular sheen. Restraint is the point: small angles, smooth spring
 * settle, fully disabled under prefers-reduced-motion and on touch/coarse pointers.
 */
export function Tilt3D({
  children,
  className,
  max = 8,
  lift = 16,
  glare = true,
  scale = 1.0,
}: {
  children: React.ReactNode;
  className?: string;
  /** max rotation in degrees */
  max?: number;
  /** translateZ lift in px on hover */
  lift?: number;
  glare?: boolean;
  scale?: number;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const frame = React.useRef<number | null>(null);
  const [enabled, setEnabled] = React.useState(false);

  React.useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const fine = window.matchMedia?.("(pointer: fine)").matches;
    const t = setTimeout(() => setEnabled(!reduce && !!fine), 0);
    return () => clearTimeout(t);
  }, []);

  const apply = React.useCallback(
    (rx: number, ry: number, on: boolean) => {
      const el = ref.current;
      if (!el) return;
      el.style.transform = `perspective(1000px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(${on ? lift : 0}px) scale(${on ? scale : 1})`;
    },
    [lift, scale],
  );

  function onMove(e: React.PointerEvent) {
    if (!enabled) return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    if (frame.current) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      apply(-py * max, px * max, true);
      if (glare) {
        el.style.setProperty("--mx", `${(px + 0.5) * 100}%`);
        el.style.setProperty("--my", `${(py + 0.5) * 100}%`);
      }
    });
  }

  function onLeave() {
    if (!enabled) return;
    if (frame.current) cancelAnimationFrame(frame.current);
    apply(0, 0, false);
  }

  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className={cn("group relative will-change-transform", className)}
      style={{
        transition: "transform 0.5s var(--ease-spring)",
        transformStyle: "preserve-3d",
      }}
    >
      {children}
      {glare && enabled && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{
            background:
              "radial-gradient(420px circle at var(--mx,50%) var(--my,50%), rgba(255,255,255,0.10), rgba(254,147,237,0.06) 35%, transparent 60%)",
            mixBlendMode: "screen",
          }}
        />
      )}
    </div>
  );
}

export default Tilt3D;
