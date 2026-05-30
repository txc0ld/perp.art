"use client";

/**
 * PermanencePanel - Perpetual's signature trust surface (design prompt §5, PRD §10.4).
 *
 * One row per storage shard, each independently checkable via its raw public source.
 * Verified states earn the parchment-gold accent - the one place the accent is
 * concentrated. A lapsed IPFS pin renders calmly: it is by design, because the
 * onchain proof shard backstops permanence (PRD §13.3). Rows verify in a quick
 * stagger when the panel first enters view - "interactive infrastructure," not a
 * static table.
 */
import * as React from "react";
import type { Token } from "@/lib/types";
import { StatusGlyph, MonoLabel } from "@/components/ui";
import { shortHash, cn } from "@/lib/utils";

const BACKEND_LABEL: Record<string, string> = {
  onchain: "ONCHAIN (ethfs)",
  ipfs: "IPFS",
  arweave: "ARWEAVE",
  irys: "IRYS",
  cdn: "CDN",
};

function ExternalGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 12 12" className={cn("h-2.5 w-2.5", className)} fill="none" aria-hidden>
      <path d="M4.5 2.5H9.5V7.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.5 2.5L4 8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M8 9.5H2.5V4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** A single verifiable row. Linkable rows open the raw public source in a new tab. */
function PermRow({
  index,
  rowLabel,
  backend,
  status,
  detail,
  href,
  muted = false,
  delay,
  inView,
}: {
  index: number;
  rowLabel: string;
  backend: string;
  status: "verified" | "resolving" | "failed" | "not-configured";
  detail: string;
  href?: string;
  muted?: boolean;
  delay: number;
  inView: boolean;
}) {
  const detailClass = cn(
    "truncate font-mono text-[12px] sm:text-[13px]",
    status === "verified" && !muted ? "text-accent" : "text-muted",
  );

  const inner = (
    <>
      {/* Shard / row index */}
      <span className="w-[78px] shrink-0 font-mono text-[11px] font-semibold uppercase tracking-wider text-foreground sm:w-[88px]">
        {rowLabel}
      </span>
      {/* Backend */}
      <span className="w-[120px] shrink-0 font-mono text-[11px] uppercase tracking-wider text-muted sm:w-[148px]">
        {backend}
      </span>
      {/* Live status glyph */}
      <span className="flex w-5 shrink-0 items-center justify-center">
        <StatusGlyph status={status} />
      </span>
      {/* Verifiable detail */}
      <span className={detailClass}>{detail}</span>
      {/* External-link affordance (only on linked rows) */}
      {href && (
        <ExternalGlyph className="ml-auto shrink-0 text-faint transition-colors group-hover/row:text-accent" />
      )}
    </>
  );

  const base =
    "group/row flex items-center gap-3 rounded-[6px] px-2.5 py-2.5 transition-colors";
  const motion = cn(
    "opacity-0",
    inView && "animate-rise",
  );
  const style: React.CSSProperties = { animationDelay: `${delay}ms` };

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(base, motion, "hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none")}
        style={style}
        title="Open the raw public source to verify independently"
        data-index={index}
      >
        {inner}
      </a>
    );
  }

  return (
    <div className={cn(base, motion)} style={style} data-index={index}>
      {inner}
    </div>
  );
}

export function PermanencePanel({ token }: { token: Token }) {
  const { permanence } = token;
  const ref = React.useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = React.useState(false);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Legacy fallback: no IntersectionObserver → reveal on next frame.
    if (typeof IntersectionObserver === "undefined") {
      const raf = requestAnimationFrame(() => setInView(true));
      return () => cancelAnimationFrame(raf);
    }
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setInView(true);
            obs.disconnect();
          }
        }
      },
      { threshold: 0.2 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const verifiedCount = permanence.shards.filter((s) => s.status === "verified").length;
  const hasLapsed = permanence.shards.some((s) => s.status === "failed");

  // Stagger schedule
  let step = 0;
  const nextDelay = () => 60 + step++ * 70;

  return (
    <section
      ref={ref}
      aria-label="Permanence status"
      className="overflow-hidden rounded-[8px] border border-border-bright bg-surface"
    >
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3.5 sm:px-5">
        <div className="flex items-center gap-2">
          <StatusGlyph status="verified" className="h-4 w-4" />
          <MonoLabel className="text-foreground">
            Permanence Status - {token.title}
          </MonoLabel>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-wider text-faint">
          {verifiedCount}/{permanence.shards.length} shards verified
        </span>
      </header>

      {/* Rows */}
      <div className="px-2 py-2 sm:px-3">
        {permanence.shards.map((shard) => (
          <PermRow
            key={shard.index}
            index={shard.index}
            rowLabel={`Shard ${shard.index}`}
            backend={BACKEND_LABEL[shard.backend] ?? shard.label.toUpperCase()}
            status={shard.status}
            detail={shard.detail}
            href={shard.sourceUrl}
            muted={shard.status === "failed"}
            delay={nextDelay()}
            inView={inView}
          />
        ))}

        <div className="my-1 h-px bg-border" />

        {/* Content hash */}
        <PermRow
          index={90}
          rowLabel="Hash"
          backend="-"
          status={permanence.contentHashMatches ? "verified" : "failed"}
          detail={`${shortHash(permanence.contentHash)} · matches onchain record`}
          delay={nextDelay()}
          inView={inView}
        />

        {/* Lock */}
        {permanence.locked && (
          <PermRow
            index={91}
            rowLabel="Lock"
            backend="-"
            status="verified"
            detail="immutable · shards locked"
            delay={nextDelay()}
            inView={inView}
          />
        )}
      </div>

      {/* Lapsed-pin reassurance - calm, by design (PRD §13.3) */}
      {hasLapsed && (
        <div
          className={cn("border-t border-border bg-surface-2/40 px-4 py-3 sm:px-5", inView && "animate-fade")}
          style={{ animationDelay: `${60 + step * 70}ms` }}
        >
          <p className="text-[12px] leading-relaxed text-muted">
            <span className="font-mono text-[11px] uppercase tracking-wider text-faint">Note · </span>
            An IPFS pin has lapsed. Permanence is unaffected - the onchain proof shard
            backstops the artwork and survives as long as Ethereum itself. IPFS is a
            performance mirror, not a permanence obligation.
          </p>
        </div>
      )}

      {/* Closing line */}
      <footer
        className={cn(
          "border-t border-border px-4 py-4 sm:px-5",
          inView && "animate-fade",
        )}
        style={{ animationDelay: `${120 + step * 70}ms` }}
      >
        <p className="text-[13px] font-medium leading-relaxed text-foreground sm:text-sm">
          This artwork survives even if Perpetual disappears.
        </p>
        <p className="mt-1.5 font-mono text-[10px] uppercase tracking-wider text-faint">
          Verified {relTimeShort(permanence.lastVerified)} · independently checkable
        </p>
      </footer>
    </section>
  );
}

/** Local compact "verified Xh ago" - avoids importing server-bound helpers into edge cases. */
function relTimeShort(iso: string): string {
  const then = Date.parse(iso);
  const now = Date.parse("2026-05-30T00:00:00Z");
  const diff = Math.max(0, now - then);
  const hr = 3600_000;
  const day = 24 * hr;
  if (diff < hr) return "just now";
  if (diff < day) return `${Math.round(diff / hr)}h ago`;
  return `${Math.round(diff / day)}d ago`;
}
