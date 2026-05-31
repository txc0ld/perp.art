"use client";

/**
 * SwapModal - propose a swap. Two request MODES, chosen via a segmented control:
 *
 *  - "Specific item": barter for one TARGET token (the original flow).
 *  - "Any from a collection": criteria barter - any token from a chosen
 *    collection (optionally filtered to a trait), via CriteriaPicker.
 *
 * Mirrors BuyModal's modal mechanics (scrim, role=dialog/aria-modal, Esc, focus
 * trap, body-scroll lock, max-h scroll, optimistic success).
 *
 * Common to both modes:
 *  - "You offer": multi-select from the wallet's swappable holdings (Connect step
 *    when disconnected; calm empty state when the wallet owns nothing).
 *  - Optional ETH top-up on either side to balance value.
 *  - Cross-chain route + settlement note when chains differ.
 *  - Settlement breakdown via swapBreakdown.
 *  - Confirm -> "Posting..." -> optimistic success with a fabricated swap id.
 *
 * Opened WITHOUT a target token, the modal defaults to criteria mode.
 */
import * as React from "react";
import Link from "next/link";
import type { Token, SwapCriteria } from "@/lib/types";
import { Button, MonoLabel, Badge } from "@/components/ui";
import { ChainBadge } from "@/components/chain/ChainBadge";
import { CrossChainRoute } from "@/components/chain/CrossChainRoute";
import { GenerativeArt } from "@/components/art/GenerativeArt";
import { useWallet, connectWallet } from "@/lib/wallet";
import {
  getSwappableTokens,
  getCollection,
  tokensMatchingCriteria,
  BRIDGE_FEE_ETH,
} from "@/lib/mock-data";
import { swapBreakdown, formatEth, cn } from "@/lib/utils";
import { CriteriaPicker, collectionThumbToken } from "./CriteriaPicker";

type Phase = "connect" | "compose" | "proposing" | "done";
type TopUpSide = "mine" | "theirs";
export type SwapMode = "specific" | "criteria";

function fabricateSwapId(key: string, offered: string[]): string {
  let h = 0x811c9dc5;
  const s = "swap:" + key + ":" + offered.join(",");
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  let out = "";
  let seed = h;
  for (let i = 0; i < 10; i++) {
    seed = (Math.imul(seed ^ (seed >>> 13), 0x5bd1e995) + i) >>> 0;
    out += (seed & 0xf).toString(16);
  }
  return "swap-" + out;
}

