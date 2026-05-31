"use client";

/**
 * OfferModal - make a signed, gasless offer (PRD §9.2). Amount input (ETH), a
 * floor/best-offer reference, the protocol-fee note, and an expiry. Confirm
 * simulates a signature and surfaces an optimistic "Offer placed" success state.
 * Mirrors BuyModal: role=dialog aria-modal, Escape close, focus trap, focus return,
 * scroll lock. Calm, gallery-grade. Mounts only when open.
 */
import * as React from "react";
import type { Token } from "@/lib/types";
import { Button, MonoLabel } from "@/components/ui";
import { ChainBadge } from "@/components/chain/ChainBadge";
import { getChainMeta } from "@/lib/mock-data";
import { formatEth, bpsToPct, PROTOCOL_FEE_BPS, cn } from "@/lib/utils";

type Phase = "compose" | "signing" | "done";

const EXPIRY_OPTIONS = [
  { label: "1 day", days: 1 },
  { label: "3 days", days: 3 },
  { label: "7 days", days: 7 },
] as const;

export function OfferModal({ token, onClose }: { token: Token; onClose: () => void }) {
  const [phase, setPhase] = React.useState<Phase>("compose");
  const [amount, setAmount] = React.useState("");
  const [touched, setTouched] = React.useState(false);
  const [expiryDays, setExpiryDays] = React.useState<number>(7);
  const dialogRef = React.useRef<HTMLDivElement | null>(null);
  const amountRef = React.useRef<HTMLInputElement | null>(null);
  const errorId = React.useId();

  const bestOffer = token.offers.length > 0 ? token.offers[0] : undefined;
  const reference = token.listing?.priceEth ?? bestOffer?.priceEth;
  const currency = getChainMeta(token.chain).currency;

  const parsed = Number.parseFloat(amount);
  const valid = Number.isFinite(parsed) && parsed > 0;
  const showError = touched && amount.length > 0 && !valid;

  // Focus the dialog on open (screen-reader hand-off), then the amount field.
  // Return focus to the opener on close.
  React.useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    if (amountRef.current) {
      amountRef.current.focus();
    } else {
      dialogRef.current?.focus();
    }
    return () => opener?.focus?.();
  }, []);

  // Esc to close + lightweight focus trap + scroll lock.
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "Tab" && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
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

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!valid) {
      amountRef.current?.focus();
      return;
    }
    setPhase("signing");
    window.setTimeout(() => setPhase("done"), 1400);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && phase !== "signing") onClose();
      }}
    >
      {/* Scrim */}
      <div className="absolute inset-0 bg-background/85 backdrop-blur-sm animate-fade" aria-hidden />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Make an offer"
        tabIndex={-1}
        className="animate-rise relative flex max-h-[90dvh] w-full max-w-[440px] flex-col overflow-hidden rounded-[8px] border border-border-bright bg-surface shadow-2xl outline-none"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
          <MonoLabel className="text-foreground">
            {phase === "done" ? "Offer placed" : "Make an offer"}
          </MonoLabel>
          <button
            type="button"
            onClick={onClose}
            disabled={phase === "signing"}
            className="flex h-9 w-9 items-center justify-center rounded-[8px] text-faint transition-colors hover:text-foreground disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            aria-label="Close"
          >
            <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden>
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-5 py-5">
          {/* Item line */}
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{token.title}</p>
              <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-faint">
                {token.id}
              </p>
            </div>
            <ChainBadge chain={token.chain} className="whitespace-nowrap" />
          </div>

          {phase === "done" ? (
            <div className="animate-fade">
              <div className="flex items-center gap-2.5 rounded-[8px] border border-verify/25 bg-verify/10 px-4 py-3">
                <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-verify" />
                <p className="text-[13px] text-foreground">
                  Signed and submitted. The holder can accept it whenever they choose.
                </p>
              </div>
              <dl className="mt-4 space-y-2.5 border-t border-border pt-4">
                <Line label="Your offer" value={`${formatEth(parsed)} ${currency}`} />
                <Line
                  label="Expires"
                  value={expiryDays === 1 ? "in 1 day" : `in ${expiryDays} days`}
                  muted
                />
              </dl>
              <Button variant="secondary" className="mt-5 w-full" onClick={onClose}>
                Done
              </Button>
            </div>
          ) : (
            <form onSubmit={submit} noValidate>
              {/* Amount input */}
              <div className="space-y-2">
                <label htmlFor="offer-amount" className="flex items-baseline justify-between">
                  <MonoLabel className="text-faint">Offer amount</MonoLabel>
                  {typeof reference === "number" && (
                    <span className="whitespace-nowrap font-mono text-[10px] uppercase tracking-wider text-faint">
                      {token.listing ? "List" : "Best"} · {formatEth(reference)} {currency}
                    </span>
                  )}
                </label>
                <div
                  className={cn(
                    "flex items-center gap-2 rounded-[8px] border bg-surface-2 px-3.5 transition-colors",
                    "focus-within:border-accent/60 focus-within:ring-2 focus-within:ring-accent/30",
                    showError ? "border-error/60" : "border-border",
                  )}
                >
                  <input
                    id="offer-amount"
                    ref={amountRef}
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.001"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    onBlur={() => setTouched(true)}
                    aria-invalid={showError}
                    aria-describedby={showError ? errorId : undefined}
                    placeholder="0.000"
                    className="w-full bg-transparent py-3 font-mono text-[16px] tabular-nums text-foreground placeholder:text-faint focus-visible:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span className="whitespace-nowrap font-mono text-[13px] text-muted">{currency}</span>
                </div>
                {showError && (
                  <p id={errorId} className="font-mono text-[11px] text-error">
                    Enter an amount greater than 0.
                  </p>
                )}
              </div>

              {/* Expiry */}
              <fieldset className="mt-5">
                <legend className="mb-2 font-mono text-[10px] uppercase tracking-wider text-faint">
                  Offer expires
                </legend>
                <div className="grid grid-cols-3 gap-1.5">
                  {EXPIRY_OPTIONS.map((o) => {
                    const active = expiryDays === o.days;
                    return (
                      <button
                        key={o.days}
                        type="button"
                        onClick={() => setExpiryDays(o.days)}
                        aria-pressed={active}
                        className={cn(
                          "min-h-[44px] rounded-[8px] border px-2 font-mono text-[12px] tabular-nums transition-colors duration-200",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
                          active
                            ? "border-accent/40 bg-accent/10 text-accent"
                            : "border-border text-muted hover:border-border-bright hover:text-foreground",
                        )}
                      >
                        {o.label}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              {/* Fee note */}
              <ul className="mt-4 space-y-1.5">
                <Reassure>
                  Gasless and signature-based. Nothing leaves your wallet until the holder
                  accepts.
                </Reassure>
                <Reassure>
                  The {bpsToPct(PROTOCOL_FEE_BPS)} protocol fee and {bpsToPct(token.royalty.bps)}{" "}
                  creator royalty are settled only on acceptance.
                </Reassure>
              </ul>

              <Button
                type="submit"
                variant="accent"
                size="lg"
                className="mt-5 w-full"
                disabled={phase === "signing"}
              >
                {phase === "signing" ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="inline-block h-2 w-2 animate-verify-pulse rounded-full bg-background" />
                    Signing…
                  </span>
                ) : valid ? (
                  `Place offer · ${formatEth(parsed)} ${currency}`
                ) : (
                  "Place offer"
                )}
              </Button>
            </form>
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
