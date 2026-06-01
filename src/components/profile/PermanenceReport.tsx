"use client";

/**
 * PermanenceReport - the profile's signature portfolio-health dashboard.
 *
 * A premium, on-brand report over the connected wallet's holdings:
 *  - Hero: overall grade + average score from portfolioPermanence(ownedTokens),
 *    with a confident headline ("Your collection is graded A+. 100% of your works
 *    are provably permanent.").
 *  - Breakdown: fully-permanent vs any at-risk counts, total verified shards, and a
 *    reassuring note that even a lapsed IPFS pin stays permanent via the onchain proof.
 *  - Per-work list: every owned token with a grade pill, title, verified-shard count,
 *    linking to the token.
 *
 * All numerics are mono. Accent pink is reserved for an A+ grade. Pure presentation
 * over data passed in as props; permanenceScore/portfolioPermanence are SSR-safe
 * accessors, but this renders inside the client ProfileTabs shell.
 */
import { useMemo } from "react";
import Link from "next/link";
import type { Token } from "@/lib/types";
import { permanenceScore, portfolioPermanence } from "@/lib/permanence";
import { GenerativeArt } from "@/components/art/GenerativeArt";
import { MonoLabel, EmptyState, ButtonLink } from "@/components/ui";
import { cn } from "@/lib/utils";

type Grade = "A+" | "A" | "B" | "C" | "D";

/** A+ earns the surgical accent; everything else stays calm and monochrome. */
function gradeTone(grade: Grade): string {
  switch (grade) {
    case "A+":
      return "border-accent/40 bg-accent/10 text-accent";
    case "A":
      return "border-verify/30 bg-verify/10 text-verify";
    case "B":
      return "border-border-bright bg-surface-2 text-foreground";
    default:
      return "border-border-bright bg-surface-2 text-muted";
  }
}

function GradePill({ grade, className }: { grade: Grade; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full border px-2 py-0.5 font-mono text-[11px] font-semibold tabular-nums leading-none",
        gradeTone(grade),
        className,
      )}
    >
      {grade}
    </span>
  );
}

