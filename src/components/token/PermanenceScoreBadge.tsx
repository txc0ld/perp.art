/**
 * PermanenceScoreBadge - a compact grade pill that sits beside the token title.
 *
 * A hairline pill carrying the mono grade from `permanenceScore(token)`. A+/A earn
 * the surgical accent (the work is provably permanent); lower grades stay muted.
 * Server-safe: pure render off a pure accessor, no interactivity.
 */
import type { Token } from "@/lib/types";
import { permanenceScore } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export function PermanenceScoreBadge({
  token,
  className,
}: {
  token: Token;
  className?: string;
}) {
  const { grade, score } = permanenceScore(token);
  const earnsAccent = grade === "A+" || grade === "A";

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 leading-none",
        earnsAccent
          ? "border-accent/30 bg-accent/10 text-accent"
          : "border-border bg-transparent text-muted",
        className,
      )}
      title={`Permanence grade ${grade} · ${score}/100`}
    >
      <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-faint">
        Grade
      </span>
      <span className="font-mono text-[12px] font-semibold tabular-nums">
        {grade}
      </span>
    </span>
  );
}
