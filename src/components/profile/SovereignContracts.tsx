"use client";

import { useState } from "react";
import type { Collection, Chain } from "@/lib/types";
import { Surface, Button, Badge, MonoLabel, Divider } from "@/components/ui";
import { getChainMeta } from "@/lib/mock-data";
import { shortAddress, bpsToPct } from "@/lib/utils";
import { DeployContractModal, type DeployedContract } from "./DeployContractModal";

/** Minimal shape every contract card renders from (mock Collections + freshly deployed). */
interface ContractView {
  key: string;
  name: string;
  contractAddress: string;
  chain: Chain;
  itemCount: number;
  ownerCount: number;
  royaltyBps: number;
  justDeployed?: boolean;
}

function fromCollection(c: Collection): ContractView {
  return {
    key: c.slug,
    name: c.name,
    contractAddress: c.contractAddress,
    chain: c.chain,
    itemCount: c.itemCount,
    ownerCount: c.ownerCount,
    royaltyBps: c.royaltyBps,
  };
}

/**
 * Sovereign Contracts surface (design prompt §4.5, PRD §7.5).
 * Artists own their Forever Library contracts outright. Lists each sovereign
 * contract with chain, items, royalty, and a copyable address, plus a working
 * Deploy CTA that opens DeployContractModal and prepends the new contract.
 */
export function SovereignContracts({
  collections,
}: {
  collections: Collection[];
}) {
  const [deployed, setDeployed] = useState<ContractView[]>([]);
  const [deploying, setDeploying] = useState(false);

  const base = collections.filter((c) => c.sovereign).map(fromCollection);
  const contracts = [...deployed, ...base];

  function onDeployed(c: DeployedContract) {
    setDeployed((prev) => [
      {
        key: c.contractAddress,
        name: c.name,
        contractAddress: c.contractAddress,
        chain: c.chain,
        itemCount: 0,
        ownerCount: 1,
        royaltyBps: c.royaltyBps,
        justDeployed: true,
      },
      ...prev,
    ]);
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-baseline sm:justify-between">
        <div className="flex items-center gap-2.5">
          <MonoLabel className="text-foreground">Sovereign contracts</MonoLabel>
          <Badge tone="accent">You own these outright</Badge>
        </div>
        <p className="max-w-md text-xs leading-relaxed text-muted">
          Your works live in Forever Library contracts that you, not Perpetual, control.
          Leave whenever you like and take them with you, fully intact, indexable by
          anyone.
        </p>
      </div>

      {contracts.length === 0 ? (
        <Surface className="px-6 py-10 text-center">
          <p className="text-sm text-muted">
            No sovereign contract yet. Deploy one to own your collection outright,
            on a contract Perpetual can never seize or freeze.
          </p>
        </Surface>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {contracts.map((c) => (
            <ContractCard key={c.key} contract={c} />
          ))}
        </div>
      )}

      {/* Deploy CTA */}
      <div className="mt-6 flex flex-col items-start justify-between gap-4 rounded-[10px] border border-dashed border-border bg-surface/40 px-6 py-5 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-medium text-foreground">Deploy a new sovereign contract</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Deploy your own ERC-721 + ERC-2981 Forever Library. Perpetual never holds the keys.
          </p>
        </div>
        <Button
          variant="accent"
          size="md"
          className="min-h-[44px] w-full shrink-0 sm:w-auto"
          onClick={() => setDeploying(true)}
        >
          Deploy contract
        </Button>
      </div>

      {deploying && (
        <DeployContractModal onClose={() => setDeploying(false)} onDeployed={onDeployed} />
      )}
    </div>
  );
}

function ContractCard({ contract: c }: { contract: ContractView }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(c.contractAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  }

  const rows: Array<{ label: string; value: string }> = [
    { label: "Chain", value: getChainMeta(c.chain).label },
    { label: "Items", value: String(c.itemCount) },
    { label: "Owners", value: String(c.ownerCount) },
    { label: "Royalty", value: bpsToPct(c.royaltyBps) },
  ];

  return (
    <Surface className="flex flex-col p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-medium text-foreground">{c.name}</p>
          <button
            type="button"
            onClick={copy}
            aria-label={`Copy contract address ${c.contractAddress}`}
            className="group mt-1.5 inline-flex min-h-[44px] items-center gap-1.5 font-mono text-xs text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            <span className="tabular-nums">{shortAddress(c.contractAddress)}</span>
            {copied ? (
              <span className="text-accent">copied</span>
            ) : (
              <svg viewBox="0 0 16 16" className="h-3 w-3 text-faint transition-colors group-hover:text-muted" fill="none" aria-hidden>
                <rect x="5.5" y="5.5" width="7" height="7" rx="1.2" stroke="currentColor" strokeWidth="1.2" />
                <path d="M3.5 10.5V4a.5.5 0 01.5-.5h6.5" stroke="currentColor" strokeWidth="1.2" />
              </svg>
            )}
          </button>
          <span aria-live="polite" className="sr-only">
            {copied ? "Contract address copied to clipboard." : ""}
          </span>
        </div>
        <Badge tone={c.justDeployed ? "accent" : "muted"}>
          {c.justDeployed ? "New · Sovereign" : "Sovereign"}
        </Badge>
      </div>

      <Divider className="my-5" />

      <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
        {rows.map((r) => (
          <div key={r.label}>
            <dt>
              <MonoLabel className="text-faint">{r.label}</MonoLabel>
            </dt>
            <dd className="mt-1.5 font-mono text-sm tabular-nums text-foreground">{r.value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-5 flex items-start gap-2 rounded-[8px] border border-accent/20 bg-accent/[0.06] px-3.5 py-3">
        <svg viewBox="0 0 16 16" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" fill="none" aria-hidden>
          <rect x="3.5" y="7" width="9" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.3" />
          <path d="M5.5 7V5.5a2.5 2.5 0 015 0V7" stroke="currentColor" strokeWidth="1.3" />
        </svg>
        <p className="font-mono text-[11px] leading-relaxed text-muted">
          You own this contract outright. Perpetual cannot freeze, seize, or migrate it.
        </p>
      </div>
    </Surface>
  );
}