export function SwapModal({
  token,
  defaultMode,
  onClose,
}: {
  /** Optional target token. When omitted, the modal opens in criteria mode. */
  token?: Token;
  defaultMode?: SwapMode;
  onClose: () => void;
}) {
  const wallet = useWallet();
  const dialogRef = React.useRef<HTMLDivElement | null>(null);

  const initialMode: SwapMode = defaultMode ?? (token ? "specific" : "criteria");
  const [mode, setMode] = React.useState<SwapMode>(initialMode);
  const [phase, setPhase] = React.useState<Phase>(wallet.connected ? "compose" : "connect");
  const [selected, setSelected] = React.useState<string[]>([]);
  const [topUpSide, setTopUpSide] = React.useState<TopUpSide>("mine");
  const [topUpAmount, setTopUpAmount] = React.useState<string>("");
  const [criteria, setCriteria] = React.useState<SwapCriteria | null>(null);

  // The user's holdings to offer. A pure mock-data accessor - SSR-safe to call.
  const holdings = React.useMemo(
    () => (wallet.address ? getSwappableTokens(wallet.address) : []),
    [wallet.address],
  );

  // Keep phase in sync with wallet connect that happens inside the modal.
  React.useEffect(() => {
    if (wallet.connected && phase === "connect") {
      const t = setTimeout(() => setPhase("compose"), 0);
      return () => clearTimeout(t);
    }
  }, [wallet.connected, phase]);

  const offeredTokens = holdings.filter((t) => selected.includes(t.id));

  // The chain of the requested side: target token, or the chosen collection.
  const criteriaCollection = criteria?.collectionSlug ? getCollection(criteria.collectionSlug) : undefined;
  const requestChain = mode === "specific" ? token?.chain : criteriaCollection?.chain;

  // Cross-chain when ANY offered leg lives on a different chain than the request.
  const crossChain =
    requestChain != null && offeredTokens.some((t) => t.chain !== requestChain);
  const offerChain = offeredTokens[0]?.chain ?? requestChain ?? "ethereum";

  const topUp = Math.max(0, Number.parseFloat(topUpAmount) || 0);
  const offerEth = topUpSide === "mine" ? topUp : 0;
  const requestEth = topUpSide === "theirs" ? topUp : 0;
  const breakdown = swapBreakdown({ offerEth, requestEth, crossChain, bridgeFeeEth: BRIDGE_FEE_ETH });

  const matchCount = criteria ? tokensMatchingCriteria(criteria).length : 0;

  const swapId = React.useMemo(
    () => fabricateSwapId(mode === "specific" ? token?.id ?? "open" : criteria?.label ?? "open", selected),
    [mode, token, criteria, selected],
  );

  const requestReady = mode === "specific" ? Boolean(token) : Boolean(criteria?.collectionSlug);
  const canConfirm = selected.length > 0 && requestReady;

  // Focus management + Esc + focus trap + scroll lock (mirrors BuyModal).
  React.useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    return () => opener?.focus?.();
  }, [phase, mode]);

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

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  function confirm() {
    setPhase("proposing");
    window.setTimeout(() => setPhase("done"), 1600);
  }

  // The label that carries the chosen criteria, including any ETH top-up.
  const criteriaSummary = React.useMemo(() => {
    if (!criteria) return null;
    const eth = requestEth > 0 ? ` + ${formatEth(requestEth)} ETH` : "";
    // criteria.label already includes any base + trait; append live ETH note.
    return `${criteria.label}${eth}`;
  }, [criteria, requestEth]);

  const criteriaThumb = criteria?.collectionSlug ? collectionThumbToken(criteria.collectionSlug) : undefined;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && phase !== "proposing") onClose();
      }}
    >
      <div className="absolute inset-0 bg-background/85 backdrop-blur-sm animate-fade" aria-hidden />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Propose a swap"
        className="animate-rise relative flex max-h-[92dvh] w-full max-w-[520px] flex-col overflow-hidden rounded-t-[12px] border border-border-bright bg-surface shadow-2xl sm:max-h-[90dvh] sm:rounded-[10px]"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
          <MonoLabel className="text-foreground">
            {phase === "done" ? "Swap posted" : phase === "connect" ? "Connect wallet" : "Propose a swap"}
          </MonoLabel>
          <button
            type="button"
            onClick={onClose}
            disabled={phase === "proposing"}
            className="flex h-11 w-11 items-center justify-center rounded-[8px] text-faint transition-colors hover:text-foreground disabled:opacity-30"
            aria-label="Close"
          >
            <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-5 py-5">
          {phase === "connect" && <ConnectStep onConnect={() => connectWallet()} />}

          {phase === "done" && <DoneStep swapId={swapId} onClose={onClose} />}

          {(phase === "compose" || phase === "proposing") && (
            <div className="flex flex-col gap-5">
              {/* Mode toggle (segmented control) */}
              <div
                role="radiogroup"
                aria-label="What do you want in return"
                className="inline-flex w-full rounded-[8px] border border-border p-0.5"
              >
                {(
                  [
                    { id: "specific" as SwapMode, label: "Specific item" },
                    { id: "criteria" as SwapMode, label: "Any from a collection" },
                  ]
                ).map((m) => {
                  const active = mode === m.id;
                  // Specific mode needs a target; without one it is disabled.
                  const unavailable = m.id === "specific" && !token;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      disabled={phase === "proposing" || unavailable}
                      onClick={() => setMode(m.id)}
                      className={cn(
                        "h-9 flex-1 rounded-[6px] px-3 font-mono text-[11px] uppercase tracking-wider transition-colors disabled:opacity-30",
                        active ? "bg-surface-2 text-foreground" : "text-faint hover:text-muted",
                      )}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>

              {/* You receive (request side) */}
              <section>
                <MonoLabel className="text-faint">You receive</MonoLabel>

                {mode === "specific" && token && (
                  <div className="mt-2 flex items-center gap-3 rounded-[8px] border border-border bg-surface-2/40 p-3">
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-[8px] border border-border-bright">
                      <GenerativeArt seed={token.artSeed} genre={token.genre} size={56} className="h-full w-full" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{token.title}</p>
                      <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-faint">{token.id}</p>
                    </div>
                    <ChainBadge chain={token.chain} />
                  </div>
                )}

                {mode === "criteria" && (
                  <div className="mt-2">
                    <CriteriaPicker value={criteria} onChange={setCriteria} disabled={phase === "proposing"} />
                  </div>
                )}
              </section>

              {/* You offer */}
              <section>
                <div className="flex items-center justify-between">
                  <MonoLabel className="text-faint">You offer</MonoLabel>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-faint">
                    {selected.length} selected
                  </span>
                </div>

                {holdings.length === 0 ? (
                  <div className="mt-2 rounded-[8px] border border-dashed border-border bg-surface-2/30 px-4 py-6 text-center">
                    <p className="text-[13px] text-muted">
                      You do not hold any swappable works yet. Acquire a piece, then return to barter it.
                    </p>
                  </div>
                ) : (
                  <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {holdings.map((t) => {
                      const on = selected.includes(t.id);
                      return (
                        <button
                          key={t.id}
                          type="button"
                          data-autofocus={mode === "specific" && t.id === holdings[0].id ? true : undefined}
                          onClick={() => toggle(t.id)}
                          aria-pressed={on}
                          disabled={phase === "proposing"}
                          className={cn(
                            "group relative aspect-square overflow-hidden rounded-[8px] border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
                            on ? "border-accent ring-1 ring-accent/40" : "border-border hover:border-border-bright",
                          )}
                          title={t.title}
                        >
                          <GenerativeArt seed={t.artSeed} genre={t.genre} size={120} className="h-full w-full" />
                          <span
                            className={cn(
                              "absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full border text-background transition-opacity",
                              on ? "border-accent bg-accent opacity-100" : "border-border bg-background/70 opacity-0 group-hover:opacity-100",
                            )}
                            aria-hidden
                          >
                            {on && (
                              <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none">
                                <path d="M2.5 6l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </span>
                          <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/90 to-transparent px-1.5 pb-1 pt-3 text-left font-mono text-[9px] uppercase tracking-wider text-muted">
                            <span className="block truncate">#{t.tokenId}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* ETH top-up */}
              <section>
                <MonoLabel className="text-faint">Balance with ETH</MonoLabel>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <div className="inline-flex rounded-[8px] border border-border p-0.5">
                    {(["mine", "theirs"] as TopUpSide[]).map((s) => (
                      <button
                        key={s}
                        type="button"
                        disabled={phase === "proposing"}
                        onClick={() => setTopUpSide(s)}
                        aria-pressed={topUpSide === s}
                        className={cn(
                          "h-8 rounded-[6px] px-3 font-mono text-[11px] uppercase tracking-wider transition-colors",
                          topUpSide === s ? "bg-surface-2 text-foreground" : "text-faint hover:text-muted",
                        )}
                      >
                        {s === "mine" ? "My side" : "Their side"}
                      </button>
                    ))}
                  </div>
                  <div className="flex h-9 flex-1 min-w-[140px] items-center gap-2 rounded-[8px] border border-border bg-surface-2/40 px-3 focus-within:border-border-bright">
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.001"
                      value={topUpAmount}
                      disabled={phase === "proposing"}
                      onChange={(e) => setTopUpAmount(e.target.value)}
                      placeholder="0.0"
                      aria-label={`ETH added to ${topUpSide === "mine" ? "your" : "their"} side`}
                      className="w-full bg-transparent font-mono text-[13px] tabular-nums text-foreground outline-none placeholder:text-faint"
                    />
                    <span className="font-mono text-[11px] uppercase tracking-wider text-faint">ETH</span>
                  </div>
                </div>
                <p className="mt-1.5 text-[11px] leading-snug text-faint">
                  Add ETH to either side to even out value. Protocol fee applies to the net ETH only.
                </p>
              </section>

              {/* Criteria summary (criteria mode) */}
              {mode === "criteria" && criteria?.collectionSlug && (
                <section className="rounded-[8px] border border-accent/25 bg-accent/[0.04] px-3 py-3">
                  <div className="flex items-center gap-3">
                    {criteriaThumb && (
                      <span className="h-10 w-10 shrink-0 overflow-hidden rounded-[6px] border border-border-bright">
                        <GenerativeArt seed={criteriaThumb.artSeed} genre={criteriaThumb.genre} size={40} className="h-full w-full" />
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge tone="accent">Any</Badge>
                        <span className="truncate text-[13px] font-medium text-foreground">{criteriaSummary}</span>
                      </div>
                      <p className="mt-1 font-mono text-[11px] tabular-nums text-muted">matches {matchCount} works</p>
                    </div>
                  </div>
                </section>
              )}

              {/* Cross-chain settlement */}
              {crossChain && requestChain && (
                <section className="rounded-[8px] border border-accent/25 bg-accent/[0.04] px-3 py-3">
                  <div className="mb-2 flex items-center justify-between">
                    <MonoLabel className="text-accent">Cross-chain settlement</MonoLabel>
                    <Badge tone="accent">Cross-chain</Badge>
                  </div>
                  <CrossChainRoute from={offerChain} to={requestChain} />
                  <p className="mt-2.5 text-[11px] leading-snug text-muted">
                    Settles atomically across chains via escrow, rolls back if either leg fails.
                  </p>
                </section>
              )}

              {/* Settlement breakdown */}
              <section className="border-t border-border pt-4">
                <dl className="space-y-2.5">
                  <Line label="Net ETH" value={`${formatEth(breakdown.netEth)} ETH`} muted />
                  <Line label="Protocol fee" value={`${formatEth(breakdown.protocol)} ETH`} muted />
                  {crossChain && <Line label="Bridge fee" value={`${formatEth(breakdown.bridge)} ETH`} muted />}
                  <div className="!mt-3 flex items-baseline justify-between border-t border-border pt-3">
                    <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-foreground">
                      You pay in fees
                    </span>
                    <span className="font-mono text-[15px] font-semibold tabular-nums text-foreground">
                      {formatEth(breakdown.total)} ETH
                    </span>
                  </div>
                </dl>

                <ul className="mt-4 space-y-1.5">
                  <Reassure>Fully non-custodial. Your work only leaves your wallet at settlement.</Reassure>
                  {mode === "criteria" ? (
                    <Reassure>Any holder of a matching work can accept, the first to settle takes the trade.</Reassure>
                  ) : (
                    <Reassure>Both legs settle atomically, the trade either completes or reverts.</Reassure>
                  )}
                </ul>
              </section>

              <Button
                variant="accent"
                size="lg"
                className="w-full"
                onClick={confirm}
                disabled={!canConfirm || phase === "proposing"}
              >
                {phase === "proposing" ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="inline-block h-2 w-2 animate-verify-pulse rounded-full bg-background" />
                    Posting...
                  </span>
                ) : !requestReady && mode === "criteria" ? (
                  "Choose a collection"
                ) : selected.length === 0 ? (
                  "Select a work to offer"
                ) : mode === "criteria" ? (
                  `Post swap${crossChain ? " (cross-chain)" : ""}`
                ) : (
                  `Propose swap${crossChain ? " (cross-chain)" : ""}`
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ConnectStep({ onConnect }: { onConnect: () => void }) {
  return (
    <div className="py-4 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-border-bright">
        <svg viewBox="0 0 24 24" className="h-5 w-5 text-accent" fill="none" aria-hidden>
          <rect x="3" y="6" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.5" />
          <path d="M16 12h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M3 9h18" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </div>
      <p className="mt-5 text-[15px] font-medium text-foreground">Connect a wallet to barter</p>
      <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-muted">
        Connecting only reads your public holdings so you can choose what to offer. Perpetual never takes custody.
      </p>
      <Button data-autofocus variant="accent" size="lg" className="mt-6 w-full" onClick={onConnect}>
        Connect wallet
      </Button>
    </div>
  );
}

function DoneStep({ swapId, onClose }: { swapId: string; onClose: () => void }) {
  return (
    <div className="animate-fade">
      <div className="flex items-center gap-2.5 rounded-[8px] border border-verify/25 bg-verify/10 px-4 py-3">
        <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-verify" />
        <p className="text-[13px] text-foreground">
          Swap posted. A matching holder can accept, decline, or counter. Nothing moves until both legs settle.
        </p>
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
        <MonoLabel className="text-faint">Swap id</MonoLabel>
        <span className="font-mono text-[13px] text-foreground">{swapId}</span>
      </div>
      <div className="mt-5 flex flex-col gap-2.5">
        <Link
          href="/swaps"
          className="inline-flex h-12 w-full items-center justify-center rounded-[8px] bg-accent px-6 text-[15px] font-medium text-background transition-colors hover:bg-accent-dim"
        >
          View in Swaps
        </Link>
        <Button variant="secondary" className="w-full" onClick={onClose}>
          Done
        </Button>
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
