"use client";

/**
 * DeployContractModal - spins up a new sovereign Forever Library contract over a
 * near-black scrim. Mirrors the BuyModal pattern: role=dialog/aria-modal, Esc to
 * close, focus trap, body-scroll lock. Three phases: review -> deploying ->
 * optimistic success with a fabricated contract address. On success the deployed
 * contract is lifted to the parent via onDeployed so the list updates. Full-width
 * and scrollable on mobile.
 */
import * as React from "react";
import { Button } from "@/components/ui";
import { shortAddress, bpsToPct, cn } from "@/lib/utils";

type Phase = "review" | "deploying" | "done";
type Chain = "ethereum" | "base";

function fabricateAddress(name: string): string {
  let h = 0x811c9dc5;
  const s = "deploy:" + name + ":" + Date.now();
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  let out = "0x";
  let seed = h;
  for (let i = 0; i < 40; i++) {
    seed = (Math.imul(seed ^ (seed >>> 13), 0x5bd1e995) + i) >>> 0;
    out += (seed & 0xf).toString(16);
  }
  return out;
}

export interface DeployedContract {
  name: string;
  chain: Chain;
  royaltyBps: number;
  contractAddress: string;
}

export function DeployContractModal({
  onClose,
  onDeployed,
}: {
  onClose: () => void;
  onDeployed: (contract: DeployedContract) => void;
}) {
  const [phase, setPhase] = React.useState<Phase>("review");
  const [name, setName] = React.useState("");
  const [chain, setChain] = React.useState<Chain>("ethereum");
  const [royaltyPct, setRoyaltyPct] = React.useState(10);
  const [address, setAddress] = React.useState<string | null>(null);
  const dialogRef = React.useRef<HTMLDivElement | null>(null);

  const nameError = name.trim().length === 0;

  React.useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLInputElement>("[data-autofocus]")?.focus();
    return () => opener?.focus?.();
  }, []);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "Tab" && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input, select, [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  function deploy() {
    if (nameError) return;
    const royaltyBps = Math.round(royaltyPct * 100);
    const addr = fabricateAddress(name.trim());
    setAddress(addr);
    setPhase("deploying");
    window.setTimeout(() => {
      onDeployed({ name: name.trim(), chain, royaltyBps, contractAddress: addr });
      setPhase("done");
    }, 1800);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && phase !== "deploying") onClose();
      }}
    >
      <div className="absolute inset-0 bg-background/85 backdrop-blur-sm animate-fade" aria-hidden />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="deploy-title"
        className="animate-rise relative max-h-[90vh] w-full max-w-[480px] overflow-y-auto rounded-[10px] border border-border-bright bg-surface shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <span id="deploy-title" className="label-mono text-foreground">
            {phase === "done" ? "Contract deployed" : "Deploy sovereign contract"}
          </span>
          <button
            type="button"
            onClick={onClose}
            disabled={phase === "deploying"}
            className="flex h-11 w-11 items-center justify-center rounded-[8px] text-faint transition-colors hover:text-foreground disabled:opacity-30"
            aria-label="Close"
          >
            <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden>
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5">
          {phase === "done" && address ? (
            <div className="animate-fade">
              <div className="flex items-center gap-2.5 rounded-[8px] border border-verify/25 bg-verify/10 px-4 py-3">
                <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-verify" aria-hidden />
                <p className="text-[13px] text-foreground">
                  Deployed. This Forever Library contract is yours outright.
                </p>
              </div>
              <dl className="mt-4 space-y-2.5 border-t border-border pt-4">
                <Line label="Name" value={name.trim()} strong />
                <Line label="Chain" value={chain === "ethereum" ? "Ethereum Mainnet" : "Base"} />
                <Line label="Royalty" value={bpsToPct(Math.round(royaltyPct * 100))} />
                <div className="flex items-baseline justify-between">
                  <span className="font-mono text-[11px] uppercase tracking-wider text-faint">Address</span>
                  <a
                    href={`https://etherscan.io/address/${address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-[13px] tabular-nums text-accent hover:underline"
                  >
                    {shortAddress(address)}
                  </a>
                </div>
              </dl>
              <Button variant="secondary" size="md" className="mt-5 min-h-[44px] w-full" onClick={onClose}>
                Done
              </Button>
            </div>
          ) : (
            <>
              <p className="text-[13px] leading-relaxed text-muted">
                Deploy your own ERC-721 + ERC-2981 Forever Library. Perpetual never
                holds the keys. Leave whenever you like and take it fully intact.
              </p>

              <div className="mt-5 flex flex-col gap-1.5">
                <label htmlFor="deploy-name" className="font-mono text-[11px] uppercase tracking-wider text-faint">
                  Contract name
                </label>
                <input
                  id="deploy-name"
                  data-autofocus
                  type="text"
                  value={name}
                  maxLength={42}
                  disabled={phase === "deploying"}
                  onChange={(e) => setName(e.target.value)}
                  aria-invalid={nameError}
                  aria-describedby={nameError ? "deploy-name-error" : undefined}
                  className={cn(
                    "h-11 w-full rounded-[8px] border bg-background px-3.5 text-sm text-foreground transition-colors placeholder:text-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
                    nameError ? "border-[#fda4af]/50" : "border-border focus-visible:border-border-bright",
                  )}
                  placeholder="e.g. Sovereign Editions"
                />
                {nameError && (
                  <p id="deploy-name-error" className="text-[12px] text-[#fda4af]">
                    A contract name is required.
                  </p>
                )}
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="deploy-chain" className="font-mono text-[11px] uppercase tracking-wider text-faint">
                    Chain
                  </label>
                  <select
                    id="deploy-chain"
                    value={chain}
                    disabled={phase === "deploying"}
                    onChange={(e) => setChain(e.target.value as Chain)}
                    className="h-11 w-full rounded-[8px] border border-border bg-background px-3.5 text-sm text-foreground transition-colors focus-visible:border-border-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                  >
                    <option value="ethereum">Ethereum Mainnet</option>
                    <option value="base">Base</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="deploy-royalty" className="font-mono text-[11px] uppercase tracking-wider text-faint">
                    Royalty %
                  </label>
                  <input
                    id="deploy-royalty"
                    type="number"
                    min={0}
                    max={20}
                    step={0.5}
                    value={royaltyPct}
                    disabled={phase === "deploying"}
                    onChange={(e) => setRoyaltyPct(Math.max(0, Math.min(20, Number(e.target.value) || 0)))}
                    className="h-11 w-full rounded-[8px] border border-border bg-background px-3.5 font-mono text-sm tabular-nums text-foreground transition-colors focus-visible:border-border-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                  />
                </div>
              </div>

              <ul className="mt-5 space-y-1.5">
                <Reassure>Deployed under your wallet. Perpetual cannot freeze or seize it.</Reassure>
                <Reassure>Royalties enforced at settlement via ERC-2981.</Reassure>
              </ul>

              <Button
                variant="accent"
                size="lg"
                className="mt-5 min-h-[44px] w-full"
                onClick={deploy}
                disabled={phase === "deploying" || nameError}
              >
                {phase === "deploying" ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="inline-block h-2 w-2 animate-verify-pulse rounded-full bg-background" aria-hidden />
                    Deploying…
                  </span>
                ) : (
                  "Deploy contract"
                )}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Line({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="font-mono text-[11px] uppercase tracking-wider text-faint">{label}</span>
      <span className={cn("font-mono text-[13px] tabular-nums", strong ? "text-foreground" : "text-muted")}>
        {value}
      </span>
    </div>
  );
}

function Reassure({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-[12px] leading-snug text-muted">
      <span className="mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full bg-accent" aria-hidden />
      {children}
    </li>
  );
}
