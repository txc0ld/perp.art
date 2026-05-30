"use client";

/**
 * SortSelect - the shared profile sort control, passed as the `action` slot of the
 * shared SectionHeader across Collected / Created / Activity tabs. Mono, pill-shaped,
 * accessible label, >=44px tap target.
 */
import { cn } from "@/lib/utils";

export function SortSelect<T extends string>({
  value,
  onChange,
  options,
  label = "Sort",
  className,
}: {
  value: T;
  onChange: (next: T) => void;
  options: ReadonlyArray<{ key: T; label: string }>;
  label?: string;
  className?: string;
}) {
  return (
    <label className={cn("relative inline-flex items-center", className)}>
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="h-11 appearance-none rounded-[8px] border border-border bg-surface py-1.5 pl-3.5 pr-9 font-mono text-[12px] text-muted transition-colors hover:border-border-bright hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
      >
        {options.map((o) => (
          <option key={o.key} value={o.key} className="bg-surface text-foreground">
            {o.label}
          </option>
        ))}
      </select>
      <svg
        viewBox="0 0 16 16"
        className="pointer-events-none absolute right-3 h-3 w-3 text-faint"
        fill="none"
        aria-hidden
      >
        <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </label>
  );
}
