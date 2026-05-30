"use client";

import { cn } from "@/lib/utils";
import type { Density } from "./filters";

/**
 * Grid density toggle (OpenSea small/large). Two icon buttons in a hairline
 * segmented control; active segment earns the pink accent.
 */
export function DensityToggle({
  value,
  onChange,
}: {
  value: Density;
  onChange: (v: Density) => void;
}) {
  return (
    <div
      className="inline-flex h-9 items-center gap-0.5 rounded-[8px] border border-border bg-surface p-0.5"
      role="group"
      aria-label="Grid density"
    >
      <button
        type="button"
        onClick={() => onChange("comfortable")}
        aria-pressed={value === "comfortable"}
        title="Larger cards"
        className={cn(
          "flex h-7 w-8 items-center justify-center rounded-[6px] transition-colors",
          value === "comfortable" ? "bg-accent/15 text-accent" : "text-muted hover:text-foreground",
        )}
      >
        <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none">
          <rect x="2" y="2" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.3" />
          <rect x="8.5" y="2" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.3" />
          <rect x="2" y="8.5" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.3" />
          <rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.3" />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => onChange("compact")}
        aria-pressed={value === "compact"}
        title="More cards"
        className={cn(
          "flex h-7 w-8 items-center justify-center rounded-[6px] transition-colors",
          value === "compact" ? "bg-accent/15 text-accent" : "text-muted hover:text-foreground",
        )}
      >
        <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none">
          <rect x="2" y="2" width="3.2" height="3.2" rx="0.8" stroke="currentColor" strokeWidth="1.2" />
          <rect x="6.4" y="2" width="3.2" height="3.2" rx="0.8" stroke="currentColor" strokeWidth="1.2" />
          <rect x="10.8" y="2" width="3.2" height="3.2" rx="0.8" stroke="currentColor" strokeWidth="1.2" />
          <rect x="2" y="6.4" width="3.2" height="3.2" rx="0.8" stroke="currentColor" strokeWidth="1.2" />
          <rect x="6.4" y="6.4" width="3.2" height="3.2" rx="0.8" stroke="currentColor" strokeWidth="1.2" />
          <rect x="10.8" y="6.4" width="3.2" height="3.2" rx="0.8" stroke="currentColor" strokeWidth="1.2" />
          <rect x="2" y="10.8" width="3.2" height="3.2" rx="0.8" stroke="currentColor" strokeWidth="1.2" />
          <rect x="6.4" y="10.8" width="3.2" height="3.2" rx="0.8" stroke="currentColor" strokeWidth="1.2" />
          <rect x="10.8" y="10.8" width="3.2" height="3.2" rx="0.8" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      </button>
    </div>
  );
}
