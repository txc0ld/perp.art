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
  const baseId = React.useId();
  const tabId = (key: string) => `${baseId}-tab-${key}`;
  const panelId = (key: string) => `${baseId}-panel-${key}`;

  // Roving arrow-key navigation between tabs (WAI-ARIA tabs pattern).
  function onKeyDown(e: React.KeyboardEvent) {
    const i = tabs.findIndex((t) => t.key === active);
    if (i < 0) return;
    let next = i;
    if (e.key === "ArrowRight") next = (i + 1) % tabs.length;
    else if (e.key === "ArrowLeft") next = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    else return;
    e.preventDefault();
    const key = tabs[next].key;
    setActive(key);
    document.getElementById(tabId(key))?.focus();
  }

  return (
    <div>
      <div
        role="tablist"
        aria-label="Offers and activity"
        onKeyDown={onKeyDown}
        className="flex items-center gap-6 border-b border-border"
      >
        {tabs.map((t) => {
          const on = t.key === active;
          return (
            <button
              key={t.key}
              id={tabId(t.key)}
              role="tab"
              type="button"
              aria-selected={on}
              aria-controls={panelId(t.key)}
              tabIndex={on ? 0 : -1}
              onClick={() => setActive(t.key)}
              className={cn(
                "-mb-px flex min-h-[44px] items-center gap-2 border-b-2 pb-4 pt-1 transition-colors",
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
      {current && (
        <div
          role="tabpanel"
          id={panelId(current.key)}
          aria-labelledby={tabId(current.key)}
          tabIndex={0}
          className="mt-8 focus-visible:outline-none"
        >
          {current.panel}
        </div>
      )}
    </div>
  );
}
