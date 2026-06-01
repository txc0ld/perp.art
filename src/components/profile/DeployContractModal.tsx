"use client";

/**
 * DeployContractModal — deploys a new sovereign Forever Library contract via the
 * connected wallet using the ForeverLibraryFactory. Three phases:
 *   review → deploying (wallet prompt + on-chain tx) → done (real address).
 * On success the real deployed address is lifted to the parent via onDeployed.
 * Full-width and scrollable on mobile. Esc to close, focus trap, body-scroll lock.
 */
import * as React from "react";
import { useAccount, useChainId } from "wagmi";
import { writeContract, waitForTransactionReceipt } from "@wagmi/core";
import { decodeEventLog } from "viem";
import { wagmiConfig } from "@/lib/web3/config";
import { getContracts, chainLabelForId, explorerTx } from "@/lib/web3/contracts";
import { FACTORY_ABI } from "@/lib/web3/abis";
import type { Chain } from "@/lib/types";
import { Button } from "@/components/ui";
import { shortAddress, cn } from "@/lib/utils";

type Phase = "review" | "deploying" | "done";

export interface DeployedContract {
  name: string;
  chain: Chain;
  royaltyBps: number;
  contractAddress: string;
}

/** Derive a short ERC-721 symbol from the collection name (≤8 chars, A-Z0-9). */
function deriveSymbol(name: string): string {
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8) || "COL";
}

/** Map chainId → the Chain string the rest of the app uses. */
function chainIdToChain(chainId: number): Chain {
  switch (chainId) {
    case 84532: return "ethereum"; // base-sepolia — mapped to "ethereum" (no separate Chain type entry)
    case 11155111: return "ethereum";
    case 8453: return "base";
    case 1: return "ethereum";
    default: return "ethereum";
  }
}

