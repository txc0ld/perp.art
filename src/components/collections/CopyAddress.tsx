"use client";

import * as React from "react";
import { shortAddress } from "@/lib/utils";

/** Mono contract address with a copy affordance. Falls back gracefully if clipboard is unavailable. */
export function CopyAddress({ address, label = "Contract" }: { address: string; label?: string }) {
  const [copied, setCopied] = React.useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard unavailable - non-fatal */
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      title={address}
      className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 transition-colors hover:border-border-bright"
    >
      <span className="font-mono text-[9px] uppercase tracking-wider text-faint">{label}</span>
      <span className="font-mono text-xs tabular-nums text-foreground">{shortAddress(address)}</span>
      {copied ? (
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-accent" fill="none" aria-label="copied">
          <path d="M3.5 8.5l3 3 6-6.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-muted" fill="none" aria-label="copy">
          <rect x="5" y="5" width="8" height="8" rx="1.4" stroke="currentColor" strokeWidth="1.3" />
          <path d="M3 11V3.5A1.5 1.5 0 014.5 2H11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      )}
    </button>
  );
}
