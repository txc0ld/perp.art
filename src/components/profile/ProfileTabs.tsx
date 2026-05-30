"use client";

import { useMemo, useState } from "react";
import type { Artist, Collection, Genre, Token } from "@/lib/types";
import { useWallet, connectWallet } from "@/lib/wallet";
import { Button, Surface } from "@/components/ui";
import { ProfileHeader } from "./ProfileHeader";
import { CollectedTab } from "./OwnedTab";
import { CreatedTab } from "./CreatedTab";
import { ActivityTab } from "./ActivityTab";
import { SovereignContracts } from "./SovereignContracts";

type TabId = "collected" | "created" | "activity" | "contracts";

/**
 * ProfileTabs (OpenSea-style profile shell) - client shell for the connected user.
 * Owned tokens depend on the connected wallet, so all data is passed in as plain
 * props by the server page and resolved here against live wallet state.
 */
export function ProfileTabs({
  allTokens,
  previewAddress,
  creator,
  creatorTokens,
  creatorCollections,
  bannerGenre,
}: {
  allTokens: Token[];
  /** Fallback owner address for a calm preview when no wallet is connected. */
  previewAddress: string;
  /** Demo creator identity (first artist) drives Created + Sovereign tabs. */
  creator: Artist;
  creatorTokens: Token[];
  creatorCollections: Collection[];
  /** Genre keying the banner + avatar identicon visuals. */
  bannerGenre: Genre;
}) {
  const wallet = useWallet();
  const [tab, setTab] = useState<TabId>("collected");

  const connected = wallet.connected && wallet.address;
  const activeAddress = connected ? wallet.address! : previewAddress;

  const ownedTokens = useMemo(
    () => allTokens.filter((t) => t.owner.toLowerCase() === activeAddress.toLowerCase()),
    [allTokens, activeAddress],
  );

  // Activity spans both held and created works.
  const activityTokens = useMemo(() => {
    const map = new Map<string, Token>();
    for (const t of [...ownedTokens, ...creatorTokens]) map.set(t.id, t);
    return [...map.values()];
  }, [ownedTokens, creatorTokens]);

  const collectionsHeld = useMemo(
    () => new Set(ownedTokens.map((t) => t.collectionSlug)).size,
    [ownedTokens],
  );

  if (!connected) {
    return (
      <DisconnectedState
        onConnect={() => connectWallet()}
        previewCount={ownedTokens.length}
      />
    );
  }

  const tabs: Array<{ id: TabId; label: string; count?: number }> = [
    { id: "collected", label: "Collected", count: ownedTokens.length },
    { id: "created", label: "Created", count: creatorTokens.length },
    { id: "activity", label: "Activity" },
    { id: "contracts", label: "Sovereign Contracts" },
  ];

  return (
    <div className="flex flex-col gap-10">
      <ProfileHeader
        address={wallet.address!}
        handle={creator.handle}
        name={creator.name}
        joinedAt={creator.joinedAt}
        verified={creator.verified}
        sovereign={creator.sovereign}
        bannerGenre={bannerGenre}
        ownedTokens={ownedTokens}
        createdCount={creatorTokens.length}
        collectionsCount={collectionsHeld}
      />

      {/* Tab bar - hairline underline, accent active indicator */}
      <div className="-mx-1 overflow-x-auto">
        <div
          role="tablist"
          aria-label="Profile sections"
          className="flex min-w-max items-center gap-1 border-b border-border"
        >
          {tabs.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.id)}
                className={
                  "relative flex items-center gap-2 px-4 py-3 font-mono text-[12px] font-semibold uppercase tracking-wider transition-colors " +
                  (active ? "text-accent" : "text-muted hover:text-foreground")
                }
              >
                {t.label}
                {t.count != null && (
                  <span
                    className={
                      "rounded-full px-1.5 py-0.5 text-[10px] tabular-nums " +
                      (active
                        ? "bg-accent/15 text-accent"
                        : "bg-surface-2 text-faint")
                    }
                  >
                    {t.count}
                  </span>
                )}
                <span
                  className={
                    "absolute inset-x-3 -bottom-px h-0.5 rounded-full transition-all duration-300 " +
                    (active ? "bg-accent opacity-100" : "bg-accent opacity-0")
                  }
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* Panels */}
      <div role="tabpanel" className="min-h-[40vh]">
        {tab === "collected" && (
          <CollectedTab tokens={ownedTokens} preview={!wallet.connected} />
        )}
        {tab === "created" && <CreatedTab tokens={creatorTokens} />}
        {tab === "activity" && <ActivityTab tokens={activityTokens} />}
        {tab === "contracts" && (
          <SovereignContracts collections={creatorCollections} />
        )}
      </div>
    </div>
  );
}

function DisconnectedState({
  onConnect,
  previewCount,
}: {
  onConnect: () => void;
  previewCount: number;
}) {
  return (
    <div className="flex min-h-[55vh] items-center justify-center">
      <Surface className="w-full max-w-md px-8 py-12 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-border-bright">
          <svg viewBox="0 0 24 24" className="h-5 w-5 text-accent" fill="none" aria-hidden>
            <rect x="3" y="6" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.5" />
            <path d="M16 12h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M3 9h18" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </div>
        <h1 className="mt-6 text-xl font-medium text-foreground">
          Connect your wallet to view your collection
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted">
          Your collected works, creations, activity, and sovereign contracts live here.
          Perpetual never takes custody of your assets.
        </p>
        <Button variant="accent" size="lg" className="mt-7 w-full" onClick={onConnect}>
          Connect wallet
        </Button>
        {previewCount > 0 && (
          <p className="mt-4 font-mono text-[11px] uppercase tracking-wider text-faint">
            {previewCount} works waiting in the sample collection
          </p>
        )}
      </Surface>
    </div>
  );
}
