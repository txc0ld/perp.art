"use client";

import * as React from "react";
import Link from "next/link";
import type { Token } from "@/lib/types";
import { cn, formatEth, shortAddress, relativeTime } from "@/lib/utils";
import { ArtTile } from "@/components/art/ArtTile";

type Tab = "items" | "activity";
type Sort = "recent" | "price-asc" | "price-desc";

const SORTS: { value: Sort; label: string }[] = [
  { value: "recent", label: "Recently listed" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
];

const TABS: { value: Tab; label: string }[] = [
  { value: "items", label: "Items" },
  { value: "activity", label: "Activity" },
];

interface ActivityRow {
  token: Token;
  kind: "sale" | "transfer" | "listed";
  priceEth?: number;
  from?: string;
  to?: string;
  timestamp: string;
}

/**
 * Client toolbar + content for a collection page. Sticky sub-bar with result
 * count, a sort control, and Items / Activity as an accessible tablist
 * (role=tab/tabpanel, aria-selected, arrow-key navigation). Items renders a
 * dense ArtTile grid; Activity renders a semantic mono table.
 */
export function CollectionItems({
  tokens,
  collectionName,
}: {
  tokens: Token[];
  collectionName?: string;
}) {
  const [tab, setTab] = React.useState<Tab>("items");
  const [sort, setSort] = React.useState<Sort>("recent");
  const [sortOpen, setSortOpen] = React.useState(false);
  const tabRefs = React.useRef<Record<Tab, HTMLButtonElement | null>>({ items: null, activity: null });

  const sorted = React.useMemo(() => {
    const list = [...tokens];
    if (sort === "price-asc" || sort === "price-desc") {
      const price = (t: Token) => t.listing?.priceEth ?? Number.POSITIVE_INFINITY;
      list.sort((a, b) => {
        const pa = price(a), pb = price(b);
        return sort === "price-asc" ? pa - pb : (pb === Infinity ? -1 : pa === Infinity ? 1 : pb - pa);
      });
    } else {
      // Recently listed: listed first, by most recent listing expiry proxy.
      list.sort((a, b) => Number(Boolean(b.listing)) - Number(Boolean(a.listing)));
    }
    return list;
  }, [tokens, sort]);

  const activity = React.useMemo(() => buildActivity(tokens), [tokens]);

  function onTabKeyDown(e: React.KeyboardEvent) {
    const order: Tab[] = TABS.map((t) => t.value);
    const idx = order.indexOf(tab);
    let next: Tab | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = order[(idx + 1) % order.length];
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = order[(idx - 1 + order.length) % order.length];
    else if (e.key === "Home") next = order[0];
    else if (e.key === "End") next = order[order.length - 1];
    if (next) {
      e.preventDefault();
      setTab(next);
      tabRefs.current[next]?.focus();
    }
  }

  return (
    <div>
      {/* Sticky toolbar */}
      <div className="sticky top-0 z-20 -mx-1 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border bg-background/90 px-1 py-3 backdrop-blur-md">
        <div
          role="tablist"
          aria-label="Collection content"
          className="flex items-center gap-1 rounded-full border border-border bg-surface p-1"
        >
          {TABS.map((t) => (
            <TabButton
              key={t.value}
              id={`tab-${t.value}`}
              controls={`panel-${t.value}`}
              active={tab === t.value}
              ref={(el) => { tabRefs.current[t.value] = el; }}
              onClick={() => setTab(t.value)}
              onKeyDown={onTabKeyDown}
            >
              {t.label}
            </TabButton>
          ))}
        </div>

        <span className="font-mono text-xs tabular-nums text-muted" aria-live="polite">
          {tab === "items"
            ? `${sorted.length} ${sorted.length === 1 ? "ITEM" : "ITEMS"}`
            : `${activity.length} EVENTS`}
        </span>

        {tab === "items" && (
          <div className="relative ml-auto">
            <button
              type="button"
              onClick={() => setSortOpen((v) => !v)}
              aria-expanded={sortOpen}
              aria-haspopup="listbox"
              aria-label={`Sort items, currently ${SORTS.find((s) => s.value === sort)!.label}`}
              className="inline-flex h-11 items-center gap-2 rounded-[8px] border border-border bg-surface px-3 font-mono text-[11px] uppercase tracking-wider text-foreground transition-colors hover:border-border-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {SORTS.find((s) => s.value === sort)!.label}
              <svg viewBox="0 0 16 16" className={cn("h-3 w-3 transition-transform", sortOpen && "rotate-180")} fill="none" aria-hidden>
                <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {sortOpen && (
              <>
                <button
                  type="button"
                  aria-hidden
                  tabIndex={-1}
                  onClick={() => setSortOpen(false)}
                  className="fixed inset-0 z-10 cursor-default"
                />
                <ul
                  role="listbox"
                  aria-label="Sort items"
                  className="absolute right-0 z-20 mt-2 w-52 overflow-hidden rounded-[8px] border border-border bg-surface py-1 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.8)]"
                >
                  {SORTS.map((s) => (
                    <li key={s.value} role="option" aria-selected={sort === s.value}>
                      <button
                        type="button"
                        onClick={() => { setSort(s.value); setSortOpen(false); }}
                        className={cn(
                          "flex min-h-[40px] w-full items-center justify-between px-3 py-2 text-left text-[13px] transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:bg-surface-2",
                          sort === s.value ? "text-accent" : "text-foreground",
                        )}
                      >
                        {s.label}
                        {sort === s.value && (
                          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden>
                            <path d="M3.5 8.5l3 3 6-6.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </div>

      <div
        role="tabpanel"
        id="panel-items"
        aria-labelledby="tab-items"
        hidden={tab !== "items"}
      >
        {sorted.length > 0 ? (
          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:gap-5 xl:grid-cols-4">
            {sorted.map((t) => (
              <ArtTile key={t.id} token={t} />
            ))}
          </div>
        ) : (
          <p className="mt-16 text-center text-sm text-muted">No works in this collection yet.</p>
        )}
      </div>

      <div
        role="tabpanel"
        id="panel-activity"
        aria-labelledby="tab-activity"
        hidden={tab !== "activity"}
      >
        <ActivityTable rows={activity} collectionName={collectionName} />
      </div>
    </div>
  );
}

function buildActivity(tokens: Token[]): ActivityRow[] {
  const rows: ActivityRow[] = [];
  for (const t of tokens) {
    for (const e of t.provenance) {
      if (e.kind === "sale" || e.kind === "transfer") {
        rows.push({ token: t, kind: e.kind, priceEth: e.priceEth, from: e.from, to: e.to, timestamp: e.timestamp });
      }
    }
    if (t.listing) {
      rows.push({ token: t, kind: "listed", priceEth: t.listing.priceEth, from: t.listing.seller, timestamp: t.listing.expiresAt });
    }
  }
  return rows.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp)).slice(0, 40);
}

function ActivityTable({ rows, collectionName }: { rows: ActivityRow[]; collectionName?: string }) {
  if (rows.length === 0) {
    return <p className="mt-16 text-center text-sm text-muted">No recent activity.</p>;
  }
  return (
    <div className="mt-6 overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse">
        <caption className="sr-only">
          Recent activity{collectionName ? ` for ${collectionName}` : ""}: sales, transfers, and listings,
          most recent first.
        </caption>
        <colgroup>
          <col className="w-[96px]" />
          <col />
          <col className="w-[120px]" />
          <col className="w-[120px]" />
          <col className="w-[120px]" />
          <col className="w-[96px]" />
        </colgroup>
        <thead>
          <tr className="border-b border-border text-faint">
            <Th className="text-left">Event</Th>
            <Th className="text-left">Item</Th>
            <Th className="text-right">Price</Th>
            <Th className="hidden text-left sm:table-cell">From</Th>
            <Th className="hidden text-left sm:table-cell">To</Th>
            <Th className="text-right">Time</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={`${r.token.id}-${i}`} className="border-b border-border transition-colors hover:bg-surface focus-within:bg-surface">
              <Td className="text-left">
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted">{r.kind}</span>
              </Td>
              <td className="py-3 pr-4">
                <Link
                  href={`/token/${r.token.id}`}
                  className="truncate text-[13px] text-foreground hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-[6px]"
                >
                  {r.token.title}
                </Link>
              </td>
              <Td className="text-right text-foreground">{r.priceEth ? `${formatEth(r.priceEth)} ETH` : "-"}</Td>
              <Td className="hidden text-left sm:table-cell">{r.from ? shortAddress(r.from) : "-"}</Td>
              <Td className="hidden text-left sm:table-cell">{r.to ? shortAddress(r.to) : "-"}</Td>
              <Td className="text-right text-faint">{relativeTime(r.timestamp)}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <th scope="col" className={cn("py-3 pr-4 font-mono text-[10px] font-semibold uppercase tracking-wider", className)}>
      {children}
    </th>
  );
}

function Td({ className, children }: { className?: string; children: React.ReactNode }) {
  return <td className={cn("py-3 pr-4 font-mono text-[13px] tabular-nums text-muted", className)}>{children}</td>;
}

const TabButton = React.forwardRef<
  HTMLButtonElement,
  {
    id: string;
    controls: string;
    active: boolean;
    onClick: () => void;
    onKeyDown: (e: React.KeyboardEvent) => void;
    children: React.ReactNode;
  }
>(function TabButton({ id, controls, active, onClick, onKeyDown, children }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      role="tab"
      id={id}
      aria-controls={controls}
      aria-selected={active}
      tabIndex={active ? 0 : -1}
      onClick={onClick}
      onKeyDown={onKeyDown}
      className={cn(
        "inline-flex h-9 min-h-[36px] items-center rounded-full px-4 font-mono text-[11px] font-semibold uppercase tracking-wider leading-none transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        active ? "bg-accent text-background" : "text-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
});