export function PermanenceReport({ tokens, loading }: { tokens: Token[]; loading?: boolean }) {
  const report = useMemo(() => {
    const summary = portfolioPermanence(tokens);
    const rows = tokens
      .map((t) => {
        const s = permanenceScore(t);
        const verifiedShards = t.permanence.shards.filter(
          (sh) => sh.status === "verified",
        ).length;
        return { token: t, score: s, verifiedShards };
      })
      .sort((a, b) => b.score.score - a.score.score);

    const fullyPermanent = rows.filter(
      (r) => r.token.permanence.onchainProofConfigured && r.token.permanence.contentHashMatches,
    ).length;
    const totalVerifiedShards = rows.reduce((n, r) => n + r.verifiedShards, 0);
    const permanentPct =
      tokens.length === 0 ? 100 : Math.round((fullyPermanent / tokens.length) * 100);

    return { summary, rows, fullyPermanent, totalVerifiedShards, permanentPct };
  }, [tokens]);

  if (loading) {
    return (
      <div role="status" aria-label="Computing permanence report" className="flex flex-col gap-6">
        <div className="h-40 animate-pulse rounded-[10px] border border-border bg-surface" />
        <div className="h-16 animate-pulse rounded-[10px] border border-border bg-surface" />
        <div className="h-48 animate-pulse rounded-[10px] border border-border bg-surface" />
      </div>
    );
  }

  if (tokens.length === 0) {
    return (
      <EmptyState
        title="No works to grade yet"
        body="Once you hold a work, its permanence report appears here: an overall grade, redundant copy count, and a per-work breakdown, each provably durable the day you own it and in twenty years."
        action={
          <ButtonLink href="/explore" variant="secondary" size="md">
            Explore the catalog
          </ButtonLink>
        }
      />
    );
  }

  const { summary, rows, fullyPermanent, totalVerifiedShards, permanentPct } = report;
  const grade = summary.grade as Grade;
  const allPermanent = summary.allPermanent;

  const headline = allPermanent
    ? `Your collection is graded ${grade}. ${permanentPct}% of your works are provably permanent.`
    : `Your collection is graded ${grade}. ${permanentPct}% of your works are provably permanent, the rest stay anchored onchain.`;

  return (
    <div className="flex flex-col gap-6">
      {/* Hero: overall grade + average score */}
      <section className="overflow-hidden rounded-[10px] border border-border bg-surface">
        <div className="flex flex-col gap-6 p-5 sm:flex-row sm:items-center sm:gap-7 sm:p-7">
          {/* Grade dial */}
          <div className="flex items-center gap-5">
            <GradeDial grade={grade} score={summary.avg} />
            <div className="min-w-0">
              <MonoLabel className="text-faint">Collection grade</MonoLabel>
              <div className="mt-1.5 flex items-baseline gap-2">
                <span
                  className={cn(
                    "font-brand text-[40px] font-semibold leading-none tracking-[-0.02em] sm:text-[48px]",
                    grade === "A+" ? "text-accent" : "text-foreground",
                  )}
                >
                  {grade}
                </span>
                <span className="font-mono text-sm tabular-nums text-muted">
                  {summary.avg}/100 avg
                </span>
              </div>
            </div>
          </div>

          {/* Confident line */}
          <div className="min-w-0 flex-1 sm:border-l sm:border-border sm:pl-7">
            <p className="text-[15px] font-medium leading-relaxed text-foreground sm:text-base">
              {headline}
            </p>
            <p className="mt-2 text-[13px] leading-relaxed text-muted">
              Every work is hash-anchored onchain and kept across independent shards. The
              guarantee holds even if Perpetual disappears.
            </p>
          </div>
        </div>

        {/* Breakdown strip */}
        <dl className="grid grid-cols-3 gap-px border-t border-border bg-border">
          <Stat
            label="Fully permanent"
            value={`${fullyPermanent}/${tokens.length}`}
            tone={fullyPermanent === tokens.length ? "accent" : "default"}
          />
          <Stat
            label="At risk"
            value={String(summary.atRisk)}
            tone={summary.atRisk > 0 ? "warn" : "verify"}
          />
          <Stat label="Verified shards" value={String(totalVerifiedShards)} />
        </dl>
      </section>

      {/* Reassurance note */}
      <div className="flex items-start gap-3 rounded-[10px] border border-verify/20 bg-verify/[0.04] px-4 py-3.5">
        <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center text-verify" aria-hidden>
          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none">
            <path d="M3.5 8.5l3 3 6-6.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <p className="text-[13px] leading-relaxed text-muted">
          A lapsed IPFS pin or an offline gateway never breaks a work here. Each token carries
          an onchain proof of its content hash, so it remains provably permanent and fully
          recoverable from its parallel copies.
        </p>
      </div>

      {/* Per-work list */}
      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <MonoLabel className="text-muted">Per-work grades</MonoLabel>
          <span className="rounded-full bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-faint">
            {rows.length}
          </span>
        </div>

        <ul className="overflow-hidden rounded-[10px] border border-border">
          {rows.map(({ token: t, score: s, verifiedShards }) => (
            <li key={t.id}>
              <Link
                href={`/token/${t.id}`}
                className="flex items-center gap-3 border-b border-border bg-surface px-3 py-3 transition-colors last:border-b-0 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-inset sm:gap-4 sm:px-4"
              >
                <span className="h-11 w-11 shrink-0 overflow-hidden rounded-[8px] border border-border-bright bg-surface-2 sm:h-12 sm:w-12">
                  <GenerativeArt seed={t.artSeed} genre={t.genre} size={48} className="h-full w-full" />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{t.title}</p>
                  <p className="mt-0.5 font-mono text-[11px] tabular-nums text-faint">
                    {verifiedShards} verified {verifiedShards === 1 ? "shard" : "shards"}
                    {t.permanence.locked ? " · locked" : ""}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2.5">
                  <span className="hidden font-mono text-[11px] tabular-nums text-muted sm:inline">
                    {s.score}/100
                  </span>
                  <GradePill grade={s.grade} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "accent" | "verify" | "warn";
}) {
  const valueClass =
    tone === "accent"
      ? "text-accent"
      : tone === "verify"
        ? "text-verify"
        : tone === "warn"
          ? "text-muted"
          : "text-foreground";
  return (
    <div className="bg-background px-4 py-4">
      <dt className="label-mono text-faint">{label}</dt>
      <dd className={cn("mt-2 font-mono text-lg tabular-nums", valueClass)}>{value}</dd>
    </div>
  );
}

/** A quiet circular score dial. A+ rings accent; otherwise a calm verify ring. */
function GradeDial({ grade, score }: { grade: Grade; score: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const dash = c * pct;
  const ringColor = grade === "A+" ? "text-accent" : grade === "D" || grade === "C" ? "text-muted" : "text-verify";

  return (
    <span className="relative inline-flex h-[68px] w-[68px] shrink-0 items-center justify-center" aria-hidden>
      <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90">
        <circle cx="32" cy="32" r={r} className="text-border" stroke="currentColor" strokeWidth="4" fill="none" />
        <circle
          cx="32"
          cy="32"
          r={r}
          className={cn(ringColor, "transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none")}
          stroke="currentColor"
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
        />
      </svg>
      <span className="absolute font-mono text-[13px] font-semibold tabular-nums text-foreground">{score}</span>
    </span>
  );
}
