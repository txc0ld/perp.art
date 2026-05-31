"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { connectWallet, useWallet } from "@/lib/wallet";

interface Connector {
  name: string;
  /** Short mono descriptor shown on the right. */
  hint: string;
  /** A small generated glyph (no external logos / assets). */
  glyph: (className: string) => React.ReactNode;
}

const CONNECTORS: Connector[] = [
  {
    name: "MetaMask",
    hint: "Browser",
    glyph: (c) => (
      <svg viewBox="0 0 24 24" className={c} fill="none" aria-hidden>
        <path d="M3 5l7 4.5L8.5 6 3 5z" fill="currentColor" opacity="0.9" />
        <path d="M21 5l-7 4.5L15.5 6 21 5z" fill="currentColor" opacity="0.6" />
        <path d="M6 16l2 3 3-1v-2.5L6 16zM18 16l-2 3-3-1v-2.5L18 16z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    name: "Coinbase Wallet",
    hint: "Smart wallet",
    glyph: (c) => (
      <svg viewBox="0 0 24 24" className={c} fill="none" aria-hidden>
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.4" />
        <rect x="9" y="9" width="6" height="6" rx="1.2" fill="currentColor" />
      </svg>
    ),
  },
  {
    name: "WalletConnect",
    hint: "QR · mobile",
    glyph: (c) => (
      <svg viewBox="0 0 24 24" className={c} fill="none" aria-hidden>
        <path d="M6 10c3.3-3.3 8.7-3.3 12 0M8.5 12.5c1.9-1.9 5.1-1.9 7 0M11 15l1 1 1-1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    name: "Rainbow",
    hint: "Mobile",
    glyph: (c) => (
      <svg viewBox="0 0 24 24" className={c} fill="none" aria-hidden>
        <path d="M4 18a14 14 0 0116 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M7 18a7 7 0 0110 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.7" />
        <circle cx="12" cy="18" r="1.2" fill="currentColor" />
      </svg>
    ),
  },
];

/**
 * ConnectorList (design prompt §4.6) - hairline connector rows with a generated
 * glyph each, mono labels, hover brighten. Clicking connects and redirects to
 * the profile. Single clear primary emphasis on the first (recommended) option.
 */
export function ConnectorList() {
  const router = useRouter();
  const { connected } = useWallet();

  // Once a wallet actually connects (via the AppKit modal), continue to the profile.
  useEffect(() => {
    if (connected) router.push("/profile");
  }, [connected, router]);

  return (
    <ul className="flex flex-col gap-2.5" aria-label="Wallet connectors">
      {CONNECTORS.map((conn, i) => {
        const recommended = i === 0;
        return (
          <li key={conn.name}>
            <button
              type="button"
              aria-label={
                recommended ? `Connect with ${conn.name} (recommended)` : `Connect with ${conn.name}`
              }
              onClick={() => connectWallet(conn.name)}
              className={
                "group flex min-h-[44px] w-full items-center gap-3.5 rounded-[8px] border bg-surface px-4 py-3.5 text-left transition-[border-color,box-shadow,transform,opacity] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 " +
                (recommended
                  ? "border-border-bright hover:border-accent/50"
                  : "border-border hover:border-border-bright")
              }
            >
              <span
                className={
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] border border-border transition-colors " +
                  (recommended
                    ? "text-accent group-hover:border-accent/40"
                    : "text-muted group-hover:text-foreground")
                }
              >
                {conn.glyph("h-[18px] w-[18px]")}
              </span>

              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-foreground">{conn.name}</span>
                <span className="block font-mono text-[10px] uppercase tracking-wider text-faint">
                  {conn.hint}
                </span>
              </span>

              {recommended && (
                <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-accent">
                  Recommended
                </span>
              )}

              <svg
                viewBox="0 0 16 16"
                className="h-3.5 w-3.5 shrink-0 text-faint transition-[color,transform] duration-200 group-hover:translate-x-0.5 group-hover:text-foreground"
                fill="none"
                aria-hidden
              >
                <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
