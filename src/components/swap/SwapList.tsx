"use client";

/**
 * SwapList - a heading + grid of SwapCards with a calm empty state. "use client"
 * so each card's optimistic action state works. Receives swaps + variant as props.
 */
import type { SwapOrder } from "@/lib/types";
import { SwapCard, type SwapVariant } from "./SwapCard";
import { MonoLabel } from "@/components/ui";
import { cn } from "@/lib/utils";

export function SwapList({
  swaps,
  variant,
  heading,
  count,
  emptyTitle = "No swaps here yet",
  emptyBody,
  action,
  className,
}: {
  swaps: SwapOrder[];
  variant: SwapVariant;
  heading?: string;
  /** Override the count shown next to the heading (defaults to swaps.length). */
  count?: number;
  emptyTitle?: string;
  emptyBody?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {heading && (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <MonoLabel className="text-muted">{heading}</MonoLabel>
            <span className="rounded-full bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-faint">
              {count ?? swaps.length}
            </span>
          </div>
          {action}
        </div>
      )}

      {swaps.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[10px] border border-dashed border-border bg-surface/40 px-6 py-12 text-center">
          <p className="text-[15px] font-medium text-foreground">{emptyTitle}</p>
          {emptyBody && <p className="mt-2 max-w-sm text-[13px] leading-relaxed text-muted">{emptyBody}</p>}
          {action && <div className="mt-5">{action}</div>}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {swaps.map((s) => (
            <SwapCard key={s.id} swap={s} variant={variant} />
          ))}
        </div>
      )}
    </div>
  );
}
