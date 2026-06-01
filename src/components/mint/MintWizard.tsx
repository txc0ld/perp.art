"use client";

import * as React from "react";
import { appKitModal } from "@/components/web3/Web3Provider";
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
import { CollectionStep } from "./CollectionStep";
import { DropFlow } from "./DropFlow";
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
    blurb: "Layer independent permanent backends behind a consensus-guaranteed STATE shard.",
  },
  lock: {
    eyebrow: "Step 04 · Lock",
    title: "Seal it, if you wish",
    blurb: "Optionally freeze the work so it can never be altered.",
  },
  collection: {
    eyebrow: "Step 05 · Collection",
    title: "Choose where it lives",
    blurb: "Mint into the open shared collection, or into a sovereign contract you own outright.",
  },
  review: {
    eyebrow: "Step 06 · Review",
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

  // When the rendered screen changes (next/back step, busy, success), reset the
  // viewport to the top — otherwise on mobile the page stays scrolled down and
  // the next step's content is below the fold.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  }, [stepIndex, minted, busy]);

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
    // connected chain.
    if (onchain.canMintOnchain) {
      await onchain.start(form);
      return;
    }
    // No Perpetual contracts on the connected chain (e.g. a mainnet): open the
    // network picker to switch to a supported testnet. Uses the AppKit modal,
    // which keeps the WalletConnect session across the mobile app-switch — a raw
    // switchChain can drop the session on mobile.
    appKitModal?.open({ view: "Networks" });
  };

  const reset = () => {
    setForm(initialForm(shardOptions, genres));
    setStepIndex(0);
    setFurthest(0);
    setMinted(false);
    onchain.reset();
  };

  const isDrop = form.mintType === "drop";
  // The drop path is a distinct flow (its own wallet steps), so we only show the
  // mode toggle when we're not mid-mint / not on the success screen.
  const showModeToggle = !minted && !busy;

  const PHASE_LABEL: Record<string, string> = {
    storing:
      onchain.uploadPct > 0 && onchain.uploadPct < 100
        ? `Uploading the artwork… ${onchain.uploadPct}%`
        : "Pinning to IPFS / Arweave / Irys and publishing LOG shard…",
    minting: form.mintType === "edition"
      ? `Minting edition of ${form.editionSize}. Confirm in your wallet…`
      : "Writing provenance + STATE shard (SSTORE2). Confirm in your wallet…",
    recording: form.mintType === "edition" && onchain.recordingProgress
      ? `Recording shards (${onchain.recordingProgress.done}/${onchain.recordingProgress.total}). Confirm in your wallet…`
      : "Recording shard descriptors onchain. Confirm in your wallet…",
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

      {/* Mode toggle: the guided 1-of-1 / Edition wizard vs the bulk Collection drop flow. */}
      {showModeToggle && (
        <div className="mb-8">
          <MonoLabel className="text-faint">What are you minting?</MonoLabel>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ModeOption
              selected={!isDrop}
              onSelect={() => set({ mintType: "single", editionSize: 1 })}
              title="1-of-1 or Edition"
              subtitle="Per-token 5-shard permanence · the guided flow"
            />
            <ModeOption
              selected={isDrop}
              onSelect={() => set({ mintType: "drop" })}
              title="Collection drop"
              subtitle="Bulk PFP / generative · folder permanence"
            />
          </div>
        </div>
      )}

      {isDrop ? (
        <Surface className="p-6 sm:p-8 lg:p-10">
          <div className="mb-7">
            <MonoLabel className="text-faint">Collection drop</MonoLabel>
            <h2 className="mt-2 text-xl font-medium text-foreground sm:text-2xl">Release a bulk collection</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">
              Upload one archive, deploy a dedicated batch-mint contract, commit a provenance hash,
              mint the supply, and reveal — OpenSea-compatible.
            </p>
          </div>
          <DropFlow />
        </Surface>
      ) : (
      <>
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
            contract={onchain.mintedContract}
          />
        ) : busy ? (
          <div className="space-y-7">
            <div className="flex items-center gap-3" role="status" aria-live="polite">
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
              {step.key === "collection" && (
                <CollectionStep form={form} set={set} />
              )}
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
                  <span role="alert" aria-live="assertive" className="max-w-[280px] text-right font-mono text-[11px] leading-tight text-error">
                    {onchain.error}
                  </span>
                )}
                {wallet.connected && (
                  <span className="font-mono text-[10px] uppercase tracking-wider text-faint">
                    {onchain.canMintOnchain
                      ? `Onchain mint on ${chainLabelForId(onchain.chainId)}`
                      : "Wrong network — switch to Ethereum Sepolia for a real mint"}
                  </span>
                )}
                <Button variant="accent" size="lg" onClick={handleMint}>
                  {!wallet.connected
                    ? "Connect wallet to mint"
                    : onchain.canMintOnchain
                      ? "Mint onchain"
                      : "Switch network"}
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
      </>
      )}
    </div>
  );
}

/** Top-level mint-mode selector card (guided wizard vs bulk drop). */
function ModeOption({
  selected, onSelect, title, subtitle,
}: {
  selected: boolean; onSelect: () => void; title: string; subtitle: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex flex-col items-start rounded-[8px] border px-4 py-4 text-left transition-colors",
        selected ? "border-accent/50 bg-accent/5" : "border-border bg-transparent hover:border-border-bright hover:bg-surface-2/40",
      )}
    >
      <span className={cn("text-sm font-medium", selected ? "text-accent" : "text-foreground")}>{title}</span>
      <span className="mt-0.5 text-[12px] text-faint">{subtitle}</span>
    </button>
  );
}

const SHARD_LABEL: Record<string, string> = {
  onchain: "STATE shard (SSTORE2)",
  log: "LOG shard (LogLedger)",
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
