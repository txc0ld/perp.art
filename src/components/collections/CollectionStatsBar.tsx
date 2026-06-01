import type { Collection } from "@/lib/types";
import { getChainMeta } from "@/lib/chains";
import { formatEth, bpsToPct } from "@/lib/utils";

interface Cell {
  label: string;
  value: React.ReactNode;
}

/**
 * OpenSea-style horizontal stats bar, hairline-separated cells. Sourced purely
 * from the live Collection record + the live listed count. Live testnet
 * collections have no market yet, so floor / volume / top offer render as "—"
 * honestly rather than a fabricated number.
 */
export function CollectionStatsBar({
  collection,
  listedCount,
}: {
  collection: Collection;
  listedCount: number;
}) {
  const listedPct = collection.itemCount > 0 ? (listedCount / collection.itemCount) * 100 : 0;
  const cur = getChainMeta(collection.chain).currency;
  const floor = collection.floorEth > 0 ? `${formatEth(collection.floorEth)} ${cur}` : "—";
  const volume = collection.volumeEth > 0 ? `${formatEth(collection.volumeEth)} ${cur}` : "—";

  const cells: Cell[] = [
    { label: "Floor", value: floor },
    { label: "Top offer", value: "—" },
    { label: "Total Vol", value: volume },
    { label: "Items", value: collection.itemCount.toLocaleString() },
    { label: "Owners", value: collection.ownerCount.toLocaleString() },
    { label: "Listed", value: `${listedPct.toFixed(0)}%` },
    { label: "Royalty", value: bpsToPct(collection.royaltyBps) },
  ];

  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[10px] border border-border bg-border sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-7">
      {cells.map((c) => (
        <div key={c.label} className="bg-surface px-4 py-3.5">
          <dt className="font-mono text-[9px] uppercase tracking-wider text-faint">{c.label}</dt>
          <dd className="mt-1.5 font-mono text-sm tabular-nums text-foreground">{c.value}</dd>
        </div>
      ))}
    </dl>
  );
}
