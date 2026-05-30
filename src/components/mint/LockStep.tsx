"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { MonoLabel } from "@/components/ui";
import type { MintForm } from "./state";

export function LockStep({
  form,
  set,
}: {
  form: MintForm;
  set: (patch: Partial<MintForm>) => void;
}) {
  const locked = form.lockShards;

  return (
    <div className="space-y-6">
      <p className="max-w-[64ch] text-sm leading-relaxed text-muted">
        Locking permanently freezes the storage shards for this work. No one - not
        you, not Perpetual, not any future operator - can alter, replace, or remove the
        underlying art once it is locked.
      </p>

      {/* The prominent toggle */}
      <button
        type="button"
        role="switch"
        aria-checked={locked}
        onClick={() => set({ lockShards: !locked })}
        className={cn(
          "flex w-full items-center justify-between gap-5 rounded-[8px] border p-6 text-left transition-all duration-300",
          locked
            ? "border-accent/30 bg-accent/[0.04]"
            : "border-border bg-surface-2/40 hover:border-border-bright",
        )}
      >
        <div className="flex items-start gap-4">
          <span
            className={cn(
              "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-colors",
              locked ? "border-accent/40 text-accent" : "border-border text-muted",
            )}
          >
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" aria-hidden>
              {locked ? (
                <>
                  <rect x="4.5" y="9" width="11" height="7.5" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
                  <path d="M7 9V6.5a3 3 0 016 0V9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </>
              ) : (
                <>
                  <rect x="4.5" y="9" width="11" height="7.5" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
                  <path d="M7 9V6.5a3 3 0 015.6-1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </>
              )}
            </svg>
          </span>
          <div>
            <h3 className="text-[15px] font-medium text-foreground">
              Lock shards for guaranteed immutability
            </h3>
            <p className="mt-1.5 max-w-[52ch] text-[13px] leading-relaxed text-muted">
              Surfaced on the token as a permanent trust signal -{" "}
              <span className="font-mono text-foreground">Shards locked · immutable</span>{" "}
              - proving to every future collector that the work can never change.
            </p>
          </div>
        </div>

        {/* switch visual */}
        <span
          className={cn(
            "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors duration-200",
            locked ? "border-accent/40 bg-accent/20" : "border-border bg-surface-2",
          )}
        >
          <span
            className={cn(
              "inline-block h-4 w-4 rounded-full transition-transform duration-200",
              locked ? "translate-x-[22px] bg-accent" : "translate-x-[3px] bg-muted",
            )}
          />
        </span>
      </button>

      {/* Consequence note */}
      <div className="flex items-start gap-3 rounded-[8px] border border-border bg-transparent px-5 py-4">
        <svg viewBox="0 0 16 16" className="mt-0.5 h-4 w-4 shrink-0 text-faint" fill="none" aria-hidden>
          <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3" />
          <path d="M8 7.2v4M8 4.8v.01" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        <div className="space-y-1">
          <MonoLabel className="text-foreground">Permanent decision</MonoLabel>
          <p className="text-[13px] leading-relaxed text-muted">
            {locked
              ? "This work will be sealed at mint. Immutability is forever and cannot be undone."
              : "Leaving shards unlocked lets you re-pin or migrate storage later, but the work won’t carry the immutability trust signal."}
          </p>
        </div>
      </div>
    </div>
  );
}
