"use client";

/**
 * VerificationFlow - an animated diagram of the read-only, independently
 * reproducible verification service (PRD §9.4): resolve → hash → compare →
 * status. The stages light up in a slow, restrained stagger when the visual
 * scrolls into view, then settle on a verified state.
 *
 * Honest framing: this is the same sequence anyone can run against public data.
 * Respects prefers-reduced-motion (renders all stages already verified, no run).
 */
import * as React from "react";
import { StatusGlyph } from "@/components/ui";
import { cn } from "@/lib/utils";

type StageState = "idle" | "active" | "done";

const STAGES: Array<{
  key: string;
  label: string;
  plain: string;
  detail: string;
}> = [
  {
    key: "resolve",
    label: "Resolve",
    plain: "Fetch the bytes from every shard.",
    detail: "GET onchain · ipfs · arweave · irys",
  },
  {
    key: "hash",
    label: "Hash",
    plain: "Hash the content that came back.",
    detail: "keccak256(content) → 0x…",
  },
  {
    key: "compare",
    label: "Compare",
    plain: "Check it against the onchain record.",
    detail: "getMintData(tokenId).metadataHash",
  },
  {
    key: "status",
    label: "Status",
    plain: "Report a verifiable result.",
    detail: "match → permanence integrity 100%",
  },
];

export function VerificationFlow() {
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  // Each stage advances idle → active → done.
  const [states, setStates] = React.useState<StageState[]>(
    () => STAGES.map(() => "idle"),
  );

  React.useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const prefersReduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReduced) {
      // Skip the animation: show the completed, verified state immediately.
      // Deferred to a callback to avoid a synchronous setState in the effect body.
      const t = setTimeout(() => setStates(STAGES.map(() => "done")), 0);
      return () => clearTimeout(t);
    }

    let timers: ReturnType<typeof setTimeout>[] = [];
    let hasRun = false;

    function run() {
      if (hasRun) return;
      hasRun = true;
      STAGES.forEach((_, i) => {
        // Each stage becomes active, then resolves to done a beat later.
        timers.push(
          setTimeout(() => {
            setStates((prev) => {
              const next = [...prev];
              next[i] = "active";
              return next;
            });
          }, 350 + i * 620),
        );
        timers.push(
          setTimeout(() => {
            setStates((prev) => {
              const next = [...prev];
              next[i] = "done";
              return next;
            });
          }, 350 + i * 620 + 460),
        );
      });
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          run();
          observer.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    observer.observe(root);

    return () => {
      observer.disconnect();
      timers.forEach(clearTimeout);
      timers = [];
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      aria-label="Verification flow: resolve, hash, compare, status"
    >
      {STAGES.map((stage, i) => {
        const state = states[i];
        const active = state === "active";
        const done = state === "done";
        return (
          <div
            key={stage.key}
            className={cn(
              "relative rounded-[8px] border bg-surface px-4 py-4 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
              done
                ? "border-accent/40"
                : active
                  ? "border-border-bright"
                  : "border-border opacity-60",
            )}
          >
            {/* connector arrow to the next stage (desktop only) */}
            {i < STAGES.length - 1 ? (
              <span
                aria-hidden
                className={cn(
                  "absolute right-[-10px] top-1/2 z-10 hidden -translate-y-1/2 font-mono text-xs lg:block",
                  done ? "text-accent" : "text-faint",
                )}
              >
                →
              </span>
            ) : null}

            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[10px] uppercase tracking-wider text-faint">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span aria-hidden>
                {done ? (
                  <StatusGlyph status="verified" />
                ) : active ? (
                  <StatusGlyph status="resolving" />
                ) : (
                  <StatusGlyph status="not-configured" />
                )}
              </span>
            </div>

            <p
              className={cn(
                "mt-2 text-sm font-medium transition-colors",
                done ? "text-foreground" : active ? "text-foreground" : "text-muted",
              )}
            >
              {stage.label}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted">{stage.plain}</p>
            <p
              className={cn(
                "mt-3 font-mono text-[10px] tracking-tight transition-colors",
                done ? "text-accent/80" : "text-faint",
              )}
            >
              {stage.detail}
            </p>
          </div>
        );
      })}
    </div>
  );
}

export default VerificationFlow;
