"use client";

/**
 * CollectionStep — Phase 4.
 * Lets the artist pick which sovereign collection to mint into, or create a
 * new one inline. Also selects mint type (1-of-1 vs edition) and edition size.
 *
 * Collection enumeration:
 *  1. factory.collectionsCount()
 *  2. factory.collectionAt(i) for each i
 *  3. For each address: FL.owner() + FL.name() — keep those where owner == connected wallet
 *
 * "Default (open)" = canonical ForeverLibrary (undefined collectionAddress).
 */
import * as React from "react";
import { useAccount, useChainId } from "wagmi";
import { readContract, writeContract, waitForTransactionReceipt } from "@wagmi/core";
import { decodeEventLog } from "viem";
import { wagmiConfig } from "@/lib/web3/config";
import { getContracts } from "@/lib/web3/contracts";
import { FACTORY_ABI, FOREVER_LIBRARY_ABI } from "@/lib/web3/abis";
import { Button, MonoLabel } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { MintForm } from "./state";

interface OwnCollection {
  address: `0x${string}`;
  name: string;
}

/** Derive a short ERC-721 symbol from the collection name (≤8 chars, A-Z). */
function deriveSymbol(name: string): string {
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8) || "COL";
}

export function CollectionStep({
  form,
  set,
}: {
  form: MintForm;
  set: (patch: Partial<MintForm>) => void;
}) {
  const { address } = useAccount();
  const chainId = useChainId();
  const contracts = getContracts(chainId);

  // ─── collection list state ────────────────────────────────────────────────
  const [collections, setCollections] = React.useState<OwnCollection[]>([]);
  const [loadingCollections, setLoadingCollections] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string>();

  // ─── new-collection inline form ───────────────────────────────────────────
  const [showCreate, setShowCreate] = React.useState(false);
  const [newName, setNewName] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [createError, setCreateError] = React.useState<string>();

  // ─── edition UI state ─────────────────────────────────────────────────────
  const editionSize = form.editionSize ?? 1;
  const mintType = form.mintType ?? "single";

  // Load owned collections from factory
  React.useEffect(() => {
    if (!contracts.factory || !address) return;

    let cancelled = false;
    async function load() {
      setLoadingCollections(true);
      setLoadError(undefined);
      try {
        const count = await readContract(wagmiConfig, {
          address: contracts.factory!,
          abi: FACTORY_ABI,
          functionName: "collectionsCount",
        }) as bigint;

        const found: OwnCollection[] = [];
        // Enumerate all collections, keep those owned by the connected wallet
        for (let i = BigInt(0); i < count; i++) {
          const colAddr = await readContract(wagmiConfig, {
            address: contracts.factory!,
            abi: FACTORY_ABI,
            functionName: "collectionAt",
            args: [i],
          }) as `0x${string}`;

          // Read owner + name from the collection FL contract
          let owner: string;
          let colName: string;
          try {
            [owner, colName] = await Promise.all([
              readContract(wagmiConfig, {
                address: colAddr,
                abi: FOREVER_LIBRARY_ABI,
                functionName: "owner",
              }) as Promise<string>,
              readContract(wagmiConfig, {
                address: colAddr,
                abi: FOREVER_LIBRARY_ABI,
                functionName: "name",
              }) as Promise<string>,
            ]);
          } catch {
            continue;
          }

          if (owner.toLowerCase() === address!.toLowerCase()) {
            found.push({ address: colAddr, name: colName });
          }
        }
        if (!cancelled) setCollections(found);
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message.split("\n")[0] : "Could not load collections");
      } finally {
        if (!cancelled) setLoadingCollections(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contracts.factory, address, chainId]);

  // Deploy a new collection via factory
  async function handleCreate() {
    if (!newName.trim()) return;
    if (!contracts.factory) {
      setCreateError("Factory not available on this network.");
      return;
    }
    setCreating(true);
    setCreateError(undefined);
    try {
      const editWindowSeconds = BigInt(7 * 24 * 3600);
      const symbol = deriveSymbol(newName.trim());
      const hash = await writeContract(wagmiConfig, {
        address: contracts.factory,
        abi: FACTORY_ABI,
        functionName: "createCollection",
        args: [newName.trim(), symbol, editWindowSeconds],
      });
      const receipt = await waitForTransactionReceipt(wagmiConfig, { hash });

      // Decode CollectionCreated event to get the new address
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

      const col: OwnCollection = { address: newAddr, name: newName.trim() };
      setCollections((prev) => [...prev, col]);
      set({ collectionAddress: newAddr, collectionName: newName.trim() });
      setShowCreate(false);
      setNewName("");
    } catch (e) {
      setCreateError(/denied|rejected/i.test(String(e)) ? "Transaction rejected in wallet." : (e instanceof Error ? e.message.split("\n")[0] : "Deploy failed"));
    } finally {
      setCreating(false);
    }
  }

  function selectCollection(addr: `0x${string}` | undefined, name: string) {
    set({ collectionAddress: addr, collectionName: name });
  }

  const selectedAddr = form.collectionAddress;

  return (
    <div className="space-y-8">
      {/* ── Collection picker ─────────────────────────────────────────────── */}
      <div>
        <MonoLabel className="text-faint">Collection</MonoLabel>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">
          Mint into the shared open collection or into one of your own sovereign contracts.
          PFP drops: create a collection here, then mint multiple 1-of-1s into it.
        </p>

        <div className="mt-4 space-y-2">
          {/* Default (open) option */}
          <CollectionOption
            selected={selectedAddr === undefined}
            onSelect={() => selectCollection(undefined, "Default (open)")}
            title="Default (open)"
            subtitle="Shared ForeverLibrary · permissionless"
          />

          {/* Owned collections */}
          {loadingCollections && (
            <div className="flex items-center gap-2 px-4 py-3 text-[13px] text-faint">
              <span className="inline-block h-2 w-2 rounded-full bg-verify animate-verify-pulse" aria-hidden />
              Loading your collections…
            </div>
          )}
          {loadError && (
            <p className="px-1 text-[12px] text-error">{loadError}</p>
          )}
          {collections.map((col) => (
            <CollectionOption
              key={col.address}
              selected={selectedAddr === col.address}
              onSelect={() => selectCollection(col.address, col.name)}
              title={col.name}
              subtitle={col.address}
              mono
            />
          ))}

          {/* Create new */}
          {!showCreate && contracts.factory && (
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="flex w-full items-center gap-2.5 rounded-[8px] border border-dashed border-border bg-transparent px-4 py-3 text-left text-[13px] text-muted transition-colors hover:border-border-bright hover:text-foreground"
            >
              <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0" fill="none" aria-hidden>
                <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              New collection
            </button>
          )}

          {!contracts.factory && !loadingCollections && (
            <p className="px-1 text-[12px] text-muted">
              Sovereign collections are not available on this network. Mint into the Default collection.
            </p>
          )}
        </div>

        {/* Inline create form */}
        {showCreate && (
          <div className="mt-3 rounded-[8px] border border-border-bright bg-surface-2/40 p-4 space-y-3 animate-fade">
            <MonoLabel className="text-faint">New collection name</MonoLabel>
            <input
              type="text"
              value={newName}
              maxLength={42}
              disabled={creating}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Sovereign Editions"
              className="h-10 w-full rounded-[8px] border border-border bg-background px-3.5 text-sm text-foreground transition-colors placeholder:text-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:border-border-bright"
            />
            {createError && (
              <p className="text-[12px] text-error">{createError}</p>
            )}
            <div className="flex gap-2">
              <Button
                variant="accent"
                size="sm"
                onClick={handleCreate}
                disabled={creating || !newName.trim()}
              >
                {creating ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-1.5 w-1.5 animate-verify-pulse rounded-full bg-background" aria-hidden />
                    Deploying…
                  </span>
                ) : (
                  "Deploy & select"
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setShowCreate(false); setNewName(""); setCreateError(undefined); }}
                disabled={creating}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Mint type ─────────────────────────────────────────────────────── */}
      <div>
        <MonoLabel className="text-faint">Mint type</MonoLabel>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">
          1-of-1 is a single unique token. Edition mints N identical tokens sharing one upload.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <MintTypeOption
            selected={mintType === "single"}
            onSelect={() => set({ mintType: "single", editionSize: 1 })}
            title="1-of-1"
            subtitle="Single unique token"
          />
          <MintTypeOption
            selected={mintType === "edition"}
            onSelect={() => set({ mintType: "edition", editionSize: editionSize > 1 ? editionSize : 2 })}
            title="Edition"
            subtitle="Multiple copies"
          />
        </div>

        {mintType === "edition" && (
          <div className="mt-4 animate-fade">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="edition-size"
                className="font-mono text-[11px] uppercase tracking-wider text-faint"
              >
                Edition size (1–10)
              </label>
              <div className="flex items-center gap-3">
                <input
                  id="edition-size"
                  type="number"
                  min={1}
                  max={10}
                  step={1}
                  value={editionSize}
                  onChange={(e) => {
                    const v = Math.max(1, Math.min(10, Math.round(Number(e.target.value) || 1)));
                    set({ editionSize: v });
                  }}
                  className="h-10 w-28 rounded-[8px] border border-border bg-background px-3.5 font-mono text-sm tabular-nums text-foreground transition-colors focus-visible:border-border-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                />
                <span className="text-[13px] text-muted">
                  {editionSize === 1 ? "token" : "tokens"} · shared upload, per-token shard records
                </span>
              </div>
              <p className="text-[12px] text-faint">
                UI capped at 10 (contract allows up to 100). Each token requires its own shard-record transaction — the artist will sign up to {editionSize} confirmations in recording phase.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CollectionOption({
  selected,
  onSelect,
  title,
  subtitle,
  mono = false,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  subtitle: string;
  mono?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-3 rounded-[8px] border px-4 py-3 text-left transition-colors",
        selected
          ? "border-accent/50 bg-accent/5"
          : "border-border bg-transparent hover:border-border-bright hover:bg-surface-2/40",
      )}
    >
      {/* Radio dot */}
      <span
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors",
          selected ? "border-accent bg-accent" : "border-border bg-transparent",
        )}
      >
        {selected && (
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-background" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-foreground">{title}</span>
        <span className={cn("block truncate text-[11px] text-faint", mono && "font-mono tabular-nums")}>
          {subtitle}
        </span>
      </span>
      {selected && (
        <span className="font-mono text-[10px] uppercase tracking-wider text-accent">selected</span>
      )}
    </button>
  );
}

function MintTypeOption({
  selected,
  onSelect,
  title,
  subtitle,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex flex-col items-start rounded-[8px] border px-4 py-4 text-left transition-colors",
        selected
          ? "border-accent/50 bg-accent/5"
          : "border-border bg-transparent hover:border-border-bright hover:bg-surface-2/40",
      )}
    >
      <span className={cn("font-mono text-sm font-semibold", selected ? "text-accent" : "text-foreground")}>
        {title}
      </span>
      <span className="mt-0.5 text-[12px] text-faint">{subtitle}</span>
    </button>
  );
}
