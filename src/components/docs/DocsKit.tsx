import * as React from "react";
import { MonoLabel, StatusGlyph } from "@/components/ui";
import { cn } from "@/lib/utils";

/**
 * Small presentational kit for the documentation hub. All server-rendered.
 * These exist to keep /docs/page.tsx readable: consistent section heads,
 * mono technical terms, hairline callouts, and the labelled rows the docs reuse.
 */

// A documentation section: anchored heading + numbered eyebrow over a hairline.
export function DocSection({
  id,
  index,
  eyebrow,
  title,
  lede,
  children,
}: {
  id: string;
  index: string;
  eyebrow: string;
  title: string;
  lede?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="border-b border-border pb-5">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] tabular-nums text-accent">{index}</span>
          <MonoLabel className="text-faint">{eyebrow}</MonoLabel>
        </div>
        <h2 className="mt-3 font-brand text-[24px] font-semibold leading-tight tracking-[-0.01em] text-foreground sm:text-[30px]">
          {title}
        </h2>
        {lede && (
          <p className="mt-4 max-w-2xl text-[16px] leading-relaxed text-muted">{lede}</p>
        )}
      </div>
      <div className="mt-7 space-y-5 text-[15px] leading-relaxed text-muted">{children}</div>
    </section>
  );
}

// Inline monospace technical term (SSTORE2, ERC-2981, CID, shard 0, ...).
export function Term({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <code
      className={cn(
        "rounded-[4px] border border-border bg-surface px-1.5 py-0.5 font-mono text-[0.85em] text-foreground",
        className,
      )}
    >
      {children}
    </code>
  );
}

// A quiet, bordered callout. Accent variant for the load-bearing pledges only.
export function Callout({
  label,
  accent = false,
  children,
}: {
  label: string;
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <aside
      className={cn(
        "rounded-[10px] border bg-surface p-5 sm:p-6",
        accent ? "border-accent/30" : "border-border",
      )}
    >
      <div className="flex items-center gap-2">
        {accent && <StatusGlyph status="verified" />}
        <MonoLabel className={accent ? "text-accent" : "text-faint"}>{label}</MonoLabel>
      </div>
      <p className="mt-3 text-[15px] leading-relaxed text-muted">{children}</p>
    </aside>
  );
}

// A labelled definition row used in lists (e.g. shard table, swap types).
export function DefRow({
  term,
  children,
  glyph,
}: {
  term: React.ReactNode;
  children: React.ReactNode;
  glyph?: React.ReactNode;
}) {
  return (
    <div className="grid gap-2 border-b border-border py-4 last:border-b-0 sm:grid-cols-[200px_1fr] sm:gap-6">
      <div className="flex items-center gap-2">
        {glyph}
        <span className="font-mono text-[13px] text-foreground">{term}</span>
      </div>
      <p className="text-[15px] leading-relaxed text-muted">{children}</p>
    </div>
  );
}
