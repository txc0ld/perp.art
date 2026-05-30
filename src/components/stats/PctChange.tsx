import { cn } from "@/lib/utils";

/**
 * Signed percentage change with directional glyph.
 * Positive uses verify green, negative uses rose. Mono, tabular.
 */
export function PctChange({ value, className }: { value: number; className?: string }) {
  const positive = value >= 0;
  return (
    <span
      className={cn(
        "inline-flex items-center justify-end gap-1 font-mono text-[13px] tabular-nums",
        positive ? "text-verify" : "text-[#fda4af]",
        className,
      )}
    >
      <span aria-hidden className="text-[9px] leading-none">{positive ? "▲" : "▼"}</span>
      {positive ? "+" : ""}{value.toFixed(1)}%
    </span>
  );
}
