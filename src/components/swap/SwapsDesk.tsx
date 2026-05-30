"use client";

/**
 * SwapsDesk - the /swaps client shell. Tabs (Open / Incoming / Outgoing), a
 * "Cross-chain only" filter, and a SwapList per tab. Open swaps arrive as a prop
 * from the server page; the user's incoming/outgoing are re-resolved against the
 * live wallet so the desk reflects whoever is connected. Tabs follow the same
 * a11y pattern as the profile tabs (role=tablist/tab/tabpanel + arrow keys).
 */
import * as React from "react";
import type { SwapOrder } from "@/lib/types";
import { getSwapsForUser } from "@/lib/mock-data";
import { useWallet, connectWallet } from "@/lib/wallet";
import { SwapList } from "./SwapList";
import { ProposeSwapButton } from "./ProposeSwapButton";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";

type TabId = "open" | "incoming" | "outgoing";

export function SwapsDesk({
  openSwaps,
  fallbackAddress,
}: {
  openSwaps: SwapOrder[];
  /** Server-resolved CURRENT_USER address, used until a wallet connects. */
  fallbackAddress: string;
}) {
  const wallet = useWallet();
  const [tab, setTab] = React.useState<TabId>("open");
  const [crossOnly, setCrossOnly] = React.useState(false);
  const [criteriaOnly, setCriteriaOnly] = React.useState(false);
  const tabRefs = React.useRef<Array<HTMLButtonElement | null>>([]);

  const address = wallet.connected && wallet.address ? wallet.address : fallbackAddress;
  const { incoming, outgoing } = React.useMemo(() => getSwapsForUser(address), [address]);

  const filter = React.useCallback(
    (list: SwapOrder[]) =>
      list.filter(
        (s) =>
          (!crossOnly || s.crossChain) &&
          (!criteriaOnly || Boolean(s.requestCriteria)),
      ),
    [crossOnly, criteriaOnly],
  );

  const fOpen = filter(openSwaps);
  const fIn = filter(incoming);
  const fOut = filter(outgoing);

  const tabs: Array<{ id: TabId; label: string; count: number }> = [
    { id: "open", label: "Open swaps", count: fOpen.length },
    { id: "incoming", label: "Incoming", count: fIn.length },
    { id: "outgoing", label: "Outgoing", count: fOut.length },
  ];
  const activeIndex = tabs.findIndex((t) => t.id === tab);

  function onTabKeyDown(e: React.KeyboardEvent) {
    let next = activeIndex;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (activeIndex + 1) % tabs.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (activeIndex - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    else return;
    e.preventDefault();
    setTab(tabs[next].id);
    tabRefs.current[next]?.focus();
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Controls: tabs + cross-chain filter */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="-mx-1 overflow-x-auto">
          <div
            role="tablist"
            aria-label="Swap views"
            onKeyDown={onTabKeyDown}
            className="flex min-w-max items-center gap-1 border-b border-border"
          >
            {tabs.map((t, i) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  ref={(el) => {
                    tabRefs.current[i] = el;
                  }}
                  id={`swaps-tab-${t.id}`}
                  role="tab"
                  type="button"
                  aria-selected={active}
                  aria-controls="swaps-panel"
                  tabIndex={active ? 0 : -1}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "relative flex min-h-[44px] items-center gap-2 px-4 py-3 font-mono text-[12px] font-semibold uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-inset",
                    active ? "text-accent" : "text-muted hover:text-foreground",
                  )}
                >
                  {t.label}
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[10px] tabular-nums",
                      active ? "bg-accent/15 text-accent" : "bg-surface-2 text-faint",
                    )}
                  >
                    {t.count}
                  </span>
                  <span
                    aria-hidden
                    className={cn(
                      "absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-accent transition-opacity duration-300",
                      active ? "opacity-100" : "opacity-0",
                    )}
                  />
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setCriteriaOnly((v) => !v)}
            aria-pressed={criteriaOnly}
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-[8px] border px-3 font-mono text-[11px] uppercase tracking-wider transition-colors",
              criteriaOnly
                ? "border-accent/40 bg-accent/10 text-accent"
                : "border-border bg-surface text-muted hover:border-border-bright hover:text-foreground",
            )}
          >
            <span
              className={cn("inline-block h-2 w-2 rounded-full", criteriaOnly ? "bg-accent" : "bg-faint")}
              aria-hidden
            />
            Collection swaps
          </button>
          <button
            type="button"
            onClick={() => setCrossOnly((v) => !v)}
            aria-pressed={crossOnly}
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-[8px] border px-3 font-mono text-[11px] uppercase tracking-wider transition-colors",
              crossOnly
                ? "border-accent/40 bg-accent/10 text-accent"
                : "border-border bg-surface text-muted hover:border-border-bright hover:text-foreground",
            )}
          >
            <span
              className={cn("inline-block h-2 w-2 rounded-full", crossOnly ? "bg-accent" : "bg-faint")}
              aria-hidden
            />
            Cross-chain only
          </button>
          <ProposeSwapButton variant="accent" size="sm" defaultMode="criteria">
            Create swap
          </ProposeSwapButton>
        </div>
      </div>

      {/* Wallet hint for personal tabs */}
      {!wallet.connected && (tab === "incoming" || tab === "outgoing") && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[8px] border border-border bg-surface-2/40 px-4 py-3">
          <p className="text-[13px] text-muted">
            Showing the sample account. Connect a wallet to manage your own swaps.
          </p>
          <Button variant="secondary" size="sm" onClick={() => connectWallet()}>
            Connect wallet
          </Button>
        </div>
      )}

      {/* Panel */}
      <div id="swaps-panel" role="tabpanel" aria-labelledby={`swaps-tab-${tab}`} tabIndex={0} className="focus-visible:outline-none">
        {tab === "open" && (
          <SwapList
            swaps={fOpen}
            variant="open"
            emptyTitle={
              criteriaOnly
                ? "No open collection swaps"
                : crossOnly
                  ? "No open cross-chain swaps"
                  : "No open swaps right now"
            }
            emptyBody="Create a collection swap, any work from a collection for one of yours, or open a token page to propose a specific barter."
            action={
              <ProposeSwapButton variant="accent" size="md" defaultMode="criteria">
                Create swap
              </ProposeSwapButton>
            }
          />
        )}
        {tab === "incoming" && (
          <SwapList
            swaps={fIn}
            variant="incoming"
            emptyTitle={crossOnly ? "No incoming cross-chain swaps" : "No incoming swaps"}
            emptyBody="Proposals for your works land here to accept, decline, or counter."
          />
        )}
        {tab === "outgoing" && (
          <SwapList
            swaps={fOut}
            variant="outgoing"
            emptyTitle={crossOnly ? "No outgoing cross-chain swaps" : "No outgoing swaps"}
            emptyBody="Swaps you propose appear here while they wait on the counterparty."
          />
        )}
      </div>
    </div>
  );
}
