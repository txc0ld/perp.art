"use client";

/**
 * Reveal - scroll-triggered fade + rise wrapper (design prompt §6).
 * Children mount invisible and translated, then rise into place once the
 * element enters the viewport. Honors prefers-reduced-motion by revealing
 * immediately. Keep this the only interactive bit; sections stay server.
 */
import * as React from "react";
import { cn } from "@/lib/utils";

export function Reveal({
  children,
  className,
  delay = 0,
  as: As = "div",
}: {
  children: React.ReactNode;
  className?: string;
  /** entrance delay in ms, for staggering siblings */
  delay?: number;
  as?: React.ElementType;
}) {
  const ref = React.useRef<HTMLElement | null>(null);
  const [shown, setShown] = React.useState(false);

  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // Reduced motion: reveal instantly, skip the observer. Deferred to a
    // callback to avoid a synchronous setState in the effect body.
    if (
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
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
      { rootMargin: "0px 0px -12% 0px", threshold: 0.05 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

  return (
    <As
      ref={ref}
      className={cn(
        "transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
        shown ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
        className,
      )}
      style={{ transitionDelay: shown ? `${delay}ms` : "0ms" }}
    >
      {children}
    </As>
  );
}

export default Reveal;
