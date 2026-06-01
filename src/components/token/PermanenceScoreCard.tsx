/**
 * PermanenceScoreCard - the authoritative read on how durable this token is.
 *
 * Shows the score out of 100, the letter grade, and the labelled factor
 * checklist from `permanenceScore(token).factors` (each with a status glyph),
 * closed by a one-line plain-language explanation. Built to feel like a credit
 * rating for permanence: calm, exact, reassuring. Server-safe (pure accessor).
 */
import type { Token } from "@/lib/types";
import { permanenceScore } from "@/lib/permanence";
import { StatusGlyph } from "@/components/ui";
import { cn } from "@/lib/utils";

const GRADE_BLURB: Record<string, string> = {
  "A+": "Exemplary. Backed onchain and mirrored across every independent permanent network.",
  A: "Strong. Anchored onchain with broad redundancy across permanent backends.",
  B: "Solid. The onchain proof holds; redundancy could be deepened.",
  C: "Adequate. Permanence is guaranteed onchain, with limited mirrors.",
  D: "Minimal redundancy. The onchain proof still backstops the work.",
};

export function PermanenceScoreCard({
  token,
  className,
}: {
  token: Token;
  className?: string;
}) {
  const { score, grade, factors, redundancy } = permanenceScore(token);
  const earnsAccent = grade === "A+" || grade === "A";

  return (
    <section
      aria-label="Permanence score"
      className={cn(
        "overflow-hidden rounded-[10px] border border-border-bright bg-surface",
        className,
      )}
    >
      {/* Score + grade header */}
      <div className="flex items-stretch gap-0 border-b border-border">
        {/* Big grade block */}
        <div
          className={cn(
            "flex w-[112px] shrink-0 flex-col items-center justify-center border-r border-border px-4 py-5 sm:w-[132px]",
            earnsAccent ? "bg-accent/[0.06]" : "bg-surface-2/40",
          )}
        >
          <span
            className={cn(
              "font-mono text-[40px] font-semibold leading-none tabular-nums sm:text-[48px]",
              earnsAccent ? "text-accent" : "text-foreground",
            )}
          >
            {grade}
          </span>
          <span className="mt-2 font-mono text-[10px] uppercase tracking-wider text-faint">
            Permanence
          </span>
        </div>

        {/* Score / 100 + meter */}
        <div className="flex min-w-0 flex-1 flex-col justify-center px-4 py-5 sm:px-5">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-[26px] font-semibold leading-none tabular-nums text-foreground">
              {score}
            </span>
            <span className="font-mono text-[13px] tabular-nums text-faint">/ 100</span>
          </div>
          {/* Hairline meter */}
          <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-surface-2">
            <div
              className={cn("h-full rounded-full", earnsAccent ? "bg-accent" : "bg-border-bright")}
              style={{ width: `${score}%` }}
            />
          </div>
          <p className="mt-3 text-[12px] leading-relaxed text-muted">
            {GRADE_BLURB[grade] ?? GRADE_BLURB.D}
          </p>
        </div>
      </div>

      {/* Factor checklist */}
      <ul className="divide-y divide-border">
        {factors.map((f) => (
          <li
            key={f.label}
            className="flex items-center gap-3 px-4 py-3 sm:px-5"
          >
            <span className="flex w-4 shrink-0 items-center justify-center">
              <StatusGlyph status={f.ok ? "verified" : "failed"} />
            </span>
            <span
              className={cn(
                "min-w-0 flex-1 text-[13px]",
                f.ok ? "text-foreground" : "text-muted",
              )}
            >
              {f.label}
            </span>
            {f.detail && (
              <span className="shrink-0 font-mono text-[11px] uppercase tracking-wider text-faint">
                {f.detail}
              </span>
            )}
          </li>
        ))}
      </ul>

      {/* Plain explanation */}
      <div className="border-t border-border bg-surface-2/40 px-4 py-3.5 sm:px-5">
        <p className="text-[12px] leading-relaxed text-muted">
          <span className="font-mono text-[11px] uppercase tracking-wider text-faint">
            In plain terms ·{" "}
          </span>
          The grade weighs the onchain proof first, then how many independent
          permanent copies back it up ({redundancy} here) and whether the shards
          are locked. The onchain proof alone guarantees survival; redundancy
          makes it effortless.
        </p>
      </div>
    </section>
  );
}
