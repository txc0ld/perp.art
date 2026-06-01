import type { Collection } from "@/lib/types";
import { getChainMeta } from "@/lib/chains";
import { GenerativeArt } from "@/components/art/GenerativeArt";
import { Badge, VerifiedBadge } from "@/components/ui";
import { CollectionActions } from "./CollectionActions";
import { CollectionBanner3D } from "./CollectionBanner3D";

/**
 * OpenSea-style collection hero: a wide GenerativeArt banner with a circular
 * avatar overlapping its bottom-left, then name + sovereign + chain badges and
 * a clamped description. Sourced purely from the live Collection record.
 */
export function CollectionHero({
  collection,
}: {
  collection: Collection;
}) {
  return (
    <header>
      {/* Banner - subtle pointer/scroll parallax for quiet depth */}
      <CollectionBanner3D coverSeed={collection.coverSeed} genre={collection.genre} />

      {/* Avatar + identity. The avatar overlaps the banner bottom-left; the row
          reserves left padding at >=sm so identity text never sits under it. */}
      <div className="relative px-1">
        <div className="absolute -top-12 left-0 h-24 w-24 overflow-hidden rounded-full border-4 border-background bg-background sm:-top-14 sm:h-28 sm:w-28">
          <GenerativeArt
            seed={`${collection.coverSeed}-avatar`}
            genre={collection.genre}
            size={240}
            className="h-full w-full"
          />
        </div>
      </div>

      <div className="mt-14 flex flex-col gap-5 sm:mt-16 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 className="display-sm font-brand text-foreground">{collection.name}</h1>
            {collection.sovereign && (
              <VerifiedBadge size={20} label="Sovereign contract" />
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge tone="muted">{collection.genre}</Badge>
            <Badge tone="outline">{getChainMeta(collection.chain).short}</Badge>
            {collection.sovereign && <Badge tone="accent">Sovereign</Badge>}
          </div>

          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted line-clamp-3">
            {collection.description}
          </p>
        </div>

        <div className="shrink-0 lg:pt-1">
          <CollectionActions contractAddress={collection.contractAddress} />
        </div>
      </div>
    </header>
  );
}
