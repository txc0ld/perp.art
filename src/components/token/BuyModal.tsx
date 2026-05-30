"use client";

/**
 * BuyModal - pre-confirmation fee breakdown (PRD §10.2, §8.4) over a near-black scrim.
 * Shows Price, Protocol fee (2.25%), Creator royalty, Total, with royalty-enforcement
 * and non-custodial reassurance. Confirm simulates a settlement tx and surfaces a mono
 * tx hash. Esc to close, focus trapped within the modal. Calm, gallery-grade.
 */
import * as React from "react";
import type { Token } from "@/lib/types";
import { Button, MonoLabel, Badge } from "@/components/ui";
import { feeBreakdown, formatEth, bpsToPct, shortHash, PROTOCOL_FEE_BPS, cn } from "@/lib/utils";

type Phase = "review" | "confirming" | "done";

function fabricateTx(token: Token): string {
  // Deterministic-ish fabricated settlement hash from the token id.
  let h = 0x811c9dc5;
  const s = "settle:" + token.id;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  let out = "0x";
  let seed = h;
  for (let i = 0; i < 64; i++) {
    seed = (Math.imul(seed ^ (seed >>> 13), 0x5bd1e995) + i) >>> 0;
    out += (seed & 0xf).toString(16);
  }
  return out;
}

export function BuyModal({ token, onClose }: { token: Token; onClose: () => void }) {
  const [phase, setPhase] = React.useState<Phase>("review");
  const dialogRef = React.useRef<HTMLDivElement | null>(null);

  const price = token.listing?.priceEth ?? 0;
  const fees = feeBreakdown(price, token.royalty.bps);
  const txHash = React.useMemo(() => fabricateTx(token), [token]);

  // Focus the primary action on open; return focus to the opener on close.
  React.useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    dialogRef.current
      ?.querySelector<HTMLButtonElement>("[data-confirm]")
      ?.focus();
    return () => opener?.focus?.();
  }, []);

  // Esc to close + lightweight focus trap.
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "Tab" && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
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
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  function confirm() {
    setPhase("confirming");
    window.setTimeout(() => setPhase("done"), 1600);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && phase !== "confirming") onClose();
      }}
    >
      {/* Scrim */}
      <div className="absolute inset-0 bg-background/85 backdrop-blur-sm animate-fade" aria-hidden />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Confirm purchase"
        className="animate-rise relative w-full max-w-[440px] rounded-[8px] border border-border-bright bg-surface shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <MonoLabel className="text-foreground">
            {phase === "done" ? "Purchase complete" : "Confirm purchase"}
          </MonoLabel>
          <button
            type="button"
            onClick={onClose}
            disabled={phase === "confirming"}
            className="flex h-9 w-9 items-center justify-center rounded-[8px] text-faint transition-colors hover:text-foreground disabled:opacity-30"
            aria-label="Close"
          >
            <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5">
          {/* Item line */}
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{token.title}</p>
              <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-faint">
                {token.id}
              </p>
            </div>
            <Badge tone="muted">{token.chain === "ethereum" ? "Mainnet" : "Base"}</Badge>
          </div>

          {phase === "done" ? (
            <div className="animate-fade">
              <div className="flex items-center gap-2.5 rounded-[8px] border border-verify/25 bg-verify/10 px-4 py-3">
                <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-verify" />
                <p className="text-[13px] text-foreground">
                  Settled onchain. Ownership and provenance updated.
                </p>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                <MonoLabel>Tx</MonoLabel>
                <a
                  href={`https://etherscan.io/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-[13px] text-accent hover:underline"
                >
                  {shortHash(txHash)}
                </a>
              </div>
              <Button variant="secondary" className="mt-5 w-full" onClick={onClose}>
                Done
              </Button>
            </div>
          ) : (
            <>
              {/* Fee breakdown */}
              <dl className="space-y-2.5">
                <Line label="Price" value={`${formatEth(fees.price)} ETH`} />
                <Line
                  label={`Protocol fee · ${bpsToPct(PROTOCOL_FEE_BPS)}`}
                  value={`${formatEth(fees.protocol)} ETH`}
                  muted
                />
                <Line
                  label={`Creator royalty · ${bpsToPct(token.royalty.bps)}`}
                  value={`${formatEth(fees.royalty)} ETH`}
                  muted
                />
                <div className="!mt-3 flex items-baseline justify-between border-t border-border pt-3">
                  <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-foreground">
                    Total
                  </span>
                  <span className="font-mono text-[15px] font-semibold tabular-nums text-foreground">
                    {formatEth(fees.price)} ETH
                  </span>
                </div>
              </dl>

              {/* Reassurance */}
              <ul className="mt-4 space-y-1.5">
                <Reassure>Royalties enforced at settlement - not optional.</Reassure>
                <Reassure>Non-custodial. Perpetual never holds your asset or funds.</Reassure>
              </ul>

              <Button
                data-confirm
                variant="accent"
                size="lg"
                className="mt-5 w-full"
                onClick={confirm}
                disabled={phase === "confirming"}
              >
                {phase === "confirming" ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="inline-block h-2 w-2 animate-verify-pulse rounded-full bg-background" />
                    Confirming…
                  </span>
                ) : (
                  `Confirm · ${formatEth(fees.price)} ETH`
                )}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Line({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className={cn("font-mono text-[11px] uppercase tracking-wider", muted ? "text-faint" : "text-muted")}>
        {label}
      </span>
      <span className={cn("font-mono text-[13px] tabular-nums", muted ? "text-muted" : "text-foreground")}>
        {value}
      </span>
    </div>
  );
}

function Reassure({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-[12px] leading-snug text-muted">
      <span className="mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full bg-accent" />
      {children}
    </li>
  );
}
