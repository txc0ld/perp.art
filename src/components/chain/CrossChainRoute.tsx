import type { Chain } from "@/lib/types";
import { getChainMeta } from "@/lib/chains";
import { cn } from "@/lib/utils";

/**
 * Cross-chain settlement route: chain A locks, the escrow bridge proves and
 * releases on chain B, atomic with rollback. Used when a trade spans chains.
 */
export function CrossChainRoute({
  from,
  to,
  className,
}: {
  from: Chain;
  to: Chain;
  className?: string;
}) {
  const a = getChainMeta(from);
  const b = getChainMeta(to);
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <Node color={a.color} label={a.short} sub="locks" />
      <div className="relative flex-1">
        <div className="h-px w-full bg-gradient-to-r from-border via-border-bright to-border" />
        <span
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-accent/40 bg-background px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-accent"
        >
          Escrow bridge
        </span>
      </div>
      <Node color={b.color} label={b.short} sub="releases" alignRight />
    </div>
  );
}

function Node({
  color,
  label,
  sub,
  alignRight,
}: {
  color: string;
  label: string;
  sub: string;
  alignRight?: boolean;
}) {
  return (
    <div className={cn("flex shrink-0 flex-col gap-1", alignRight && "items-end text-right")}>
      <span className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full" style={{ background: color }} aria-hidden />
        <span className="text-sm font-medium text-foreground">{label}</span>
      </span>
      <span className="font-mono text-[10px] uppercase tracking-wider text-faint">{sub}</span>
    </div>
  );
}
