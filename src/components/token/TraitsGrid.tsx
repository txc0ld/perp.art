/**
 * TraitsGrid - hairline trait cards (design prompt §4.3). Key (mono label), value,
 * and rarity as a mono percentage.
 */
import type { Trait } from "@/lib/types";

export function TraitsGrid({ traits }: { traits: Trait[] }) {
  if (traits.length === 0) return null;
  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {traits.map((t) => (
          <div
            key={t.key}
            className="rounded-[8px] border border-border bg-surface px-4 py-3 transition-colors hover:border-border-bright"
          >
            <p className="font-mono text-[10px] uppercase tracking-wider text-faint">{t.key}</p>
            <p className="mt-1.5 truncate text-sm font-medium text-foreground">{t.value}</p>
            {typeof t.rarity === "number" && (
              <p className="mt-1 font-mono text-[11px] tabular-nums text-accent">
                {(t.rarity * 100).toFixed(0)}% have this
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
