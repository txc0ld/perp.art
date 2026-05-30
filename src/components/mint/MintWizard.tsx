"use client";

import * as React from "react";
import type { Genre, ShardOption } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useWallet, connectWallet } from "@/lib/wallet";
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
    title: "Upload your work",
    blurb: "The art, and the few facts that travel with it forever.",
  },
  royalty: {
    eyebrow: "Step 02 · Royalty",
    title: "Set your royalty",
    blurb: "Your share of every future sale - enforced at the protocol level.",
  },
  permanence: {
    eyebrow: "Step 03 · Permanence",
    title: "Configure permanence",
    blurb: "Layer independent permanent backends behind an onchain proof.",
  },
  lock: {
    eyebrow: "Step 04 · Lock",
    title: "Seal for immutability",
    blurb: "Optionally freeze the work so it can never change.",
  },
  review: {
    eyebrow: "Step 05 · Review",
    title: "Review and mint",
    blurb: "Confirm everything, then commit your work to permanence.",
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
  const [form, setForm] = React.useState<MintForm>(() =>
    initialForm(shardOptions, genres),
  );
  const [stepIndex, setStepIndex] = React.useState(0);
  const [furthest, setFurthest] = React.useState(0);
  const [minted, setMinted] = React.useState(false);

  const set = React.useCallback((patch: Partial<MintForm>) => {
    setForm((f) => ({ ...f, ...patch }));
  }, []);

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

  const handleMint = () => {
    if (!wallet.connected) {
      connectWallet();
      return;
    }
    setMinted(true);
  };

  const reset = () => {
    setForm(initialForm(shardOptions, genres));
    setStepIndex(0);
    setFurthest(0);
    setMinted(false);
  };

  return (
    <div className="mx-auto w-full max-w-[920px] px-6 sm:px-8">
      {/* Header */}
      <header className="mb-8">
        <MonoLabel className="text-accent">Mint · Forever Library</MonoLabel>
        <h1 className="display-sm mt-3 text-foreground">
          {minted ? "Minted to permanence" : "Commit a work to permanence"}
        </h1>
        <p className="mt-2 max-w-[60ch] text-sm leading-relaxed text-muted">
          {minted
            ? "Your provenance is recorded onchain and replicated across independent permanent backends."
            : "A calm, guided flow. Each step writes part of a record meant to outlast everything - including us."}
        </p>
      </header>

      {!minted && (
        <div className="mb-8">
          <Stepper current={stepIndex} furthest={furthest} onJump={goTo} />
        </div>
      )}

      {/* Focused surface per step */}
      <Surface className="p-6 sm:p-8 lg:p-10">
        {minted ? (
          <MintSuccess form={form} shardOptions={shardOptions} onReset={reset} />
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
      {!minted && (
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
              <span className="hidden font-mono text-[11px] text-faint sm:inline">
                Add artwork, title &amp; artist to continue
              </span>
            )}

            {isLast ? (
              <Button variant="accent" size="lg" onClick={handleMint}>
                {wallet.connected ? "Mint to permanence" : "Connect wallet"}
                <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden>
                  <path d="M3 8h9m0 0L8 4m4 4l-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Button>
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