export function DeployContractModal({
  onClose,
  onDeployed,
}: {
  onClose: () => void;
  onDeployed: (contract: DeployedContract) => void;
}) {
  const { address } = useAccount();
  const chainId = useChainId();
  const contracts = getContracts(chainId);

  const [phase, setPhase] = React.useState<Phase>("review");
  const [name, setName] = React.useState("");
  const [deployedAddress, setDeployedAddress] = React.useState<string | null>(null);
  const [deployError, setDeployError] = React.useState<string | undefined>();
  const dialogRef = React.useRef<HTMLDivElement | null>(null);

  const nameError = name.trim().length === 0;
  const hasFactory = Boolean(contracts.factory);
  const networkLabel = chainLabelForId(chainId);

  React.useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLInputElement>("[data-autofocus]")?.focus();
    return () => opener?.focus?.();
  }, []);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        if (phase !== "deploying") onClose();
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
  }, [onClose, phase]);

  async function deploy() {
    if (nameError || !hasFactory || !address) return;
    setDeployError(undefined);
    setPhase("deploying");
    try {
      // editWindow: 7 days in seconds (no BigInt literals — ES2017 target)
      const editWindowSeconds = BigInt(7 * 24 * 3600);
      const symbol = deriveSymbol(name.trim());
      const hash = await writeContract(wagmiConfig, {
        address: contracts.factory!,
        abi: FACTORY_ABI,
        functionName: "createCollection",
        args: [name.trim(), symbol, editWindowSeconds],
      });
      const receipt = await waitForTransactionReceipt(wagmiConfig, { hash });

      // Decode CollectionCreated to get the deployed address
      let newAddr: `0x${string}` | undefined;
      for (const logItem of receipt.logs) {
        try {
          const d = decodeEventLog({ abi: FACTORY_ABI, data: logItem.data, topics: logItem.topics });
          if (d.eventName === "CollectionCreated") {
            newAddr = (d.args as { collection: `0x${string}` }).collection;
            break;
          }
        } catch {
          /* not our event */
        }
      }
      if (!newAddr) throw new Error("CollectionCreated event not found in receipt");

      setDeployedAddress(newAddr);
      onDeployed({
        name: name.trim(),
        chain: chainIdToChain(chainId),
        royaltyBps: 0, // royalty is per-token at mint time; the collection itself is royalty-agnostic
        contractAddress: newAddr,
      });
      setPhase("done");
    } catch (e) {
      setDeployError(/denied|rejected/i.test(String(e)) ? "Transaction rejected in wallet." : (e instanceof Error ? e.message.split("\n")[0] : "Deploy failed"));
      setPhase("review");
    }
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
          {phase === "done" && deployedAddress ? (
            <div className="animate-fade">
              <div className="flex items-center gap-2.5 rounded-[8px] border border-verify/25 bg-verify/10 px-4 py-3">
                <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-verify" aria-hidden />
                <p className="text-[13px] text-foreground">
                  Deployed on {networkLabel}. This Forever Library contract is yours outright.
                </p>
              </div>
              <dl className="mt-4 space-y-2.5 border-t border-border pt-4">
                <Line label="Name" value={name.trim()} strong />
                <Line label="Network" value={networkLabel} />
                <div className="flex items-baseline justify-between">
                  <span className="font-mono text-[11px] uppercase tracking-wider text-faint">Address</span>
                  <a
                    href={`${explorerTx(chainId, "").replace(/\/tx\/.*$/, "")}/address/${deployedAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-[13px] tabular-nums text-accent hover:underline"
                  >
                    {shortAddress(deployedAddress)}
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
                Deploy your own ERC-721 + ERC-2981 Forever Library on {networkLabel}. Perpetual never
                holds the keys. Leave whenever you like and take it fully intact.
              </p>

              {!hasFactory && (
                <div className="mt-4 rounded-[8px] border border-error/25 bg-error/5 px-4 py-3">
                  <p className="text-[13px] text-error">
                    The collection factory is not available on {networkLabel}. Switch to Base Sepolia or Ethereum Sepolia.
                  </p>
                </div>
              )}

              {!address && (
                <div className="mt-4 rounded-[8px] border border-border bg-surface-2/40 px-4 py-3">
                  <p className="text-[13px] text-muted">Connect a wallet to deploy.</p>
                </div>
              )}

              {deployError && (
                <div className="mt-4 rounded-[8px] border border-error/25 bg-error/5 px-4 py-3">
                  <p className="text-[13px] text-error">{deployError}</p>
                </div>
              )}

              <div className="mt-5 flex flex-col gap-1.5">
                <label htmlFor="deploy-name" className="font-mono text-[11px] uppercase tracking-wider text-faint">
                  Collection name
                </label>
                <input
                  id="deploy-name"
                  data-autofocus
                  type="text"
                  value={name}
                  maxLength={42}
                  disabled={phase === "deploying" || !hasFactory}
                  onChange={(e) => setName(e.target.value)}
                  aria-invalid={nameError}
                  aria-describedby={nameError ? "deploy-name-error" : undefined}
                  className={cn(
                    "h-11 w-full rounded-[8px] border bg-background px-3.5 text-sm text-foreground transition-colors placeholder:text-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
                    nameError ? "border-error/50" : "border-border focus-visible:border-border-bright",
                  )}
                  placeholder="e.g. Sovereign Editions"
                />
                {nameError && (
                  <p id="deploy-name-error" className="text-[12px] text-error">
                    A collection name is required.
                  </p>
                )}
              </div>

              <ul className="mt-5 space-y-1.5">
                <Reassure>Deployed under your wallet — Perpetual cannot freeze or seize it.</Reassure>
                <Reassure>ERC-721 + ERC-2981. Royalties enforced at settlement.</Reassure>
                <Reassure>7-day edit window for metadata updates.</Reassure>
              </ul>

              <Button
                variant="accent"
                size="lg"
                className="mt-5 min-h-[44px] w-full"
                onClick={deploy}
                disabled={phase === "deploying" || nameError || !hasFactory || !address}
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
