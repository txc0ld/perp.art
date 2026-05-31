"use client";

/**
 * Accordion - OpenSea-style collapsible detail card (Surface with a toggling header).
 * Used for Traits, About this collection, Details, and the signature Permanence panel.
 * Client component (interactive open/close), content passed in as children from the
 * server page. The header can carry an optional badge (e.g. a verified state).
 */
import * as React from "react";
import { cn } from "@/lib/utils";

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={cn(
        "h-4 w-4 shrink-0 text-muted transition-transform duration-200",
        open && "rotate-180",
      )}
      fill="none"
      aria-hidden
    >
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Accordion({
  title,
  eyebrow,
  icon,
  badge,
  defaultOpen = false,
  bright = false,
  anchorId,
  children,
}: {
  title: string;
  /** Optional mono eyebrow that names the section type for quick scanning. */
  eyebrow?: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  defaultOpen?: boolean;
  /** Use the brighter border to give a card real weight (Permanence). */
  bright?: boolean;
  /** Stable id so an in-page sub-nav can anchor to this section. */
  anchorId?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  const id = React.useId();

  return (
    <section
      id={anchorId}
      className={cn(
        "scroll-mt-24 overflow-hidden rounded-[10px] border bg-surface",
        bright ? "border-border-bright" : "border-border",
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={id}
        className="flex min-h-[56px] w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 sm:px-5"
      >
        {icon && <span className="flex shrink-0 items-center">{icon}</span>}
        <span className="flex min-w-0 flex-col">
          {eyebrow && (
            <span className="font-mono text-[10px] uppercase tracking-wider text-faint">
              {eyebrow}
            </span>
          )}
          <span className="label-mono text-foreground">{title}</span>
        </span>
        {badge && <span className="flex items-center">{badge}</span>}
        <span className="ml-auto flex items-center">
          <Chevron open={open} />
        </span>
      </button>
      {open && (
        <div id={id} className="border-t border-border px-4 py-5 sm:px-5">
          {children}
        </div>
      )}
    </section>
  );
}
