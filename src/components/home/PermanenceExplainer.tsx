/**
 * PermanenceExplainer - "How permanence works" band (design prompt §4.1, §5).
 * A stylized, CSS-only stacked-shard diagram: one token fans out into four
 * parallel immutable copies, backstopped by an onchain proof. Mono labels,
 * hairline surfaces, and the signature closing line.
 */
import { Section, Surface, MonoLabel, StatusGlyph, ButtonLink, Divider } from "@/components/ui";
import { Reveal } from "./Reveal";
import { SectionHeader } from "./SectionHeader";

const SHARDS: Array<{ idx: string; backend: string; detail: string; mandatory?: boolean }> = [
  { idx: "Shard 0", backend: "Onchain (ethfs)", detail: "Permanent backstop · survives as long as Ethereum", mandatory: true },
  { idx: "Shard 1", backend: "IPFS", detail: "Content-addressed · CID matches hash" },
  { idx: "Shard 2", backend: "Arweave", detail: "Pay-once permanent · confirmed forever" },
  { idx: "Shard 3", backend: "Irys", detail: "Independent network · confirmed" },
];

export function PermanenceExplainer() {
  return (
    <Section id="permanence" className="border-y border-border bg-surface/30">
      <Reveal>
        <SectionHeader
          eyebrow="How permanence works"
          title="One artwork. Four immutable copies."
          note="At mint, the work is written to four independent storage backends in parallel and anchored by an onchain content hash. Any single backend can vanish; the proof and the redundancy remain."
        />
      </Reveal>

      <div className="mt-12 grid grid-cols-1 items-center gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
        {/* Diagram - token → parallel shards → onchain backstop */}
        <Reveal>
          <div className="relative mx-auto w-full max-w-sm">
            {/* the token */}
            <div className="relative z-10 mx-auto mb-8 w-fit">
              <div className="rounded-[8px] border border-border-bright bg-surface px-5 py-3 text-center shadow-[0_20px_50px_-30px_rgba(0,0,0,0.9)]">
                <p className="font-mono text-[10px] uppercase tracking-wider text-faint">Token</p>
                <p className="mt-1 text-sm font-medium text-foreground">Artifact #1a</p>
              </div>
            </div>

            {/* connecting lines */}
            <div aria-hidden className="relative -mt-4 mb-2 h-6">
              <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-gradient-to-b from-border-bright to-transparent" />
            </div>

            {/* stacked parallel shards */}
            <div className="relative space-y-2.5">
              {SHARDS.map((s, i) => (
                <div
                  key={s.idx}
                  className="flex items-center gap-3 rounded-[8px] border border-border bg-surface px-4 py-3"
                  style={{
                    marginLeft: `${i * 6}px`,
                    marginRight: `${(SHARDS.length - 1 - i) * 6}px`,
                  }}
                >
                  <StatusGlyph status="verified" />
                  <span className="font-mono text-[11px] uppercase tracking-wider text-foreground">{s.backend}</span>
                  {s.mandatory ? (
                    <span className="ml-auto rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-accent">
                      Backstop
                    </span>
                  ) : null}
                </div>
              ))}
            </div>

            {/* hash anchor */}
            <div className="mt-5 flex items-center justify-center gap-2">
              <StatusGlyph status="verified" />
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
                Content hash matches onchain record
              </span>
            </div>
          </div>
        </Reveal>

        {/* The verifiable rows + closing line */}
        <Reveal delay={120}>
          <Surface className="overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-6 py-4">
              <MonoLabel className="text-faint">Permanence status</MonoLabel>
              <span className="inline-flex items-center gap-1.5">
                <StatusGlyph status="verified" />
                <span className="font-mono text-[10px] uppercase tracking-wider text-accent">Verified</span>
              </span>
            </div>
            <Divider />
            <ul>
              {SHARDS.map((s) => (
                <li
                  key={s.idx}
                  className="flex items-start gap-3 border-b border-border px-6 py-3.5 last:border-b-0"
                >
                  <StatusGlyph status="verified" className="mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono text-[11px] uppercase tracking-wider text-muted">{s.idx}</span>
                      <span className="text-sm font-medium text-foreground">{s.backend}</span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-faint">{s.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
            <Divider />
            <div className="space-y-4 px-6 py-5">
              <p className="text-[15px] font-medium leading-relaxed text-foreground">
                This artwork survives even if Perpetual disappears.
              </p>
              <ButtonLink href="/permanence" variant="ghost" size="sm" className="px-0 hover:bg-transparent hover:text-accent">
                Read the full permanence model
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none">
                  <path d="M3 8h9M9 4.5L12.5 8 9 11.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </ButtonLink>
            </div>
          </Surface>
        </Reveal>
      </div>
    </Section>
  );
}

export default PermanenceExplainer;
