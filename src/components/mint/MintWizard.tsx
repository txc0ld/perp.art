"use client";

import * as React from "react";
import type { Genre, ShardOption } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useWallet, connectWallet } from "@/lib/wallet";
import { useOnchainMint, type ShardRecord } from "./useOnchainMint";
import { chainLabelForId } from "@/lib/web3/contracts";
import { Button, MonoLabel, Surface } from "@/components/ui";
import { Stepper } from "./Stepper";
import { UploadStep } from "./UploadStep";
import { RoyaltyStep } from "./RoyaltyStep";
import { PermanenceStep } from "./PermanenceStep";
import { LockStep } from "./LockStep";
import { ReviewStep } from "./ReviewStep";
import { MintSuccess } from "./MintSuccess";
import {
  STEPS,
  initialForm,
  stepValid,
  type MintForm,
  type StepKey,
} from "./state";

const STEP_COPY: Record<StepKey, { title: string; eyebrow: string; blurb: string }> = {
  upload: {
    eyebrow: "Step 01 · Artwork",
    title: "Begin with the work",
    blurb: "The art, and the handful of facts that will travel with it forever.",
  },
  royalty: {
    eyebrow: "Step 02 · Royalty",
    title: "Claim your royalty",
    blurb: "Your share of every future sale, enforced at the protocol level.",
  },
  permanence: {
    eyebrow: "Step 03 · Permanence",
    title: "Choose how it endures",
    blurb: "Layer independent permanent backends behind a single onchain proof.",
  },
  lock: {
    eyebrow: "Step 04 · Lock",
    title: "Seal it, if you wish",
    blurb: "Optionally freeze the work so it can never be altered.",
  },
  review: {
    eyebrow: "Step 05 · Review",
    title: "Confirm and commit",
    blurb: "A last look at the record, then it becomes permanent.",
  },
};

