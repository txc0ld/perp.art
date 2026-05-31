"use client";

import * as React from "react";
import type { ShardOption } from "@/lib/types";
import { cn, formatEth } from "@/lib/utils";
import { MonoLabel } from "@/components/ui";

/** Small toggle switch - hairline, accent when on. */
function Toggle({
  on,
  locked,
  onClick,
}: {
  on: boolean;
  locked?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={on ? "Backend enabled" : "Backend disabled"}
      disabled={locked}
      onClick={onClick}
      className={cn(
        "relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[8px]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
        locked ? "cursor-not-allowed" : "cursor-pointer",
      )}
    >
      <span
        className={cn(
          "relative inline-flex h-5 w-9 items-center rounded-full border transition-colors duration-200",
          on ? "border-accent/40 bg-accent/20" : "border-border bg-surface-2",
          locked ? "opacity-90" : "group-hover:border-border-bright",
        )}
      >
        <span
          className={cn(
            "inline-block h-3.5 w-3.5 rounded-full transition-transform duration-200",
            on ? "translate-x-[18px] bg-accent" : "translate-x-[3px] bg-muted",
          )}
        />
      </span>
    </button>
  );
}

function LockGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={cn("h-3.5 w-3.5", className)} fill="none" aria-hidden>
      <rect x="3.5" y="7" width="9" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.3" />
      <path d="M5.5 7V5.2a2.5 2.5 0 015 0V7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export function ShardCard({
  option,
  enabled,
  onToggle,
  index,
}: {
  option: ShardOption;
  enabled: boolean;
  onToggle: () => void;
  /** Layered stack offset index, for the redundancy visual. */
  index: number;
}) {
  const mandatory = option.mandatory;
  const free = option.estCostEth === 0;

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-[8px] border p-5 transition-[border-color,box-shadow,transform,opacity] duration-300",
        mandatory
          ? "border-accent/30 bg-accent/[0.04]"
          : enabled
            ? "border-border-bright bg-surface-2/50"
            : "border-border bg-transparent opacity-70 hover:opacity-100",
      )}
    >
      {/* layered redundancy edge - stacked hairlines at the left */}
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-3 left-0 w-px transition-colors",
          mandatory ? "bg-accent/50" : enabled ? "bg-border-bright" : "bg-border",
        )}
      />
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-5 left-[3px] w-px transition-colors",
          mandatory ? "bg-accent/25" : enabled ? "bg-border" : "bg-transparent",
        )}
      />

      <div className="flex items-start justify-between gap-4 pl-2.5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-faint tabular-nums">
              SHARD {index}
            </span>
            {mandatory ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-accent">
                <LockGlyph className="text-accent" />
                Backstop
              </span>
            ) : enabled ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-muted">
                Redundant
              </span>
            ) : null}
          </div>

          <h3 className="mt-2 flex items-center gap-2 font-mono text-[15px] font-medium text-foreground">
            {option.label}
            {mandatory && (
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-accent" fill="none" aria-label="verified">
                <path d="M3.5 8.5l3 3 6-6.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </h3>

          <p className="mt-1.5 max-w-[42ch] text-[13px] leading-relaxed text-muted">
            {option.blurb}
          </p>

          <div className="mt-3 flex items-center gap-2">
            <MonoLabel className="text-faint">Est. cost</MonoLabel>
            <span className="font-mono text-[13px] tabular-nums text-foreground">
              {free ? "included" : `${formatEth(option.estCostEth)} ETH`}
            </span>
          </div>
        </div>

        {/* toggle / lock */}
        <div className="flex flex-col items-end gap-2">
          {mandatory ? (
            <span
              className="flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-accent"
              title="Always on - the permanent backstop"
            >
              <LockGlyph className="text-accent" />
              Locked on
            </span>
          ) : (
            <Toggle on={enabled} onClick={onToggle} />
          )}
        </div>
      </div>
    </div>
  );
}
