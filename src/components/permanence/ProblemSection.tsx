/**
 * ProblemSection - the storage-failure epidemic (PRD §2 framing): IPFS pins
 * expire, servers go offline, tokens point to nothing. Calm and factual, then
 * contrasted with Perpetual's onchain backstop. Server component.
 */
import { MonoLabel, StatusGlyph } from "@/components/ui";

const FAILURES: Array<{ mode: string; what: string; result: string }> = [
  {
    mode: "Pin lapses",
    what: "An IPFS pin stops being paid for.",
    result: "The CID is valid; no node serves it. The image is gone.",
  },
  {
    mode: "Server offline",
    what: "The hosting domain in the tokenURI expires.",
    result: "The metadata 404s. The token points to nothing.",
  },
  {
    mode: "Operator vanishes",
    what: "The marketplace that pinned the media shuts down.",
    result: "Everything they hosted disappears with them.",
  },
];

export function ProblemSection() {
  return (
    <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
      {/* The failure modes */}
      <div className="flex flex-col divide-y divide-border border-y border-border">
        {FAILURES.map((f) => (
          <div key={f.mode} className="py-5 first:pt-0 last:pb-0">
            <div className="flex items-center gap-2.5">
              <StatusGlyph status="failed" />
              <MonoLabel className="text-muted">{f.mode}</MonoLabel>
            </div>
            <p className="mt-2 text-sm text-foreground">{f.what}</p>
            <p className="mt-1 text-sm leading-relaxed text-faint">{f.result}</p>
          </div>
        ))}
      </div>

      {/* The contrast */}
      <div className="flex flex-col justify-center">
        <p className="text-[17px] leading-relaxed text-muted">
          Most NFTs are a pointer to a file held somewhere fragile. The token is
          permanent; the art it references is not. When the pin lapses or the
          server dies, the chain still says you own it, but there is nothing left
          to see.
        </p>
        <p className="mt-5 text-[17px] leading-relaxed text-foreground">
          Perpetual inverts the dependency. The artwork itself is written into
          Ethereum as a mandatory{" "}
          <span className="text-accent">onchain proof shard</span>. The other
          backends add resolution and redundancy. None of them is what keeps the
          art alive, so none of them can take it down.
        </p>
        <p className="mt-6 font-mono text-[11px] uppercase tracking-wider text-faint">
          tokenURI → fragile host&nbsp; · &nbsp;Perpetual → onchain content
        </p>
      </div>
    </div>
  );
}

export default ProblemSection;
