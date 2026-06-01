import type { Chain } from "@/lib/types";
import { getChainMeta } from "@/lib/chains";
import { cn } from "@/lib/utils";

/** Compact chain identity pill with the chain's swatch. */
export function ChainBadge({ chain, className }: { chain: Chain; className?: string }) {
  const meta = getChainMeta(chain);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted",
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.color }} aria-hidden />
      {meta.short}
    </span>
  );
}
