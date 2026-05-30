"use client";

/**
 * ItemActions - OpenSea-style favorite + share icon row beside the title.
 * Purely cosmetic local state (no backend); favorite toggles a filled heart in the
 * accent, share copies the current URL. Hairline icon buttons in the dark theme.
 */
import * as React from "react";
import { cn } from "@/lib/utils";

function IconButton({
  label,
  onClick,
  active = false,
  pressed,
  children,
}: {
  label: string;
  onClick?: () => void;
  active?: boolean;
  /** Toggle state for true on/off controls (favorite). Omit for actions (share). */
  pressed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "flex h-11 w-11 items-center justify-center rounded-[8px] border border-border bg-surface transition-colors",
        "hover:border-border-bright hover:bg-surface-2",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        active ? "text-accent" : "text-muted",
      )}
    >
      {children}
    </button>
  );
}

export function ItemActions() {
  const [faved, setFaved] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  function share() {
    if (typeof window !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href).catch(() => {});
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    }
  }

  return (
    <div className="relative flex items-center gap-2">
      <IconButton
        label={faved ? "Remove from favorites" : "Add to favorites"}
        active={faved}
        pressed={faved}
        onClick={() => setFaved((v) => !v)}
      >
        <svg viewBox="0 0 16 16" className="h-4 w-4" fill={faved ? "currentColor" : "none"} aria-hidden>
          <path
            d="M8 13.5L2.7 8.2a3 3 0 014.2-4.3l1.1 1.1 1.1-1.1a3 3 0 014.2 4.3L8 13.5z"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
        </svg>
      </IconButton>
      <IconButton label="Copy link to this artwork" active={copied} onClick={share}>
        <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden>
          <circle cx="4" cy="8" r="1.8" stroke="currentColor" strokeWidth="1.3" />
          <circle cx="12" cy="4" r="1.8" stroke="currentColor" strokeWidth="1.3" />
          <circle cx="12" cy="12" r="1.8" stroke="currentColor" strokeWidth="1.3" />
          <path d="M5.6 7.1l4.8-2.4M5.6 8.9l4.8 2.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      </IconButton>

      {/* Confirmation: visible toast + polite announcement for assistive tech. */}
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? "Link copied to clipboard" : ""}
      </span>
      {copied && (
        <span
          aria-hidden
          className="animate-fade absolute right-0 top-full mt-2 whitespace-nowrap rounded-[8px] border border-border-bright bg-surface px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-foreground shadow-lg"
        >
          Link copied
        </span>
      )}
    </div>
  );
}
