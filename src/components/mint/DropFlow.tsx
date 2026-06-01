"use client";

/**
 * DropFlow — the "Collection drop" mint path (bulk PFP / generative).
 *
 * Flow: ZIP dropzone → client-side validation preview (count, sample
 * thumbnails, trait summary) → server processing (pin folders + provenance,
 * polled) → on-chain steps (createDrop → commitProvenance → mintBatch chunks →
 * reveal) → success linking to the new drop's collection page.
 *
 * Gated on getContracts(chainId).factory. The whole path renders a clean
 * "not available on this network" notice when no factory is set, and surfaces a
 * clean error (no crash) if the deployed factory lacks createDrop.
 */
import * as React from "react";
import { useChainId } from "wagmi";
import { unzipSync } from "fflate";
import { Button, MonoLabel, Badge, Surface } from "@/components/ui";
import { cn } from "@/lib/utils";
import { useWallet, connectWallet } from "@/lib/wallet";
import { getContracts, chainLabelForId, explorerTx } from "@/lib/web3/contracts";
import { validateDropEntries, type ValidationResult } from "@/lib/drops/validate";
import { MAX_DROP_SIZE } from "@/lib/drops/provenance";
import { useDropProcessing, useDropMint } from "./useDropMint";

type Stage = "configure" | "review" | "processing" | "onchain" | "done";

function deriveSymbol(name: string): string {
  return name.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8) || "DROP";
}

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|avif)$/i;

