"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { connectWallet } from "@/lib/wallet";

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
  const [pending, setPending] = useState<string | null>(null);

  function handleConnect(name: string) {
    setPending(name);
    connectWallet(name);
    // Brief settle so the signing-intent feels deliberate, then route to profile.
    setTimeout(() => router.push("/profile"), 320);
  }

  return (
    <ul className="flex flex-col gap-2.5" aria-label="Wallet connectors">
      {CONNECTORS.map((conn, i) => {
        const isPending = pending === conn.name;
        const recommended = i === 0;
        return (
          <li key={conn.name}>
            <button
              type="button"
              disabled={pending !== null}
              onClick={() => handleConnect(conn.name)}
              className={
                "group flex w-full items-center gap-3.5 rounded-[8px] border bg-surface px-4 py-3.5 text-left transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] disabled:pointer-events-none " +
                (recommended
                  ? "border-border-bright hover:border-accent/50"
                  : "border-border hover:border-border-bright") +
                (pending && !isPending ? " opacity-40" : "")
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

              {recommended && !isPending && (
                <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-accent">
                  Recommended
                </span>
              )}

              {isPending ? (
                <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-accent">
                  Connecting…
                </span>
              ) : (
                <svg
                  viewBox="0 0 16 16"
                  className="h-3.5 w-3.5 shrink-0 text-faint transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-foreground"
                  fill="none"
                  aria-hidden
                >
                  <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
