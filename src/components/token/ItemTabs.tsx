"use client";

/**
 * ItemTabs - OpenSea-style tabbed section for the full-width detail area.
 * Tabs render along a hairline rail (the active tab earns an accent underline);
 * panels are passed in as children from the server page, so no data fetching here.
 */
import * as React from "react";
import { cn } from "@/lib/utils";

export interface TabDef {
  key: string;
  label: string;
  /** Optional mono count shown next to the label (e.g. number of offers). */
  count?: number;
  panel: React.ReactNode;
}

export function ItemTabs({ tabs }: { tabs: TabDef[] }) {
  const [active, setActive] = React.useState(tabs[0]?.key);
  const current = tabs.find((t) => t.key === active) ?? tabs[0];

  return (
    <div>
      <div role="tablist" className="flex items-center gap-6 border-b border-border">
        {tabs.map((t) => {
          const on = t.key === active;
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={on}
              onClick={() => setActive(t.key)}
              className={cn(
                "-mb-px flex items-center gap-2 border-b-2 pb-4 pt-1 transition-colors",
                on ? "border-accent" : "border-transparent",
              )}
            >
              <span
                className={cn(
                  "label-mono transition-colors",
                  on ? "text-foreground" : "text-muted hover:text-foreground",
                )}
              >
                {t.label}
              </span>
              {typeof t.count === "number" && (
                <span
                  className={cn(
                    "font-mono text-[11px] tabular-nums",
                    on ? "text-accent" : "text-faint",
                  )}
                >
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" className="mt-8">
        {current?.panel}
      </div>
    </div>
  );
}
