/**
 * ShardDiagram - the URI sharding model rendered as a layered CSS diagram
 * (PRD §7.2). No images. Five shard planes; Shard 0 (STATE/SSTORE2) is the
 * load-bearing onchain backstop and is visually emphasized as the permanence
 * guarantor.
 *
 * Server component - static, no interactivity.
 */
import { Badge, MonoLabel, StatusGlyph } from "@/components/ui";
import { cn } from "@/lib/utils";

type Shard = {
  index: number;
  name: string;
  backend: string;
  plain: string;
  detail: string;
  mandatory?: boolean;
};

const SHARDS: Shard[] = [
  {
    index: 0,
    name: "STATE",
    backend: "SSTORE2",
    plain: "Low-res canonical image written on-chain as contract bytecode via SSTORE2. Content hash computed on-chain. Consensus-guaranteed — lives in contract state, cannot be pruned.",
    detail: "shard0Configured(tokenId) · mandatory · consensus-guaranteed",
    mandatory: true,
  },
  {
    index: 1,
    name: "LOG",
    backend: "LogLedger",
    plain: "Full-resolution primary copy stored in event logs via a standalone LogLedger contract (~8 gas/byte). Merkle root + size live in contract state; root-verifiable by anyone.",
    detail: "Merkle-verified · retention-monitored (EIP-4444) · not consensus-guaranteed",
  },
  {
    index: 2,
    name: "IPFS",
    backend: "content-addressed",
    plain: "Redundant off-chain copy, pinned via Pinata, addressed by the hash of its own content.",
    detail: "CID = hash(content) · auto-pinned · backstopped by STATE",
  },
  {
    index: 3,
    name: "Arweave",
    backend: "permaweb",
    plain: "Pay-once permanent storage on an independent network.",
    detail: "confirmed permanent · endowment-funded · independent of Perpetual",
  },
  {
    index: 4,
    name: "Irys",
    backend: "datachain",
    plain: "A second permanent off-chain network, for redundant independence.",
    detail: "confirmed · separate operator · separate failure domain",
  },
];

export function ShardDiagram() {
  return (
    <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
      {/* The layered visual */}
      <div className="relative mx-auto w-full max-w-md">
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-10 -z-10 opacity-50 blur-3xl"
          style={{
            background:
              "radial-gradient(closest-side, rgba(254,147,237,0.10), transparent)",
          }}
        />
        <div className="flex flex-col gap-3">
          {SHARDS.map((shard) => {
            const isBackstop = shard.mandatory;
            return (
              <div
                key={shard.index}
                className={cn(
                  "rounded-[8px] border bg-surface/80 px-4 py-3 backdrop-blur-sm transition-colors",
                  isBackstop
                    ? "border-accent/40 shadow-[0_20px_60px_-40px_rgba(254,147,237,0.5)]"
                    : "border-border",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <span
                    className={cn(
                      "font-mono text-[11px] font-semibold uppercase tracking-wider",
                      isBackstop ? "text-accent" : "text-muted",
                    )}
                  >
                    Shard {shard.index}
                  </span>
                  <span aria-hidden>
                    <StatusGlyph status="verified" />
                  </span>
                </div>
                <p className="mt-1.5 text-sm font-medium text-foreground">
                  {shard.name}
                  <span className="ml-2 font-mono text-[11px] font-normal lowercase text-faint">
                    {shard.backend}
                  </span>
                </p>
                {isBackstop ? (
                  <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-accent/80">
                    Permanence guarantor
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-center font-mono text-[10px] uppercase tracking-wider text-faint">
          Five parallel shards · one consensus-guaranteed STATE backstop
        </p>
      </div>

      {/* The plain-language legend */}
      <div className="flex flex-col divide-y divide-border border-y border-border">
        {SHARDS.map((shard) => (
          <div key={shard.index} className="py-5 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-center gap-3">
              <MonoLabel className="text-faint">Shard {shard.index}</MonoLabel>
              <span className="text-sm font-medium text-foreground">{shard.name}</span>
              {shard.mandatory ? (
                <Badge tone="accent">Mandatory</Badge>
              ) : (
                <Badge tone="muted">Redundant</Badge>
              )}
            </div>
            <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
              {shard.plain}
            </p>
            <p className="mt-2 font-mono text-[11px] text-faint">{shard.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ShardDiagram;
