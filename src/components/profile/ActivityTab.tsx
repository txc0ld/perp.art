import Link from "next/link";
import type { Token } from "@/lib/types";
import { MonoLabel } from "@/components/ui";
import { EmptyState } from "./OwnedTab";
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
 * user's tokens, built from each token's provenance + offers. Newest first.
 */
export function ActivityTab({ tokens }: { tokens: Token[] }) {
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

  rows.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
  const visible = rows.slice(0, 60);

  if (visible.length === 0) {
    return (
      <EmptyState
        title="No activity yet"
        body="Mints, sales, transfers, and offers across your works will appear here as a verifiable timeline."
      />
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-baseline justify-between border-b border-border pb-4">
        <MonoLabel className="text-foreground">Recent activity</MonoLabel>
        <span className="font-mono text-[11px] uppercase tracking-wider text-faint">
          {visible.length} events
        </span>
      </div>

      {/* Header row (desktop) */}
      <div className="hidden grid-cols-[110px_minmax(0,1fr)_140px_120px_120px_90px] gap-4 px-3 pb-3 md:grid">
        {["Event", "Item", "Counterparty", "Price", "Tx", "Time"].map((h) => (
          <MonoLabel key={h} className="text-faint">
            {h}
          </MonoLabel>
        ))}
      </div>

      <ul className="overflow-hidden rounded-[10px] border border-border">
        {visible.map((r, i) => (
          <li
            key={r.key}
            className="animate-fade grid grid-cols-1 gap-2 border-b border-border bg-surface px-3 py-3.5 transition-colors last:border-b-0 hover:bg-surface-2 md:grid-cols-[110px_minmax(0,1fr)_140px_120px_120px_90px] md:items-center md:gap-4"
            style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}
          >
            <div>
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
            </div>

            <Link
              href={`/token/${r.tokenId}`}
              className="truncate text-sm text-foreground transition-colors hover:text-accent"
            >
              {r.tokenTitle}
            </Link>

            <span className="font-mono text-xs text-muted">
              {r.counterparty ? shortAddress(r.counterparty) : "-"}
            </span>

            <span className="font-mono text-xs tabular-nums text-foreground">
              {r.priceEth != null ? `${formatEth(r.priceEth)} ETH` : "-"}
            </span>

            <span className="font-mono text-xs text-muted">
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
            </span>

            <span className="font-mono text-[11px] uppercase tracking-wider text-faint">
              {relativeTime(r.timestamp)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
