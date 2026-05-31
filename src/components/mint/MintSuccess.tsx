"use client";

import * as React from "react";
import type { ShardOption } from "@/lib/types";
import { cn, hashSeed, shortHash } from "@/lib/utils";
import { MediaPreview } from "./MediaPreview";
import { Button, ButtonLink, MonoLabel, Badge, Divider, StatusGlyph } from "@/components/ui";
import { explorerTx } from "@/lib/web3/contracts";
import type { ShardRecord } from "./useOnchainMint";

const REAL_SHARD_LABEL: Record<string, string> = {
  onchain: "Onchain STATE (SSTORE2)",
  log: "Onchain LOG (high-res)",
  ipfs: "IPFS",
  arweave: "Arweave",
  irys: "Irys",
};
import type { MintForm } from "./state";
import { previewSeed } from "./state";

/** Deterministic fabricated id/hashes from the form so the success screen is stable. */
function deriveTokenArtifacts(form: MintForm) {
  const seed = previewSeed(form);
  const h = hashSeed(seed);
  const hex = (n: number, len: number) => {
    const r = ((): string => {
      let a = n >>> 0;
      let out = "";
      while (out.length < len) {
        a = (Math.imul(a ^ (a >>> 15), 1 | a) + 0x6d2b79f5) >>> 0;
        out += (a % 16).toString(16);
      }
      return out;
    })();
    return r.slice(0, len);
  };
  return {
    tokenId: 100 + (h % 900),
    txHash: "0x" + hex(h ^ 0x9e3779b9, 64),
    contentHash: "0x" + hex(h ^ 0x85ebca6b, 64),
  };
}

type Phase = "writing" | "done";

