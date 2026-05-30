import { cn, formatEth } from "@/lib/utils";
import type { Collection } from "@/lib/types";

interface Stat {
  label: string;
  value: string;
}

/** Mono stats row used on both the collection card and the detail header. */
export function StatStrip({
  collection,
  size = "sm",
  className,
}: {
  collection: Collection;
  size?: "sm" | "lg";
  className?: string;
}) {
  const stats: Stat[] = [
    { label: "Floor", value: `${formatEth(collection.floorEth)} ETH` },
    { label: "Volume", value: `${formatEth(collection.volumeEth)} ETH` },
    { label: "Items", value: String(collection.itemCount) },
    { label: "Owners", value: String(collection.ownerCount) },
  ];

  if (size === "lg") {
    return (
      <dl className={cn("grid grid-cols-2 gap-px overflow-hidden rounded-[8px] border border-border bg-border sm:grid-cols-4", className)}>
        {stats.map((s) => (
          <div key={s.label} className="bg-surface px-5 py-4">
            <dt className="label-mono text-faint">{s.label}</dt>
            <dd className="mt-1.5 font-mono text-base tabular-nums text-foreground">{s.value}</dd>
          </div>
        ))}
      </dl>
    );
  }

  return (
    <dl className={cn("grid grid-cols-4 gap-3", className)}>
      {stats.map((s) => (
        <div key={s.label} className="min-w-0">
          <dt className="font-mono text-[9px] uppercase tracking-wider text-faint">{s.label}</dt>
          <dd className="mt-1 truncate font-mono text-xs tabular-nums text-foreground">{s.value}</dd>
        </div>
      ))}
    </dl>
  );
}
