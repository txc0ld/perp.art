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
  children,
}: {
  label: string;
  onClick?: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-[8px] border border-border bg-surface transition-colors",
        "hover:border-border-bright hover:bg-surface-2",
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
    <div className="flex items-center gap-2">
      <IconButton label="Add to favorites" active={faved} onClick={() => setFaved((v) => !v)}>
        <svg viewBox="0 0 16 16" className="h-4 w-4" fill={faved ? "currentColor" : "none"}>
          <path
            d="M8 13.5L2.7 8.2a3 3 0 014.2-4.3l1.1 1.1 1.1-1.1a3 3 0 014.2 4.3L8 13.5z"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
        </svg>
      </IconButton>
      <IconButton label={copied ? "Link copied" : "Share"} active={copied} onClick={share}>
        <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none">
          <circle cx="4" cy="8" r="1.8" stroke="currentColor" strokeWidth="1.3" />
          <circle cx="12" cy="4" r="1.8" stroke="currentColor" strokeWidth="1.3" />
          <circle cx="12" cy="12" r="1.8" stroke="currentColor" strokeWidth="1.3" />
          <path d="M5.6 7.1l4.8-2.4M5.6 8.9l4.8 2.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      </IconButton>
    </div>
  );
}
