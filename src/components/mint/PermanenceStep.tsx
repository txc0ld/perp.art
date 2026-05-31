"use client";

import * as React from "react";
import type { ShardBackend, ShardOption } from "@/lib/types";
import { formatEth } from "@/lib/utils";
import { MonoLabel } from "@/components/ui";
import { ShardCard } from "./ShardCard";
import type { MintForm } from "./state";
import { totalCostEth } from "./state";

export function PermanenceStep({
  form,
  set,
  shardOptions,
}: {
  form: MintForm;
  set: (patch: Partial<MintForm>) => void;
  shardOptions: ShardOption[];
}) {
  const toggle = (backend: ShardBackend) => {
    set({
      enabledShards: {
        ...form.enabledShards,
        [backend]: !form.enabledShards[backend],
      },
    });
  };

  const total = totalCostEth(form, shardOptions);
  const activeCount = shardOptions.filter((o) => form.enabledShards[o.backend]).length;

  return (
    <div className="space-y-6">
      <p className="max-w-[64ch] text-sm leading-relaxed text-muted">
        Your work is written across five parallel shards. The STATE shard
        (SSTORE2) is the consensus-guaranteed backstop — always on. The LOG
        shard holds the high-resolution primary copy via LogLedger. IPFS,
        Arweave, and Irys add redundant permanent copies. Should any individual
        layer fail, the STATE shard holds the work intact.
      </p>

      <div className="grid gap-3.5">
        {shardOptions.map((option, i) => (
          <ShardCard
            key={option.backend}
            option={option}
            index={i}
            enabled={form.enabledShards[option.backend]}
            onToggle={() => toggle(option.backend)}
          />
        ))}
      </div>

      {/* Running total */}
      <div className="flex flex-col gap-4 rounded-[8px] border border-border bg-surface-2/40 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <RedundancyStack count={activeCount} />
          <div>
            <MonoLabel className="text-foreground">
              {activeCount} of {shardOptions.length} backends
            </MonoLabel>
            <p className="mt-0.5 text-[12px] text-faint">
              Each layer adds redundancy. More copies, greater durability.
            </p>
          </div>
        </div>
        <div className="text-left sm:text-right">
          <MonoLabel className="text-faint">Estimated permanence cost</MonoLabel>
          <p className="mt-1 font-mono text-xl tabular-nums text-foreground">
            {total === 0 ? "0.000" : formatEth(total)}{" "}
            <span className="text-sm text-muted">ETH</span>
          </p>
        </div>
      </div>
    </div>
  );
}

/** Stacked redundancy glyph - small layered squares. */
function RedundancyStack({ count }: { count: number }) {
  return (
    <span className="relative inline-flex h-7 w-7 shrink-0" aria-hidden>
      {Array.from({ length: Math.min(count, 4) }).map((_, i) => (
        <span
          key={i}
          className="absolute h-4 w-4 rounded-[3px] border border-accent/40 bg-accent/[0.06]"
          style={{ left: i * 3, top: i * 2 }}
        />
      ))}
    </span>
  );
}
