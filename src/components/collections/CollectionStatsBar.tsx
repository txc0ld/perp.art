import type { Collection } from "@/lib/types";
import type { CollectionRanking } from "@/lib/mock-data";
import { formatEth, bpsToPct } from "@/lib/utils";
import { PctChange } from "@/components/stats/PctChange";

interface Cell {
  label: string;
  value: React.ReactNode;
}

/**
 * OpenSea-style horizontal stats bar, hairline-separated cells.
 * 24h vol / floor / change come from the indexer ranking row; owners / items /
 * listed% / royalty are computed from the collection fields.
 */
export function CollectionStatsBar({
  collection,
  ranking,
  listedCount,
}: {
  collection: Collection;
  ranking?: CollectionRanking;
  listedCount: number;
}) {
  const listedPct = collection.itemCount > 0 ? (listedCount / collection.itemCount) * 100 : 0;

  const cells: Cell[] = [
    { label: "Floor", value: `${formatEth(collection.floorEth)} ETH` },
    { label: "Top offer", value: ranking ? `${formatEth(ranking.topOfferEth)} ETH` : "-" },
    { label: "24h Vol", value: ranking ? `${formatEth(ranking.volumeEth)} ETH` : "-" },
    {
      label: "24h Change",
      value: ranking ? <PctChange value={ranking.changePct} /> : "-",
    },
    { label: "Total Vol", value: `${formatEth(collection.volumeEth)} ETH` },
    { label: "Items", value: collection.itemCount.toLocaleString() },
    { label: "Owners", value: collection.ownerCount.toLocaleString() },
    { label: "Listed", value: `${listedPct.toFixed(0)}%` },
    { label: "Royalty", value: bpsToPct(collection.royaltyBps) },
  ];

  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[10px] border border-border bg-border sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9">
      {cells.map((c) => (
        <div key={c.label} className="bg-surface px-4 py-3.5">
          <dt className="font-mono text-[9px] uppercase tracking-wider text-faint">{c.label}</dt>
          <dd className="mt-1.5 font-mono text-sm tabular-nums text-foreground">{c.value}</dd>
        </div>
      ))}
    </dl>
  );
}
