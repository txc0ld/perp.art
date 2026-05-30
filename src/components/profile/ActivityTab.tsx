"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Token } from "@/lib/types";
import { SectionHeader } from "@/components/ui";
import { EmptyState } from "./OwnedTab";
import { SortSelect } from "./SortSelect";
import { shortAddress, shortHash, formatEth, relativeTime } from "@/lib/utils";

type ActivityKind = "created" | "minted" | "listed" | "offer" | "sale" | "transfer";

interface ActivityRow {
  key: string;
  kind: ActivityKind;
  tokenId: string;
  tokenTitle: string;
  counterparty?: string;
  priceEth?: number;
  txHash?: string;
  timestamp: string;
}

type SortKey = "recent" | "oldest" | "price-desc";

const SORTS: ReadonlyArray<{ key: SortKey; label: string }> = [
  { key: "recent", label: "Newest first" },
  { key: "oldest", label: "Oldest first" },
  { key: "price-desc", label: "Price: high to low" },
];

const KIND_LABEL: Record<ActivityKind, string> = {
  created: "Created",
  minted: "Minted",
  listed: "Listed",
  offer: "Offer",
  sale: "Sale",
  transfer: "Transfer",
};

function etherscanTx(hash: string) {
  return `https://etherscan.io/tx/${hash}`;
}

/**
 * Activity tab (design prompt §4.5) - a mono timeline of recent events across the
 * user's tokens, built from each token's provenance + offers. Rendered as a real
 * semantic <table> (sr-only caption, th scope) inside an overflow-x-auto scroller
 * so it reflows on mobile. Derived rows are memoized off the tokens + sort.
 */
export function ActivityTab({ tokens }: { tokens: Token[] }) {
  const [sort, setSort] = useState<SortKey>("recent");

  const visible = useMemo<ActivityRow[]>(() => {
    const rows: ActivityRow[] = [];
    for (const t of tokens) {
      for (let i = 0; i < t.provenance.length; i++) {
        const e = t.provenance[i];
        rows.push({
          key: `${t.id}:prov:${i}`,
          kind: e.kind,
          tokenId: t.id,
          tokenTitle: t.title,
          counterparty: e.to ?? e.from,
          priceEth: e.priceEth,
          txHash: e.txHash,
          timestamp: e.timestamp,
        });
      }
      for (let i = 0; i < t.offers.length; i++) {
        const o = t.offers[i];
        rows.push({
          key: `${t.id}:offer:${i}`,
          kind: "offer",
          tokenId: t.id,
          tokenTitle: t.title,
          counterparty: o.from,
          priceEth: o.priceEth,
          timestamp: o.expiresAt,
        });
      }
    }
    rows.sort((a, b) => {
      if (sort === "price-desc") return (b.priceEth ?? 0) - (a.priceEth ?? 0);
      const delta = Date.parse(b.timestamp) - Date.parse(a.timestamp);
      return sort === "oldest" ? -delta : delta;
    });
    return rows.slice(0, 60);
  }, [tokens, sort]);

  if (visible.length === 0) {
    return (
      <EmptyState
        title="No activity yet"
        body="Mints, sales, transfers, and offers across your works appear here as a verifiable timeline, each event linking to its transaction onchain."
      />
    );
  }

  return (
    <div>
      <SectionHeader
        eyebrow="Activity"
        title="Recent activity"
        description={
          <span className="font-mono tabular-nums">{visible.length} events</span>
        }
        action={
          <SortSelect value={sort} onChange={setSort} options={SORTS} label="Sort activity" />
        }
      />

      <div className="overflow-x-auto rounded-[10px] border border-border">
        <table className="w-full min-w-[640px] border-collapse text-left">
          <caption className="sr-only">
            Recent activity across your works: event type, item, counterparty, price, transaction, and time.
          </caption>
          <thead>
            <tr className="border-b border-border bg-surface-2/40">
              {["Event", "Item", "Counterparty", "Price", "Tx", "Time"].map((h) => (
                <th
                  key={h}
                  scope="col"
                  className="px-3 py-3 font-mono text-[10px] font-semibold uppercase tracking-wider text-faint"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr
                key={r.key}
                className="border-b border-border bg-surface transition-colors last:border-b-0 hover:bg-surface-2"
              >
                <td className="px-3 py-3.5">
                  <span
                    className={
                      "inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider " +
                      (r.kind === "sale"
                        ? "border-accent/30 bg-accent/10 text-accent"
                        : "border-border text-muted")
                    }
                  >
                    {KIND_LABEL[r.kind]}
                  </span>
                </td>
                <td className="px-3 py-3.5">
                  <Link
                    href={`/token/${r.tokenId}`}
                    className="text-sm text-foreground transition-colors hover:text-accent"
                  >
                    {r.tokenTitle}
                  </Link>
                </td>
                <td className="px-3 py-3.5 font-mono text-xs tabular-nums text-muted">
                  {r.counterparty ? shortAddress(r.counterparty) : "-"}
                </td>
                <td className="px-3 py-3.5 font-mono text-xs tabular-nums text-foreground">
                  {r.priceEth != null ? `${formatEth(r.priceEth)} ETH` : "-"}
                </td>
                <td className="px-3 py-3.5 font-mono text-xs tabular-nums text-muted">
                  {r.txHash ? (
                    <a
                      href={etherscanTx(r.txHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="transition-colors hover:text-accent"
                    >
                      {shortHash(r.txHash, 5)}
                    </a>
                  ) : (
                    "-"
                  )}
                </td>
                <td className="px-3 py-3.5 font-mono text-[11px] uppercase tracking-wider tabular-nums text-faint">
                  {relativeTime(r.timestamp)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