export function MintSuccess({
  form,
  shardOptions,
  onReset,
  txHash,
  chainId,
  tokenId,
  shards,
}: {
  form: MintForm;
  shardOptions: ShardOption[];
  onReset: () => void;
  /** Set when the mint was a real on-chain transaction. */
  txHash?: `0x${string}`;
  chainId?: number;
  tokenId?: string;
  shards?: ShardRecord[];
}) {
  const seed = previewSeed(form);
  const artifacts = React.useMemo(() => deriveTokenArtifacts(form), [form]);
  const selected = React.useMemo(
    () => shardOptions.filter((o) => form.enabledShards[o.backend]),
    [shardOptions, form.enabledShards],
  );

  const [phase, setPhase] = React.useState<Phase>("writing");
  // how many shards have "verified" so far during the writing stagger
  const [verified, setVerified] = React.useState(0);

  React.useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduce) {
      // Defer to a callback so we don't setState synchronously in the effect body
      // (keeps SSR-correct initial render, no hydration mismatch).
      const t = setTimeout(() => {
        setVerified(selected.length);
        setPhase("done");
      }, 0);
      return () => clearTimeout(t);
    }

    const timers: ReturnType<typeof setTimeout>[] = [];
    selected.forEach((_, i) => {
      timers.push(setTimeout(() => setVerified(i + 1), 600 + i * 520));
    });
    timers.push(
      setTimeout(() => setPhase("done"), 600 + selected.length * 520 + 500),
    );
    return () => timers.forEach(clearTimeout);
  }, [selected]);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
      {/* Artwork */}
      <div className="space-y-3">
        <div
          className={cn(
            "overflow-hidden rounded-[8px] border transition-all duration-700",
            phase === "done" ? "border-accent/40" : "border-border-bright",
          )}
        >
          <MediaPreview
            url={form.fileUrl}
            mime={form.fileMime}
            seed={seed}
            genre={form.genre}
            className="aspect-square w-full object-contain bg-surface-2"
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="truncate text-sm text-foreground">{form.title || "Untitled"}</span>
          <span className="font-mono text-[11px] text-faint">#{tokenId ?? artifacts.tokenId}</span>
        </div>
      </div>

      {/* Status */}
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          {phase === "writing" ? (
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-verify animate-verify-pulse" aria-hidden />
          ) : (
            <span className="flex h-6 w-6 items-center justify-center rounded-full border border-accent/40 bg-accent/10">
              <StatusGlyph status="verified" />
            </span>
          )}
          <div>
            <h2 className="display-sm text-balance text-foreground">
              {phase === "writing" ? "Writing provenance onchain…" : "Committed to permanence"}
            </h2>
            {phase === "done" && (
              <p className="mt-1 text-sm text-muted animate-fade">
                The record is written and replicated. Your work endures, even if Perpetual does not.
              </p>
            )}
          </div>
        </div>

        {/* Shards verifying in a stagger */}
        <div className="rounded-[8px] border border-border bg-surface-2/40 p-5">
          <MonoLabel className="text-faint">Permanence shards</MonoLabel>
          <ul className="mt-3 space-y-2.5">
            {shards
              ? shards.map((s, i) => (
                  <li key={s.backend} className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2.5">
                      <span className="font-mono text-[10px] text-faint tabular-nums">SHARD {i}</span>
                      <span className="font-mono text-[13px] text-foreground">{REAL_SHARD_LABEL[s.backend]}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      {s.gateway && (
                        <a
                          href={s.gateway}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-[10px] uppercase tracking-wider text-faint underline-offset-2 transition-colors hover:text-accent hover:underline"
                        >
                          view
                        </a>
                      )}
                      <span className="font-mono text-[11px] uppercase tracking-wider">
                        {s.recorded ? (
                          <span className="text-accent">onchain</span>
                        ) : s.stored ? (
                          <span className="text-verify">stored</span>
                        ) : (
                          <span className="text-faint">{/not set|not configured/i.test(s.error || "") ? "not set" : "skipped"}</span>
                        )}
                      </span>
                      {(s.recorded || s.stored) && <StatusGlyph status="verified" />}
                    </span>
                  </li>
                ))
              : selected.map((o, i) => {
                  const isVerified = i < verified;
                  return (
                    <li key={o.backend} className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2.5">
                        <span className="font-mono text-[10px] text-faint tabular-nums">SHARD {i}</span>
                        <span className="font-mono text-[13px] text-foreground">{o.label}</span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        {isVerified ? (
                          <>
                            <span className="font-mono text-[11px] text-muted animate-fade">
                              {o.mandatory ? "stored onchain" : "confirmed"}
                            </span>
                            <StatusGlyph status="verified" />
                          </>
                        ) : (
                          <span className="font-mono text-[11px] text-faint">writing…</span>
                        )}
                      </span>
                    </li>
                  );
                })}
          </ul>
        </div>

        {phase === "done" && (
          <div className="space-y-4 animate-rise">
            <div className="divide-y divide-border">
              {txHash ? (
                <div className="flex items-center justify-between gap-4 py-2.5">
                  <MonoLabel className="text-faint">Transaction</MonoLabel>
                  <div className="flex items-center gap-4">
                    {tokenId && chainId && (
                      <a
                        href={`/token/onchain/${chainId}/${tokenId}`}
                        className="font-mono text-[11px] uppercase tracking-wider text-accent underline-offset-2 hover:underline"
                      >
                        View your token →
                      </a>
                    )}
                    <a
                      href={explorerTx(chainId, txHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 font-mono text-[13px] tabular-nums text-accent transition-colors hover:text-foreground"
                    >
                      {shortHash(txHash, 10)}
                      <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" aria-hidden>
                        <path d="M6 3h7v7M13 3L6.5 9.5M11 9.5V13H3V5h3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </a>
                  </div>
                </div>
              ) : (
                <>
                  <Detail label="Token ID" value={`#${artifacts.tokenId}`} />
                  <Detail label="Tx hash" value={shortHash(artifacts.txHash, 10)} title={artifacts.txHash} />
                  <Detail label="Content hash" value={shortHash(artifacts.contentHash, 10)} title={artifacts.contentHash} />
                </>
              )}
              <div className="flex items-center justify-between py-2.5">
                <MonoLabel className="text-faint">Lock status</MonoLabel>
                {form.lockShards ? (
                  <Badge tone="accent">Locked · immutable</Badge>
                ) : (
                  <Badge tone="muted">Unlocked</Badge>
                )}
              </div>
            </div>

            <Divider />

            <div className="flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/explore" variant="accent" size="lg" className="flex-1">
                View the work
              </ButtonLink>
              <Button variant="secondary" size="lg" onClick={onReset} className="flex-1">
                Mint another
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Detail({
  label,
  value,
  title,
}: {
  label: string;
  value: string;
  title?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <MonoLabel className="text-faint">{label}</MonoLabel>
      <span className="font-mono text-[13px] tabular-nums text-foreground" title={title}>
        {value}
      </span>
    </div>
  );
}
