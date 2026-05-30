"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { STEPS, type StepKey } from "./state";

/**
 * Calm progress stepper - mono step labels, accent on the current node.
 * Completed nodes carry a hairline check; future nodes are faint.
 */
export function Stepper({
  current,
  furthest,
  onJump,
}: {
  current: number;
  /** Highest step index the user has reached (can revisit). */
  furthest: number;
  onJump: (index: number) => void;
}) {
  return (
    <nav aria-label="Mint progress" className="w-full">
      <ol className="flex items-center">
        {STEPS.map((step, i) => {
          const state: "done" | "current" | "todo" =
            i < current ? "done" : i === current ? "current" : "todo";
          const reachable = i <= furthest;
          return (
            <li key={step.key} className="flex flex-1 items-center last:flex-none">
              <button
                type="button"
                disabled={!reachable}
                onClick={() => reachable && onJump(i)}
                aria-current={state === "current" ? "step" : undefined}
                className={cn(
                  "group flex items-center gap-2.5 rounded-full pr-1 text-left transition-colors",
                  reachable ? "cursor-pointer" : "cursor-default",
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border font-mono text-[11px] font-semibold tabular-nums transition-all duration-200",
                    state === "current" &&
                      "border-accent bg-accent/10 text-accent shadow-[0_0_0_3px_var(--color-accent-faint)]",
                    state === "done" &&
                      "border-border-bright bg-surface-2 text-foreground group-hover:border-accent/50",
                    state === "todo" && "border-border bg-transparent text-faint",
                  )}
                >
                  {state === "done" ? (
                    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden>
                      <path
                        d="M3.5 8.5l3 3 6-6.5"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    String(i + 1).padStart(2, "0")
                  )}
                </span>
                <span
                  className={cn(
                    "hidden font-mono text-[11px] font-semibold uppercase tracking-wider sm:inline",
                    state === "current" && "text-accent",
                    state === "done" && "text-muted group-hover:text-foreground",
                    state === "todo" && "text-faint",
                  )}
                >
                  {step.label}
                </span>
              </button>

              {i < STEPS.length - 1 && (
                <span
                  aria-hidden
                  className={cn(
                    "mx-2 h-px flex-1 transition-colors duration-300 sm:mx-3",
                    i < current ? "bg-border-bright" : "bg-border",
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export { STEPS };
export type { StepKey };
