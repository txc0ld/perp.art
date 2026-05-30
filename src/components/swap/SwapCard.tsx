"use client";

/**
 * SwapCard - compact visual of a SwapOrder: OFFER side (token thumbs + any ETH
 * top-up) on the left, a swap glyph in the middle, the REQUEST side on the right.
 * ChainBadge on each side; a slim CrossChainRoute + "Cross-chain" badge when the
 * legs span chains. Footer carries maker/taker, expiry, status. Actions are
 * context-driven (incoming / outgoing / open) and optimistic - they update local
 * state and settle into a confirmed line in place. All numerics are mono.
 */
import * as React from "react";
import Link from "next/link";
import type { SwapOrder, SwapSide } from "@/lib/types";
import { getToken } from "@/lib/mock-data";
import { Badge, MonoLabel } from "@/components/ui";
import { ChainBadge } from "@/components/chain/ChainBadge";
import { CrossChainRoute } from "@/components/chain/CrossChainRoute";
import { GenerativeArt } from "@/components/art/GenerativeArt";
import { formatEth, shortAddress, relativeTime, cn } from "@/lib/utils";

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
        <div className={cn("mt-1.5 flex items-center gap-2", align === "right" && "justify-end")}>
          <ChainBadge chain={side.chain} />
          {side.ethTopUp > 0 && (
            <span className="font-mono text-[11px] tabular-nums text-muted">
              + {formatEth(side.ethTopUp)} ETH
            </span>
          )}
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
  const [status, setStatus] = React.useState<Resolved>(swap.status);
  const [busy, setBusy] = React.useState<null | string>(null);

  const settled =
    status === "accepted" ||
    status === "accepted-local" ||
    status === "declined" ||
    status === "declined-local" ||
    status === "cancelled-local" ||
    status === "expired";

  function act(next: Resolved, label: string) {
    setBusy(label);
    window.setTimeout(() => {
      setStatus(next);
      setBusy(null);
    }, 900);
  }

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
          {swap.crossChain && <Badge tone="accent">Cross-chain</Badge>}
          <Badge tone={statusTone(status)}>{STATUS_LABEL[status] ?? status}</Badge>
        </div>
      </div>

      {/* Trade body */}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <MonoLabel className="mb-2 block text-faint">
            {variant === "incoming" ? "They offer" : "You offer"}
          </MonoLabel>
          <SideTokens side={swap.offer} align="left" />
        </div>
        <SwapGlyph />
        <div className="flex-1">
          <MonoLabel className="mb-2 block text-right text-faint">
            {variant === "incoming" ? "For your" : "You receive"}
          </MonoLabel>
          <SideTokens side={swap.request} align="right" />
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
        <span>
          {variant === "incoming" ? "From" : "To"}{" "}
          <span className="text-muted">
            {shortAddress(variant === "incoming" ? swap.maker : swap.taker ?? swap.maker)}
          </span>
        </span>
        <span>
          {settled ? "Closed" : "Expires"} {relativeTime(swap.expiresAt)}
        </span>
      </div>

      {/* Actions / confirmed state */}
      {settled ? (
        <ConfirmedLine status={status} />
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {variant === "incoming" && (
            <>
              <button
                type="button"
                disabled={busy != null}
                onClick={() => act("accepted-local", "accept")}
                className="inline-flex h-9 flex-1 min-w-[96px] items-center justify-center gap-2 rounded-[8px] bg-accent px-3 text-[13px] font-medium text-background transition-colors hover:bg-accent-dim disabled:opacity-40"
              >
                {busy === "accept" ? <Spinner /> : "Accept"}
              </button>
              <button
                type="button"
                disabled={busy != null}
                onClick={() => act("declined-local", "decline")}
                className="inline-flex h-9 items-center justify-center rounded-[8px] border border-border bg-surface px-3 text-[13px] text-muted transition-colors hover:border-border-bright hover:text-foreground disabled:opacity-40"
              >
                Decline
              </button>
              {targetForCounter && (
                <Link
                  href={`/token/${targetForCounter}`}
                  className="inline-flex h-9 items-center justify-center rounded-[8px] border border-border bg-surface px-3 text-[13px] text-muted transition-colors hover:border-border-bright hover:text-foreground"
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
              className="inline-flex h-9 items-center justify-center gap-2 rounded-[8px] border border-border bg-surface px-3 text-[13px] text-muted transition-colors hover:border-border-bright hover:text-foreground disabled:opacity-40"
            >
              {busy === "cancel" ? <Spinner muted /> : "Cancel swap"}
            </button>
          )}

          {variant === "open" && (
            <>
              {targetForCounter && (
                <Link
                  href={`/token/${targetForCounter}`}
                  className="inline-flex h-9 flex-1 min-w-[120px] items-center justify-center rounded-[8px] border border-border-bright bg-surface px-3 text-[13px] font-medium text-foreground transition-colors hover:bg-surface-2"
                >
                  Propose counter
                </Link>
              )}
              {targetForCounter && (
                <Link
                  href={`/token/${targetForCounter}`}
                  className="inline-flex h-9 items-center justify-center rounded-[8px] px-3 text-[13px] text-muted transition-colors hover:text-foreground"
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
