"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { MonoLabel } from "@/components/ui";
import type { MintForm } from "./state";

const QUICK_PICKS = [5, 7.5, 10];
const MAX = 15;

export function RoyaltyStep({
  form,
  set,
}: {
  form: MintForm;
  set: (patch: Partial<MintForm>) => void;
}) {
  const pct = form.royaltyPct;

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
      <div className="space-y-8">
        {/* Big mono value */}
        <div>
          <MonoLabel>Resale royalty · ERC-2981</MonoLabel>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="display-sm font-mono tabular-nums text-foreground sm:text-[clamp(40px,5vw,56px)]">
              {pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(1)}
            </span>
            <span className="font-mono text-2xl text-muted">%</span>
          </div>
        </div>

        {/* Slider */}
        <div className="space-y-4">
          <input
            type="range"
            min={0}
            max={MAX}
            step={0.5}
            value={pct}
            onChange={(e) => set({ royaltyPct: Number(e.target.value) })}
            aria-label="Royalty percentage"
            className={cn(
              "h-[18px] w-full cursor-pointer appearance-none bg-transparent",
              "[&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-[image:var(--track)]",
              "[&::-moz-range-track]:h-1 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-border",
              "[&::-moz-range-progress]:h-1 [&::-moz-range-progress]:rounded-full [&::-moz-range-progress]:bg-accent",
              "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:-mt-[7px] [&::-webkit-slider-thumb]:h-[18px] [&::-webkit-slider-thumb]:w-[18px] [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-accent [&::-webkit-slider-thumb]:bg-background [&::-webkit-slider-thumb]:shadow-[0_0_0_4px_var(--color-accent-faint)] [&::-webkit-slider-thumb]:transition-transform hover:[&::-webkit-slider-thumb]:scale-110",
              "[&::-moz-range-thumb]:h-[18px] [&::-moz-range-thumb]:w-[18px] [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-accent [&::-moz-range-thumb]:bg-background",
              "focus-visible:outline-none",
            )}
            style={{
              // gold-filled track up to the thumb (webkit), fallback border track after
              ["--track" as string]: `linear-gradient(to right, var(--color-accent) 0%, var(--color-accent) ${(pct / MAX) * 100}%, var(--color-border) ${(pct / MAX) * 100}%, var(--color-border) 100%)`,
            }}
          />
          <div className="flex justify-between font-mono text-[10px] text-faint">
            <span>0%</span>
            <span>{MAX}% max</span>
          </div>
        </div>

        {/* Quick picks */}
        <div className="flex flex-wrap items-center gap-2">
          <MonoLabel className="mr-1">Common</MonoLabel>
          {QUICK_PICKS.map((q) => {
            const active = pct === q;
            return (
              <button
                key={q}
                type="button"
                onClick={() => set({ royaltyPct: q })}
                className={cn(
                  "inline-flex min-h-[44px] items-center rounded-full border px-4 font-mono text-[12px] tabular-nums transition-colors duration-200",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
                  active
                    ? "border-accent/40 bg-accent/10 text-accent"
                    : "border-border text-muted hover:border-border-bright hover:text-foreground",
                )}
              >
                {q}%
              </button>
            );
          })}
        </div>
      </div>

      {/* Benefit framing */}
      <div className="rounded-[8px] border border-border bg-surface-2/40 p-6">
        <div className="mb-4 flex items-center gap-2">
          <svg viewBox="0 0 16 16" className="h-4 w-4 text-accent" fill="none" aria-hidden>
            <path d="M3.5 8.5l3 3 6-6.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <MonoLabel className="text-foreground">Enforced at settlement</MonoLabel>
        </div>
        <p className="text-sm leading-relaxed text-muted">
          Here your royalty is not a polite request, it is enforced at the protocol
          level. Every sale settles your share automatically, on every secondary trade,
          for as long as the work exists.
        </p>
        <div className="mt-5 space-y-2.5 border-t border-border pt-5">
          {[
            "Paid on every secondary sale, automatically",
            "Cannot be stripped or bypassed by marketplaces",
            "Travels with the work across wallets and years",
          ].map((line) => (
            <div key={line} className="flex items-start gap-2.5">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" />
              <span className="text-[13px] leading-relaxed text-muted">{line}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
