import { cn } from "@/lib/utils";

/**
 * Perpetual brand mark "fixed point": an unbroken ring with a single accent
 * point at center. The ring inherits currentColor; the dot is the signature pink.
 * Source of truth: public/perpetual_logo.html identity kit.
 */
export function BrandMark({
  size = 28,
  className,
  strokeWidth = 3.6,
}: {
  size?: number;
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      className={className}
      aria-hidden
    >
      <circle cx="50" cy="50" r="32" stroke="currentColor" strokeWidth={strokeWidth} />
      <circle cx="50" cy="50" r="5" fill="var(--color-accent)" />
    </svg>
  );
}

/**
 * Full lockup: mark + "perpetual" (brand display face) + accent dot + "art" (mono).
 */
export function Wordmark({
  markSize = 26,
  className,
  showMark = true,
}: {
  markSize?: number;
  className?: string;
  showMark?: boolean;
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      {showMark && <BrandMark size={markSize} className="text-foreground shrink-0" />}
      <span className="font-brand text-[18px] font-semibold leading-none tracking-[-0.035em] text-foreground">
        perpetual
        <span className="text-accent">.</span>
        <span className="font-mono text-[13px] font-medium tracking-tight text-muted">art</span>
      </span>
    </span>
  );
}