export function DropFlow() {
  const chainId = useChainId();
  const wallet = useWallet();
  const contracts = getContracts(chainId);
  const factoryAvailable = Boolean(contracts.factory);

  const proc = useDropProcessing();
  const drop = useDropMint();

  const [stage, setStage] = React.useState<Stage>("configure");
  const [name, setName] = React.useState("");
  const [royaltyPct, setRoyaltyPct] = React.useState(7.5);
  const [file, setFile] = React.useState<File>();
  const [validation, setValidation] = React.useState<ValidationResult>();
  const [thumbs, setThumbs] = React.useState<string[]>([]);
  const [previewError, setPreviewError] = React.useState<string>();
  const [parsing, setParsing] = React.useState(false);

  // Clean up object URLs.
  React.useEffect(() => {
    return () => thumbs.forEach((u) => URL.revokeObjectURL(u));
  }, [thumbs]);

  async function onPickFile(f: File) {
    setPreviewError(undefined);
    setFile(f);
    setParsing(true);
    thumbs.forEach((u) => URL.revokeObjectURL(u));
    setThumbs([]);
    try {
      const buf = new Uint8Array(await f.arrayBuffer());
      const files = unzipSync(buf);
      const entries = Object.entries(files).map(([path, bytes]) => ({
        path: path.replace(/\\/g, "/"),
        bytes,
      }));
      const v = validateDropEntries(entries);
      setValidation(v);

      // A few sample thumbnails from the validated tokens (first 6 images).
      const sample = v.tokens.slice(0, 6).filter((t) => IMAGE_EXT.test(t.imagePath));
      const urls = sample.map((t) => {
        const part: BlobPart = t.imageBytes as unknown as BlobPart;
        return URL.createObjectURL(new Blob([part]));
      });
      setThumbs(urls);
      setStage("review");
    } catch {
      setPreviewError("Could not read that file as a ZIP archive.");
      setValidation(undefined);
    } finally {
      setParsing(false);
    }
  }

  async function runProcessing() {
    if (!file) return;
    setStage("processing");
    const result = await proc.process(file);
    if (result) setStage("onchain");
    // on failure, proc.error is shown; stage stays processing with a retry.
  }

  async function runOnchain() {
    if (!proc.result) return;
    if (!wallet.connected) {
      connectWallet();
      return;
    }
    const finalPhase = await drop.start({
      name: name.trim(),
      symbol: deriveSymbol(name.trim()),
      royaltyBps: Math.round(Math.min(Math.max(royaltyPct, 0), 100) * 100),
      processed: proc.result,
      placeholderBaseURI: proc.result.metadataBaseURI, // placeholder == real folder; reveal re-asserts it
    });
    // start() resolves with phase "done" on success (incl. reveal-skipped); on
    // failure it leaves "error" and we stay on the on-chain stage to retry.
    if (finalPhase === "done") setStage("done");
  }

  function resetAll() {
    thumbs.forEach((u) => URL.revokeObjectURL(u));
    setThumbs([]);
    setFile(undefined);
    setValidation(undefined);
    setName("");
    setRoyaltyPct(7.5);
    setStage("configure");
    proc.reset();
    drop.reset();
  }

  // ── Not available on this network ──────────────────────────────────────────
  if (!factoryAvailable) {
    return (
      <div className="rounded-[8px] border border-border bg-surface-2/40 p-5">
        <MonoLabel className="text-faint">Collection drop</MonoLabel>
        <p className="mt-2 text-[13px] leading-relaxed text-muted">
          Bulk drops are not available on {chainLabelForId(chainId)} yet — the drop factory is
          not deployed here. Switch to a supported network, or mint a 1-of-1 / edition instead.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      {/* Tier framing — honest about folder permanence */}
      <div className="flex items-start gap-3 rounded-[8px] border border-border bg-surface-2/40 px-4 py-3">
        <Badge tone="muted">Folder permanence</Badge>
        <p className="text-[12px] leading-relaxed text-muted">
          A drop stores the art + metadata in an IPFS folder anchored by one on-chain provenance
          hash. This is a distinct, lighter tier than the per-token 5-shard guarantee of 1-of-1s
          and editions — chosen so thousands of tokens can mint affordably.
        </p>
      </div>

      {stage === "configure" && (
        <ConfigureStage
          name={name}
          setName={setName}
          royaltyPct={royaltyPct}
          setRoyaltyPct={setRoyaltyPct}
          onPickFile={onPickFile}
          parsing={parsing}
          previewError={previewError}
        />
      )}

      {stage === "review" && validation && (
        <ReviewStage
          name={name}
          validation={validation}
          thumbs={thumbs}
          onBack={() => setStage("configure")}
          onContinue={runProcessing}
          canContinue={Boolean(name.trim()) && validation.ok && validation.count <= MAX_DROP_SIZE}
        />
      )}

      {stage === "processing" && (
        <ProcessingStage
          phase={proc.phase}
          uploadPct={proc.uploadPct}
          progress={proc.progress}
          step={proc.step}
          error={proc.error}
          onRetry={runProcessing}
          onContinue={() => setStage("onchain")}
          done={proc.phase === "done"}
        />
      )}

      {stage === "onchain" && proc.result && (
        <OnchainStage
          drop={drop}
          count={proc.result.count}
          provenanceHash={proc.result.provenanceHash}
          warnings={proc.result.warnings}
          connected={wallet.connected}
          chainId={chainId}
          onRun={runOnchain}
        />
      )}

      {stage === "done" && (
        <DoneStage drop={drop} chainId={chainId} onReset={resetAll} />
      )}
    </div>
  );
}

// ── Configure ────────────────────────────────────────────────────────────────
function ConfigureStage({
  name, setName, royaltyPct, setRoyaltyPct, onPickFile, parsing, previewError,
}: {
  name: string; setName: (v: string) => void;
  royaltyPct: number; setRoyaltyPct: (v: number) => void;
  onPickFile: (f: File) => void; parsing: boolean; previewError?: string;
}) {
  const [dragOver, setDragOver] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label htmlFor="drop-name" className="font-mono text-[11px] uppercase tracking-wider text-faint">
          Collection name
        </label>
        <input
          id="drop-name"
          type="text"
          value={name}
          maxLength={48}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Sovereign Apes"
          className="h-10 w-full rounded-[8px] border border-border bg-background px-3.5 text-sm text-foreground transition-colors placeholder:text-faint focus-visible:border-border-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="drop-royalty" className="font-mono text-[11px] uppercase tracking-wider text-faint">
          Royalty — {royaltyPct.toFixed(1)}%
        </label>
        <input
          id="drop-royalty"
          type="range"
          min={0}
          max={15}
          step={0.5}
          value={royaltyPct}
          onChange={(e) => setRoyaltyPct(Number(e.target.value))}
          className="w-full accent-accent"
        />
      </div>

      <div>
        <MonoLabel className="text-faint">Archive</MonoLabel>
        <p className="mt-1 text-[12px] leading-relaxed text-muted">
          One ZIP containing your images and OpenSea-style metadata JSON (e.g. <code>images/1.png</code> +{" "}
          <code>metadata/1.json</code>). Up to {MAX_DROP_SIZE.toLocaleString()} tokens.
        </p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) onPickFile(f);
          }}
          className={cn(
            "mt-3 flex w-full flex-col items-center justify-center gap-2 rounded-[8px] border border-dashed px-6 py-10 text-center transition-colors",
            dragOver ? "border-accent bg-accent/5" : "border-border hover:border-border-bright hover:bg-surface-2/40",
          )}
        >
          {parsing ? (
            <span className="inline-flex items-center gap-2 text-[13px] text-muted">
              <span className="inline-block h-2 w-2 rounded-full bg-verify animate-verify-pulse" aria-hidden />
              Reading archive…
            </span>
          ) : (
            <>
              <span className="text-[13px] text-foreground">Drop your ZIP here, or click to choose</span>
              <span className="font-mono text-[11px] text-faint">.zip · validated in your browser before upload</span>
            </>
          )}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".zip,application/zip,application/x-zip-compressed"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onPickFile(f);
          }}
        />
        {previewError && <p className="mt-2 text-[12px] text-error" role="alert">{previewError}</p>}
      </div>
    </div>
  );
}

