"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { SORT_OPTIONS, type SortKey } from "./filters";

/**
 * Compact sort dropdown. Mono label, hairline border, accent on the active row.
 * Keyboard-accessible; closes on outside click / Escape.
 */
export function SortMenu({ value, onChange }: { value: SortKey; onChange: (v: SortKey) => void }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const current = SORT_OPTIONS.find((o) => o.value === value) ?? SORT_OPTIONS[0];

  React.useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex h-9 items-center gap-2 rounded-[8px] border border-border bg-surface px-3 text-sm text-foreground transition-colors hover:border-border-bright"
      >
        <span className="font-mono text-[10px] uppercase tracking-wider text-faint">Sort</span>
        <span className="text-sm">{current.label}</span>
        <svg viewBox="0 0 16 16" className={cn("h-3.5 w-3.5 text-muted transition-transform", open && "rotate-180")} fill="none">
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <ul
          role="listbox"
          className="animate-fade absolute right-0 z-30 mt-2 w-56 overflow-hidden rounded-[8px] border border-border bg-surface p-1 shadow-2xl shadow-black/60"
        >
          {SORT_OPTIONS.map((o) => {
            const active = o.value === value;
            return (
              <li key={o.value} role="option" aria-selected={active}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-[6px] px-3 py-2 text-left text-sm transition-colors",
                    active ? "bg-accent/10 text-accent" : "text-foreground hover:bg-surface-2",
                  )}
                >
                  {o.label}
                  {active && (
                    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none">
                      <path d="M3.5 8.5l3 3 6-6.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
