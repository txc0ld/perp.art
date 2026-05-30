"use client";

import * as React from "react";
import type { ShardOption } from "@/lib/types";
import { cn, formatEth } from "@/lib/utils";
import { GenerativeArt } from "@/components/art/GenerativeArt";
import { MonoLabel, Badge, Divider } from "@/components/ui";
import type { MintForm } from "./state";
import { previewSeed, totalCostEth } from "./state";

function Row({
  label,
  children,
  mono,
}: {
  label: string;
  children: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <MonoLabel className="text-faint">{label}</MonoLabel>
      <span
        className={cn(
          "min-w-0 truncate text-right text-sm text-foreground",
          mono && "font-mono tabular-nums",
        )}
      >
        {children}
      </span>
    </div>
  );
}

export function ReviewStep({
  form,
  shardOptions,
}: {
  form: MintForm;
  shardOptions: ShardOption[];
}) {
  const seed = previewSeed(form);
  const total = totalCostEth(form, shardOptions);
  const selected = shardOptions.filter((o) => form.enabledShards[o.backend]);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
      {/* Live preview */}
      <div className="space-y-3">
        <div className="overflow-hidden rounded-[8px] border border-border-bright">
          <GenerativeArt seed={seed} genre={form.genre} className="aspect-square w-full" />
        </div>
        <div className="flex items-center justify-between">
          <span className="truncate text-sm text-foreground">
            {form.title || "Untitled"}
          </span>
          <Badge tone="muted">{form.genre}</Badge>
        </div>
        <p className="truncate font-mono text-[11px] text-faint">
          {form.artistName || "-"}
        </p>
      </div>

      {/* Summary */}
      <div className="space-y-5">
        <div>
          <MonoLabel>Metadata</MonoLabel>
          <div className="mt-1 divide-y divide-border">
            <Row label="Title">{form.title || "-"}</Row>
            <Row label="Artist">{form.artistName || "-"}</Row>
            <Row label="Media">{form.mediaType}</Row>
            <Row label="Genre">{form.genre}</Row>
            <Row label="Royalty" mono>
              {form.royaltyPct % 1 === 0
                ? form.royaltyPct.toFixed(0)
                : form.royaltyPct.toFixed(1)}
              %
            </Row>
          </div>
        </div>

        <Divider />

        <div>
          <div className="flex items-center justify-between">
            <MonoLabel>Permanence</MonoLabel>
            {form.lockShards ? (
              <Badge tone="accent">Locked · immutable</Badge>
            ) : (
              <Badge tone="muted">Unlocked</Badge>
            )}
          </div>
          <div className="mt-2 divide-y divide-border">
            {selected.map((o) => (
              <div key={o.backend} className="flex items-center justify-between gap-4 py-2.5">
                <span className="flex items-center gap-2">
                  <svg viewBox="0 0 16 16" className={cn("h-3.5 w-3.5", o.mandatory ? "text-accent" : "text-muted")} fill="none" aria-hidden>
                    <path d="M3.5 8.5l3 3 6-6.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="font-mono text-[13px] text-foreground">{o.label}</span>
                </span>
                <span className="font-mono text-[13px] tabular-nums text-muted">
                  {o.estCostEth === 0 ? "included" : `${formatEth(o.estCostEth)} ETH`}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Total */}
        <div className="flex items-center justify-between rounded-[8px] border border-border-bright bg-surface-2/50 px-5 py-4">
          <MonoLabel className="text-foreground">Total estimated cost</MonoLabel>
          <span className="font-mono text-lg tabular-nums text-foreground">
            {total === 0 ? "0.000" : formatEth(total)}{" "}
            <span className="text-sm text-muted">ETH</span>
          </span>
        </div>
      </div>
    </div>
  );
}
