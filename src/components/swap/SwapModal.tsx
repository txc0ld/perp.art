"use client";

/**
 * SwapModal — the "propose a swap" surface. The swaps mechanism (NFT-for-NFT
 * barter with optional ETH balancing and cross-chain atomic settlement) is in
 * build and not yet live, so this presents an honest coming-soon panel inside the
 * standard modal shell rather than a fabricated composer. It keeps the modal
 * mechanics (scrim, role=dialog/aria-modal, Esc, focus management, scroll lock)
 * so the entry points (token page, BuyPanel) stay wired for when swaps ship.
 */
import * as React from "react";
import Link from "next/link";
import type { Token } from "@/lib/types";
import { Button, MonoLabel } from "@/components/ui";

export type SwapMode = "specific" | "criteria";

export function SwapModal({
  token,
  defaultMode: _defaultMode,
  onClose,
}: {
  /** Optional target token. Retained for when the composer returns. */
  token?: Token;
  defaultMode?: SwapMode;
  onClose: () => void;
}) {
  const dialogRef = React.useRef<HTMLDivElement | null>(null);

  // Focus management + Esc + focus trap + scroll lock (mirrors BuyModal).
  React.useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const autofocus = dialogRef.current?.querySelector<HTMLElement>("[data-autofocus]");
    if (autofocus) {
      autofocus.focus();
    } else {
      dialogRef.current?.focus();
    }
    return () => opener?.focus?.();
  }, []);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "Tab" && dialogRef.current) {
        const f = dialogRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])',
        );
        if (f.length === 0) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 bg-background/85 backdrop-blur-sm animate-fade" aria-hidden />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Swaps coming soon"
        tabIndex={-1}
        className="animate-rise relative flex max-h-[92dvh] w-full max-w-[520px] flex-col overflow-hidden rounded-t-[12px] border border-border-bright bg-surface shadow-2xl sm:max-h-[90dvh] sm:rounded-[10px] outline-none"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
          <MonoLabel className="text-foreground">Swaps</MonoLabel>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-[8px] text-faint transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            aria-label="Close"
          >
            <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Body — honest coming-soon, no fabricated composer */}
        <div className="overflow-y-auto px-5 py-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-border-bright">
            <svg viewBox="0 0 20 20" className="h-5 w-5 text-accent" fill="none" aria-hidden>
              <path d="M5 7h10l-2.5-2.5M15 13H5l2.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <p className="mt-5 text-[15px] font-medium text-foreground">Swaps are coming soon</p>
          <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-muted">
            {token ? "Bartering for this work — " : ""}NFT-for-NFT trades with optional ETH
            balancing and cross-chain atomic settlement are in build, not yet live. We won&rsquo;t
            show fabricated orders in the meantime.
          </p>
          <div className="mt-7 flex flex-col gap-2.5">
            <Link
              href="/swaps"
              data-autofocus
              className="inline-flex h-12 w-full items-center justify-center rounded-[8px] bg-accent px-6 text-[15px] font-medium text-background transition-colors hover:bg-accent-dim focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            >
              About swaps
            </Link>
            <Button variant="secondary" className="w-full" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
