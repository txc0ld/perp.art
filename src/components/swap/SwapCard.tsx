"use client";

/**
 * SwapCard - compact visual of a SwapOrder: OFFER side (token thumbs + any ETH
 * top-up) on the left, a swap glyph in the middle, the REQUEST side on the right.
 *
 * The request side has two shapes:
 *  - Specific: the requested token thumb(s) + ETH (existing).
 *  - Criteria (requestCriteria set, request.tokenIds empty): an "ANY" badge, the
 *    criteria label, a representative collection thumbnail, and "matches N".
 *
 * ChainBadge on each side; a slim CrossChainRoute + "Cross-chain" badge when the
 * legs span chains. Footer carries maker/taker, expiry, status.
 *
 * Actions are context-driven and optimistic. Criteria swaps accept by CHOOSING
 * one of the connected wallet's matching works (inline picker), or show a calm
 * note when the wallet owns nothing matching. All numerics are mono.
 */
import * as React from "react";
import Link from "next/link";
import type { SwapOrder, SwapSide, SwapCriteria, Token } from "@/lib/types";
import { getToken, getCollection, tokensMatchingCriteria } from "@/lib/mock-data";
import { useWallet, connectWallet } from "@/lib/wallet";
import { Badge, MonoLabel } from "@/components/ui";
import { ChainBadge } from "@/components/chain/ChainBadge";
import { CrossChainRoute } from "@/components/chain/CrossChainRoute";
import { GenerativeArt } from "@/components/art/GenerativeArt";
import { Identity } from "@/components/identity/Identity";
import { formatEth, relativeTime, cn } from "@/lib/utils";

export type SwapVariant = "incoming" | "outgoing" | "open";

type Resolved = SwapOrder["status"] | "accepted-local" | "declined-local" | "cancelled-local";

const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  accepted: "Accepted",
  declined: "Declined",
  expired: "Expired",
  countered: "Countered",
  "accepted-local": "Accepted",
  "declined-local": "Declined",
  "cancelled-local": "Cancelled",
};

function statusTone(s: Resolved): "verify" | "muted" | "accent" {
  if (s === "accepted" || s === "accepted-local") return "verify";
  if (s === "open" || s === "countered") return "accent";
  return "muted";
}