// ── Review ───────────────────────────────────────────────────────────────────
function ReviewStage({
  name, validation, thumbs, onBack, onContinue, canContinue,
}: {
  name: string; validation: ValidationResult; thumbs: string[];
  onBack: () => void; onContinue: () => void; canContinue: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Badge tone={validation.ok ? "verify" : "default"}>
          {validation.ok ? "Valid" : "Has issues"}
        </Badge>
        <span className="font-mono text-[13px] tabular-nums text-foreground">
          {validation.count.toLocaleString()} {validation.count === 1 ? "token" : "tokens"}
        </span>
        {name.trim() && <span className="text-[13px] text-muted">· {name.trim()}</span>}
      </div>

      {validation.errors.length > 0 && (
        <div className="rounded-[8px] border border-error/30 bg-error/5 p-4">
          <MonoLabel className="text-error">Errors</MonoLabel>
          <ul className="mt-2 space-y-1 text-[12px] text-error">
            {validation.errors.slice(0, 6).map((e, i) => <li key={i}>{e}</li>)}
            {validation.errors.length > 6 && <li>(+{validation.errors.length - 6} more)</li>}
          </ul>
        </div>
      )}
      {validation.warnings.length > 0 && (
        <div className="rounded-[8px] border border-border bg-surface-2/40 p-4">
          <MonoLabel className="text-faint">Warnings</MonoLabel>
          <ul className="mt-2 space-y-1 text-[12px] text-muted">
            {validation.warnings.slice(0, 4).map((w, i) => <li key={i}>{w}</li>)}
            {validation.warnings.length > 4 && <li>(+{validation.warnings.length - 4} more)</li>}
          </ul>
        </div>
      )}

      {thumbs.length > 0 && (
        <div>
          <MonoLabel className="text-faint">Sample</MonoLabel>
          <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-6">
            {thumbs.map((u, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={u} alt={`Sample ${i + 1}`} className="aspect-square w-full rounded-[6px] border border-border object-cover" />
            ))}
          </div>
        </div>
      )}

      {validation.traitSummary.length > 0 && (
        <div>
          <MonoLabel className="text-faint">Traits</MonoLabel>
          <div className="mt-3 space-y-2">
            {validation.traitSummary.slice(0, 8).map((t) => (
              <div key={t.trait_type} className="flex items-baseline justify-between gap-3 border-b border-border pb-1.5">
                <span className="text-[13px] text-foreground">{t.trait_type}</span>
                <span className="font-mono text-[11px] text-faint">
                  {Object.keys(t.values).length} {Object.keys(t.values).length === 1 ? "value" : "values"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 pt-1">
        <Button variant="ghost" size="md" onClick={onBack}>Back</Button>
        <Button variant="accent" size="lg" onClick={onContinue} disabled={!canContinue}>
          Process &amp; pin
        </Button>
      </div>
      {!canContinue && !validation.ok && (
        <p className="text-right font-mono text-[11px] text-faint">Fix the errors above to continue.</p>
      )}
      {!canContinue && validation.ok && !name.trim() && (
        <p className="text-right font-mono text-[11px] text-faint">Add a collection name to continue.</p>
      )}
    </div>
  );
}

// ── Processing ─────────────────────────────────────────────────────────────────
function ProcessingStage({
  phase, uploadPct, progress, step, error, onRetry, onContinue, done,
}: {
  phase: string; uploadPct: number; progress: number; step: string;
  error?: string; onRetry: () => void; onContinue: () => void; done: boolean;
}) {
  const pct = phase === "uploading" ? uploadPct : progress;
  const label =
    phase === "uploading" ? `Uploading archive… ${uploadPct}%`
    : phase === "processing" ? `Processing: ${step.replace(/-/g, " ")}… ${progress}%`
    : phase === "done" ? "Pinned to IPFS · provenance computed"
    : phase === "error" ? "Processing failed" : "Working…";

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3" role="status" aria-live="polite">
        {phase === "error" ? (
          <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-error" aria-hidden />
        ) : (
          <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-verify animate-verify-pulse" aria-hidden />
        )}
        <p className="text-sm text-foreground">{label}</p>
      </div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2"
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Drop processing progress"
      >
        <div className="h-full rounded-full bg-accent transition-all duration-300" style={{ width: `${Math.max(2, pct)}%` }} />
      </div>
      {error && (
        <div className="rounded-[8px] border border-error/30 bg-error/5 p-4" role="alert">
          <p className="text-[12px] text-error">{error}</p>
          <Button variant="secondary" size="sm" className="mt-3" onClick={onRetry}>Retry</Button>
        </div>
      )}
      {done && (
        <div className="flex justify-end">
          <Button variant="accent" size="lg" onClick={onContinue}>Continue to mint</Button>
        </div>
      )}
    </div>
  );
}

// ── On-chain ─────────────────────────────────────────────────────────────────
type DropMintHook = ReturnType<typeof useDropMint>;

const STEP_ROWS: { phase: DropPhaseKey; label: string }[] = [
  { phase: "creating", label: "Deploy drop contract (createDrop)" },
  { phase: "committing", label: "Commit provenance hash" },
  { phase: "minting", label: "Batch-mint supply (≤5,000 / tx)" },
  { phase: "revealing", label: "Reveal metadata folder" },
];
type DropPhaseKey = "creating" | "committing" | "minting" | "revealing";
const ORDER: DropPhaseKey[] = ["creating", "committing", "minting", "revealing"];

function OnchainStage({
  drop, count, provenanceHash, warnings, connected, chainId, onRun,
}: {
  drop: DropMintHook; count: number; provenanceHash: string;
  warnings?: string[]; connected: boolean; chainId: number; onRun: () => void;
}) {
  const active = drop.phase;
  const started = active !== "idle";
  const currentIdx = ORDER.indexOf(active as DropPhaseKey);

  function rowState(p: DropPhaseKey): "done" | "active" | "pending" {
    const idx = ORDER.indexOf(p);
    if (drop.phase === "done") return "done";
    if (currentIdx < 0) return "pending";
    if (idx < currentIdx) return "done";
    if (idx === currentIdx) return "active";
    return "pending";
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 text-[13px]">
        <div className="rounded-[8px] border border-border bg-surface-2/40 px-4 py-3">
          <MonoLabel className="text-faint">Supply</MonoLabel>
          <p className="mt-1 font-mono tabular-nums text-foreground">{count.toLocaleString()}</p>
        </div>
        <div className="rounded-[8px] border border-border bg-surface-2/40 px-4 py-3">
          <MonoLabel className="text-faint">Provenance</MonoLabel>
          <p className="mt-1 truncate font-mono text-[11px] text-muted">{provenanceHash}</p>
        </div>
      </div>

      {warnings && warnings.length > 0 && (
        <ul className="space-y-1 text-[12px] text-faint">
          {warnings.map((w, i) => <li key={i}>· {w}</li>)}
        </ul>
      )}

      <ul className="space-y-2.5" aria-live="polite">
        {STEP_ROWS.map((row) => {
          const st = rowState(row.phase);
          const isMint = row.phase === "minting";
          return (
            <li key={row.phase} className="flex items-center justify-between gap-3 rounded-[8px] border border-border bg-surface-2/40 px-4 py-3">
              <span className="text-[13px] text-foreground">{row.label}</span>
              <span className="font-mono text-[11px] uppercase tracking-wider">
                {st === "done" ? <span className="text-accent">done</span>
                  : st === "active" ? (
                    <span className="text-verify">
                      {isMint && drop.mintTotal > 0 ? `${drop.mintedSoFar.toLocaleString()}/${drop.mintTotal.toLocaleString()}` : "confirm in wallet…"}
                    </span>
                  ) : <span className="text-faint">pending</span>}
              </span>
            </li>
          );
        })}
      </ul>

      {drop.error && (
        <div className="rounded-[8px] border border-error/30 bg-error/5 p-4" role="alert">
          <p className="text-[12px] text-error">{drop.error}</p>
        </div>
      )}
      {drop.warning && <p className="text-[12px] text-faint" role="status">{drop.warning}</p>}

      {!started || drop.phase === "error" ? (
        <div className="flex flex-col items-end gap-1.5">
          {connected && (
            <span className="font-mono text-[10px] uppercase tracking-wider text-faint">
              Drop on {chainLabelForId(chainId)} · 4 wallet confirmations
            </span>
          )}
          <Button variant="accent" size="lg" onClick={onRun}>
            {!connected ? "Connect wallet to deploy" : drop.phase === "error" ? "Retry on-chain" : "Deploy & mint drop"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

// ── Done ─────────────────────────────────────────────────────────────────────
function DoneStage({ drop, chainId, onReset }: { drop: DropMintHook; chainId: number; onReset: () => void }) {
  const addr = drop.dropAddress;
  const collectionHref = addr ? `/collections/onchain/${chainId}/${addr}` : undefined;
  return (
    <Surface className="p-6 sm:p-8">
      <Badge tone="verify">Drop live</Badge>
      <h3 className="mt-3 text-xl font-medium text-foreground">Your collection is minted</h3>
      <p className="mt-2 max-w-[60ch] text-sm leading-relaxed text-muted">
        {drop.mintTotal.toLocaleString()} tokens batch-minted to your wallet, provenance committed,
        and the metadata folder revealed.
      </p>
      {drop.warning && <p className="mt-2 text-[12px] text-faint">{drop.warning}</p>}
      {addr && <p className="mt-4 break-all font-mono text-[11px] text-faint">{addr}</p>}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        {collectionHref && (
          <a href={collectionHref} className="inline-flex h-12 items-center rounded-[8px] bg-accent px-6 text-[15px] font-medium text-background transition-colors hover:bg-accent-dim">
            View collection
          </a>
        )}
        {drop.createTx && (
          <a href={explorerTx(chainId, drop.createTx)} target="_blank" rel="noreferrer" className="font-mono text-[12px] text-muted underline-offset-2 hover:text-foreground hover:underline">
            Deploy tx
          </a>
        )}
        {drop.revealTx && (
          <a href={explorerTx(chainId, drop.revealTx)} target="_blank" rel="noreferrer" className="font-mono text-[12px] text-muted underline-offset-2 hover:text-foreground hover:underline">
            Reveal tx
          </a>
        )}
        <Button variant="ghost" size="md" onClick={onReset}>Start another</Button>
      </div>
    </Surface>
  );
}