export function MintWizard({
  shardOptions,
  genres,
}: {
  shardOptions: ShardOption[];
  genres: Genre[];
}) {
  const wallet = useWallet();
  const onchain = useOnchainMint();
  const [form, setForm] = React.useState<MintForm>(() =>
    initialForm(shardOptions, genres),
  );
  const [stepIndex, setStepIndex] = React.useState(0);
  const [furthest, setFurthest] = React.useState(0);
  const [minted, setMinted] = React.useState(false);

  const set = React.useCallback((patch: Partial<MintForm>) => {
    setForm((f) => ({ ...f, ...patch }));
  }, []);

  const busy =
    onchain.phase === "storing" ||
    onchain.phase === "minting" ||
    onchain.phase === "recording";

  // Advance to the success screen once the on-chain sequence completes.
  React.useEffect(() => {
    if (onchain.phase === "done") {
      const t = setTimeout(() => setMinted(true), 0);
      return () => clearTimeout(t);
    }
  }, [onchain.phase]);

  const step = STEPS[stepIndex];
  const copy = STEP_COPY[step.key];
  const canAdvance = stepValid(step.key, form);
  const isLast = stepIndex === STEPS.length - 1;

  const goTo = (i: number) => {
    if (i < 0 || i > STEPS.length - 1) return;
    setStepIndex(i);
    setFurthest((f) => Math.max(f, i));
  };

  const next = () => {
    if (!canAdvance) return;
    goTo(stepIndex + 1);
  };
  const back = () => goTo(stepIndex - 1);

  const handleMint = async () => {
    if (!wallet.connected) {
      connectWallet();
      return;
    }
    // Real, multi-shard on-chain mint when a contract is deployed on the
    // connected chain; otherwise a simulated mint (mainnets have none yet).
    if (onchain.canMintOnchain) {
      await onchain.start(form);
      return;
    }
    setMinted(true);
  };

  const reset = () => {
    setForm(initialForm(shardOptions, genres));
    setStepIndex(0);
    setFurthest(0);
    setMinted(false);
    onchain.reset();
  };

  const PHASE_LABEL: Record<string, string> = {
    storing:
      onchain.uploadPct > 0 && onchain.uploadPct < 100
        ? `Uploading the artwork… ${onchain.uploadPct}%`
        : "Storing the artwork across shards (IPFS / Arweave / Irys)…",
    minting: "Writing provenance + the onchain proof. Confirm in your wallet…",
    recording: "Recording each shard onchain. Confirm in your wallet…",
  };

  return (
    <div className="mx-auto w-full max-w-[920px] px-6 sm:px-8">
      {/* Header */}
      <header className="mb-8">
        <MonoLabel className="text-accent">Mint · Forever Library</MonoLabel>
        <h1 className="display-sm mt-3 text-balance text-foreground">
          {minted ? "Committed to permanence" : "Commit a work to permanence"}
        </h1>
        <p className="mt-2 max-w-[60ch] text-sm leading-relaxed text-muted">
          {minted
            ? "Provenance recorded onchain and replicated across independent permanent backends."
            : "A calm, guided flow. Each step lays down part of a record built to outlast everything, including us."}
        </p>
      </header>

      {!minted && !busy && (
        <div className="mb-8">
          <Stepper current={stepIndex} furthest={furthest} onJump={goTo} />
        </div>
      )}

      {/* Focused surface per step */}
      <Surface className="p-6 sm:p-8 lg:p-10">
        {minted ? (
          <MintSuccess
            form={form}
            shardOptions={shardOptions}
            onReset={reset}
            txHash={onchain.mintTxHash}
            chainId={onchain.chainId}
            tokenId={onchain.tokenId}
            shards={onchain.shards.length ? onchain.shards : undefined}
          />
        ) : busy ? (
          <div className="space-y-7">
            <div className="flex items-center gap-3">
              <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-verify animate-verify-pulse" aria-hidden />
              <p className="text-sm text-foreground">{PHASE_LABEL[onchain.phase]}</p>
            </div>
            <ShardProgress shards={onchain.shards} />
          </div>
        ) : (
          <>
            <div className="mb-7">
              <MonoLabel className="text-faint">{copy.eyebrow}</MonoLabel>
              <h2 className="mt-2 text-xl font-medium text-foreground sm:text-2xl">
                {copy.title}
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{copy.blurb}</p>
            </div>

            <div key={step.key} className="animate-fade">
              {step.key === "upload" && (
                <UploadStep form={form} set={set} genres={genres} />
              )}
              {step.key === "royalty" && <RoyaltyStep form={form} set={set} />}
              {step.key === "permanence" && (
                <PermanenceStep form={form} set={set} shardOptions={shardOptions} />
              )}
              {step.key === "lock" && <LockStep form={form} set={set} />}
              {step.key === "review" && (
                <ReviewStep form={form} shardOptions={shardOptions} />
              )}
            </div>
          </>
        )}
      </Surface>

      {/* Footer controls */}
      {!minted && !busy && (
        <div className="mt-6 flex items-center justify-between gap-4">
          <Button
            variant="ghost"
            size="md"
            onClick={back}
            disabled={stepIndex === 0}
            className={cn(stepIndex === 0 && "invisible")}
          >
            <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden>
              <path d="M10 3.5L5.5 8l4.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back
          </Button>

          <div className="flex items-center gap-3">
            {step.key === "upload" && !canAdvance && (
              <span className="font-mono text-[11px] leading-tight text-faint">
                Add artwork, title, and artist to continue
              </span>
            )}

            {isLast ? (
              <div className="flex flex-col items-end gap-1.5">
                {onchain.error && (
                  <span className="max-w-[280px] text-right font-mono text-[11px] leading-tight text-[#fda4af]">
                    {onchain.error}
                  </span>
                )}
                {wallet.connected && (
                  <span className="font-mono text-[10px] uppercase tracking-wider text-faint">
                    {onchain.canMintOnchain
                      ? `Onchain mint on ${chainLabelForId(onchain.chainId)}`
                      : "Simulated — switch to Base Sepolia or Ethereum Sepolia for a real mint"}
                  </span>
                )}
                <Button variant="accent" size="lg" onClick={handleMint}>
                  {!wallet.connected
                    ? "Connect wallet to mint"
                    : onchain.canMintOnchain
                      ? "Mint onchain"
                      : "Mint to permanence"}
                  <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden>
                    <path d="M3 8h9m0 0L8 4m4 4l-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Button>
              </div>
            ) : (
              <Button variant="primary" size="lg" onClick={next} disabled={!canAdvance}>
                Continue
                <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden>
                  <path d="M6 3.5L10.5 8 6 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const SHARD_LABEL: Record<string, string> = {
  onchain: "Onchain proof (ethfs)",
  ipfs: "IPFS",
  arweave: "Arweave",
  irys: "Irys",
};

/** Live per-shard storage + on-chain recording status. */
export function ShardProgress({ shards }: { shards: ShardRecord[] }) {
  return (
    <ul className="space-y-2.5">
      {shards.map((s) => (
        <li
          key={s.backend}
          className="flex items-center justify-between gap-3 rounded-[8px] border border-border bg-surface-2/40 px-4 py-3"
        >
          <span className="font-mono text-[13px] text-foreground">{SHARD_LABEL[s.backend]}</span>
          <span className="font-mono text-[11px] uppercase tracking-wider">
            {s.recorded ? (
              <span className="text-accent">recorded onchain</span>
            ) : s.stored ? (
              <span className="text-verify">stored</span>
            ) : (
              <span className="text-faint">
                {s.error && /not set|not configured/i.test(s.error) ? "not configured" : "skipped"}
              </span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