/** A stack of token thumbnails for one side, with optional ETH top-up chip. */
function SideTokens({ side, align }: { side: SwapSide; align: "left" | "right" }) {
  const tokens = side.tokenIds.map((id) => getToken(id)).filter(Boolean) as NonNullable<
    ReturnType<typeof getToken>
  >[];
  return (
    <div className={cn("flex min-w-0 flex-col gap-2", align === "right" && "items-end text-right")}>
      <div className={cn("flex items-center gap-2", align === "right" && "flex-row-reverse")}>
        <div className="flex -space-x-3">
          {tokens.length > 0 ? (
            tokens.slice(0, 3).map((t, i) => (
              <Link
                key={t.id}
                href={`/token/${t.id}`}
                className="relative block h-14 w-14 shrink-0 overflow-hidden rounded-[8px] border border-border-bright bg-surface-2 transition-transform hover:z-10 hover:scale-[1.04]"
                style={{ zIndex: tokens.length - i }}
                title={t.title}
              >
                <GenerativeArt seed={t.artSeed} genre={t.genre} size={56} className="h-full w-full" />
              </Link>
            ))
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-[8px] border border-dashed border-border bg-surface-2/40 font-mono text-[10px] text-faint">
              ?
            </div>
          )}
          {tokens.length > 3 && (
            <span className="relative z-0 flex h-14 w-14 items-center justify-center rounded-[8px] border border-border bg-surface-2 font-mono text-[11px] tabular-nums text-muted">
              +{tokens.length - 3}
            </span>
          )}
        </div>
      </div>

      <div className={cn("min-w-0", align === "right" && "text-right")}>
        <p className="truncate text-[13px] font-medium leading-tight text-foreground">
          {tokens[0]?.title ?? "Open request"}
          {tokens.length > 1 && (
            <span className="ml-1 font-mono text-[11px] text-faint">+{tokens.length - 1}</span>
          )}
        </p>
        <div className={cn("mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1", align === "right" && "justify-end")}>
          <ChainBadge chain={side.chain} />
          {side.ethTopUp > 0 && (
            <span className="whitespace-nowrap font-mono text-[11px] tabular-nums text-muted">
              + {formatEth(side.ethTopUp)} ETH
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/** Criteria request side: ANY badge, representative collection thumb, "matches N". */
function CriteriaRequest({
  criteria,
  side,
  align,
}: {
  criteria: SwapCriteria;
  side: SwapSide;
  align: "right";
}) {
  const collection = criteria.collectionSlug ? getCollection(criteria.collectionSlug) : undefined;
  const thumb = collection
    ? getToken(`${collection.slug}-1`) ??
      // Fall back to the first matching token for the visual.
      tokensMatchingCriteria({ collectionSlug: collection.slug, label: "" })[0]
    : undefined;
  const matchCount = tokensMatchingCriteria(criteria).length;

  return (
    <div className={cn("flex min-w-0 flex-col gap-2", align === "right" && "items-end text-right")}>
      <div className={cn("flex items-center gap-2", align === "right" && "flex-row-reverse")}>
        <span className="relative block h-14 w-14 shrink-0 overflow-hidden rounded-[8px] border border-accent/40 bg-surface-2">
          {thumb ? (
            <GenerativeArt seed={thumb.artSeed} genre={thumb.genre} size={56} className="h-full w-full" />
          ) : (
            <span className="flex h-full w-full items-center justify-center font-mono text-[10px] text-faint">?</span>
          )}
        </span>
        <Badge tone="accent">Any</Badge>
      </div>

      <div className={cn("min-w-0", align === "right" && "text-right")}>
        <p className="truncate text-[13px] font-medium leading-tight text-foreground">{criteria.label}</p>
        <div className={cn("mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1", align === "right" && "justify-end")}>
          <ChainBadge chain={side.chain} />
          {side.ethTopUp > 0 && (
            <span className="whitespace-nowrap font-mono text-[11px] tabular-nums text-muted">+ {formatEth(side.ethTopUp)} ETH</span>
          )}
          <span className="whitespace-nowrap font-mono text-[11px] tabular-nums text-faint">matches {matchCount}</span>
        </div>
      </div>
    </div>
  );
}

function SwapGlyph() {
  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-surface-2 text-faint"
      aria-hidden
    >
      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none">
        <path d="M5 7h10l-2.5-2.5M15 13H5l2.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export function SwapCard({
  swap,
  variant,
  className,
}: {
  swap: SwapOrder;
  variant: SwapVariant;
  className?: string;
}) {
  const wallet = useWallet();
  const [status, setStatus] = React.useState<Resolved>(swap.status);
  const [busy, setBusy] = React.useState<null | string>(null);
  // Inline "choose which matching work to give" picker for criteria accept.
  const [picking, setPicking] = React.useState(false);

  const isCriteria = Boolean(swap.requestCriteria) && swap.request.tokenIds.length === 0;

  const settled =
    status === "accepted" ||
    status === "accepted-local" ||
    status === "declined" ||
    status === "declined-local" ||
    status === "cancelled-local" ||
    status === "expired";

  function act(next: Resolved, label: string) {
    setBusy(label);
    setPicking(false);
    window.setTimeout(() => {
      setStatus(next);
      setBusy(null);
    }, 900);
  }

  // Works the connected wallet owns that satisfy this swap's criteria.
  const matching = React.useMemo(
    () =>
      isCriteria && swap.requestCriteria && wallet.address
        ? tokensMatchingCriteria(swap.requestCriteria, wallet.address)
        : [],
    [isCriteria, swap.requestCriteria, wallet.address],
  );

  const targetForCounter = swap.targetTokenId ?? swap.request.tokenIds[0];

  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-[10px] border border-border bg-surface p-4 transition-colors hover:border-border-bright sm:p-5",
        className,
      )}
    >
      {/* Top: identity + status */}
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[11px] uppercase tracking-wider text-faint">{swap.id}</span>
        <div className="flex items-center gap-2">
          {isCriteria && <Badge tone="accent">Collection swap</Badge>}
          {swap.crossChain && <Badge tone="accent">Cross-chain</Badge>}
          <Badge tone={statusTone(status)}>{STATUS_LABEL[status] ?? status}</Badge>
        </div>
      </div>

      {/* Trade body */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        <div className="min-w-0 flex-1">
          <MonoLabel className="mb-2 block text-faint">
            {variant === "incoming" ? "They offer" : "You offer"}
          </MonoLabel>
          <SideTokens side={swap.offer} align="left" />
        </div>
        <SwapGlyph />
        <div className="min-w-0 flex-1">
          <MonoLabel className="mb-2 block text-right text-faint">
            {variant === "incoming" ? "For any of yours" : isCriteria ? "Any matching" : "You receive"}
          </MonoLabel>
          {isCriteria && swap.requestCriteria ? (
            <CriteriaRequest criteria={swap.requestCriteria} side={swap.request} align="right" />
          ) : (
            <SideTokens side={swap.request} align="right" />
          )}
        </div>
      </div>

      {/* Cross-chain settlement route */}
      {swap.crossChain && (
        <div className="rounded-[8px] border border-border bg-background/40 px-3 py-3">
          <CrossChainRoute from={swap.offer.chain} to={swap.request.chain} />
          <p className="mt-2.5 text-[11px] leading-snug text-faint">
            Settles atomically across chains via escrow, rolls back if either leg fails.
          </p>
        </div>
      )}

      {/* Footer: counterparties + expiry */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 border-t border-border pt-3 font-mono text-[11px] text-faint">
        <span className="inline-flex min-w-0 items-center gap-1.5">
          {variant === "incoming" ? "From" : "To"}{" "}
          {variant === "incoming" ? (
            <Identity address={swap.maker} className="max-w-[160px] text-muted" />
          ) : isCriteria ? (
            <span className="text-muted">Any matching holder</span>
          ) : (
            <Identity address={swap.taker ?? swap.maker} className="max-w-[160px] text-muted" />
          )}
        </span>
        <span className="shrink-0">
          {settled ? "Closed" : "Expires"} {relativeTime(swap.expiresAt)}
        </span>
      </div>

      {/* Actions / confirmed state */}
      {settled ? (
        <ConfirmedLine status={status} />
      ) : isCriteria && variant === "open" ? (
        <CriteriaAccept
          connected={wallet.connected}
          matching={matching}
          busy={busy}
          picking={picking}
          onConnect={() => connectWallet()}
          onStartPick={() => setPicking(true)}
          onCancelPick={() => setPicking(false)}
          onAccept={() => act("accepted-local", "accept")}
        />
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {variant === "incoming" && (
            <>
              <button
                type="button"
                disabled={busy != null}
                onClick={() => act("accepted-local", "accept")}
                className="inline-flex h-11 flex-1 min-w-[96px] items-center justify-center gap-2 rounded-[8px] bg-accent px-3 text-[13px] font-medium text-background transition-colors hover:bg-accent-dim disabled:opacity-40"
              >
                {busy === "accept" ? <Spinner /> : "Accept"}
              </button>
              <button
                type="button"
                disabled={busy != null}
                onClick={() => act("declined-local", "decline")}
                className="inline-flex h-11 items-center justify-center rounded-[8px] border border-border bg-surface px-3 text-[13px] text-muted transition-colors hover:border-border-bright hover:text-foreground disabled:opacity-40"
              >
                Decline
              </button>
              {targetForCounter && (
                <Link
                  href={`/token/${targetForCounter}`}
                  className="inline-flex h-11 items-center justify-center rounded-[8px] border border-border bg-surface px-3 text-[13px] text-muted transition-colors hover:border-border-bright hover:text-foreground"
                >
                  Counter
                </Link>
              )}
            </>
          )}

          {variant === "outgoing" && (
            <button
              type="button"
              disabled={busy != null}
              onClick={() => act("cancelled-local", "cancel")}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] border border-border bg-surface px-3 text-[13px] text-muted transition-colors hover:border-border-bright hover:text-foreground disabled:opacity-40"
            >
              {busy === "cancel" ? <Spinner muted /> : "Cancel swap"}
            </button>
          )}

          {variant === "open" && (
            <>
              {targetForCounter && (
                <Link
                  href={`/token/${targetForCounter}`}
                  className="inline-flex h-11 flex-1 min-w-[120px] items-center justify-center rounded-[8px] border border-border-bright bg-surface px-3 text-[13px] font-medium text-foreground transition-colors hover:bg-surface-2"
                >
                  Propose counter
                </Link>
              )}
              {targetForCounter && (
                <Link
                  href={`/token/${targetForCounter}`}
                  className="inline-flex h-11 items-center justify-center rounded-[8px] px-3 text-[13px] text-muted transition-colors hover:text-foreground"
                >
                  View
                </Link>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** Accept flow for criteria swaps: choose which matching work to give. */
function CriteriaAccept({
  connected,
  matching,
  busy,
  picking,
  onConnect,
  onStartPick,
  onCancelPick,
  onAccept,
}: {
  connected: boolean;
  matching: Token[];
  busy: string | null;
  picking: boolean;
  onConnect: () => void;
  onStartPick: () => void;
  onCancelPick: () => void;
  onAccept: () => void;
}) {
  const [chosen, setChosen] = React.useState<string | null>(null);

  // Not connected: invite to connect (calm, no accent pressure).
  if (!connected) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[8px] border border-border bg-surface-2/40 px-3 py-2.5">
        <p className="text-[12px] leading-snug text-muted">Connect a wallet to see if you hold a matching work.</p>
        <button
          type="button"
          onClick={onConnect}
          className="inline-flex h-10 items-center justify-center rounded-[8px] border border-border bg-surface px-3 text-[12px] text-muted transition-colors hover:border-border-bright hover:text-foreground"
        >
          Connect wallet
        </button>
      </div>
    );
  }

  // Connected but owns nothing matching: calm note instead of Accept.
  if (matching.length === 0) {
    return (
      <div className="flex items-center gap-2.5 rounded-[8px] border border-border bg-surface-2/40 px-3 py-2.5 text-[12px] leading-snug text-muted">
        <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-faint" aria-hidden />
        You need a matching work to accept this swap.
      </div>
    );
  }

  // Inline picker: choose which matching work to give, then confirm.
  if (picking) {
    return (
      <div className="rounded-[8px] border border-border bg-surface-2/40 p-3">
        <div className="mb-2 flex items-center justify-between">
          <MonoLabel className="text-faint">Choose a work to give</MonoLabel>
          <span className="font-mono text-[10px] uppercase tracking-wider text-faint">{matching.length} eligible</span>
        </div>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
          {matching.map((t) => {
            const on = chosen === t.id;
            return (
              <button
                key={t.id}
                type="button"
                disabled={busy != null}
                onClick={() => setChosen(t.id)}
                aria-pressed={on}
                title={t.title}
                className={cn(
                  "group relative aspect-square overflow-hidden rounded-[8px] border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 disabled:opacity-40",
                  on ? "border-accent ring-1 ring-accent/40" : "border-border hover:border-border-bright",
                )}
              >
                <GenerativeArt seed={t.artSeed} genre={t.genre} size={80} className="h-full w-full" />
                {on && (
                  <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full border border-accent bg-accent text-background" aria-hidden>
                    <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none">
                      <path d="M2.5 6l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                )}
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/90 to-transparent px-1 pb-0.5 pt-2 text-left font-mono text-[9px] uppercase tracking-wider text-muted">
                  <span className="block truncate">#{t.tokenId}</span>
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            disabled={!chosen || busy != null}
            onClick={onAccept}
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-[8px] bg-accent px-3 text-[13px] font-medium text-background transition-colors hover:bg-accent-dim disabled:opacity-40"
          >
            {busy === "accept" ? <Spinner /> : chosen ? "Confirm accept" : "Select a work"}
          </button>
          <button
            type="button"
            disabled={busy != null}
            onClick={onCancelPick}
            className="inline-flex h-11 items-center justify-center rounded-[8px] border border-border bg-surface px-3 text-[13px] text-muted transition-colors hover:border-border-bright hover:text-foreground disabled:opacity-40"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // Default: an Accept CTA that opens the picker.
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={busy != null}
        onClick={onStartPick}
        className="inline-flex h-11 flex-1 min-w-[96px] items-center justify-center gap-2 rounded-[8px] bg-accent px-3 text-[13px] font-medium text-background transition-colors hover:bg-accent-dim disabled:opacity-40"
      >
        Accept
      </button>
      <span className="font-mono text-[11px] tabular-nums text-faint">
        {matching.length} of yours match
      </span>
    </div>
  );
}

function ConfirmedLine({ status }: { status: Resolved }) {
  const accepted = status === "accepted" || status === "accepted-local";
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-[8px] border px-3 py-2.5 text-[12px] leading-snug",
        accepted ? "border-verify/25 bg-verify/10 text-foreground" : "border-border bg-surface-2/40 text-muted",
      )}
    >
      <span className={cn("inline-block h-2 w-2 shrink-0 rounded-full", accepted ? "bg-verify" : "bg-faint")} />
      {accepted
        ? "Settled atomically. Ownership and provenance now reflect the trade."
        : status === "cancelled-local"
          ? "Swap withdrawn. Nothing left escrow, your work stays in your wallet."
          : status === "expired"
            ? "This swap window has closed."
            : "Declined. No assets moved."}
    </div>
  );
}

function Spinner({ muted = false }: { muted?: boolean }) {
  return (
    <span
      className={cn(
        "inline-block h-2 w-2 animate-verify-pulse rounded-full",
        muted ? "bg-muted" : "bg-background",
      )}
    />
  );
}
