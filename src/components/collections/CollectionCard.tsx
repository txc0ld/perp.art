import Link from "next/link";
import type { Collection } from "@/lib/types";
import { getArtist } from "@/lib/mock-data";
import { GenerativeArt } from "@/components/art/GenerativeArt";
import { StatusGlyph } from "@/components/ui";
import { Tilt3D } from "@/components/visual/Tilt3D";
import { formatEth } from "@/lib/utils";

/**
 * OpenSea-style collection card: a wide GenerativeArt cover, an overlapping
 * circular avatar, name + verified/sovereign glyph, and a mono stats footer
 * (floor / volume / items). Hairline card, hover lift + border brighten.
 */
export function CollectionCard({ collection }: { collection: Collection }) {
  const artist = getArtist(collection.artistHandle);

  return (
    <Link
      href={`/collections/${collection.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-[10px] border border-border bg-surface transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1 hover:border-border-bright hover:shadow-[0_16px_44px_-28px_rgba(0,0,0,0.9)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      {/* Cover - tasteful pointer tilt + sheen (this is NOT an ArtTile) */}
      <Tilt3D max={6} lift={10} glare scale={1.0} className="relative aspect-[16/9] overflow-hidden bg-background">
        <GenerativeArt
          seed={collection.coverSeed}
          genre={collection.genre}
          size={800}
          className="h-full w-full transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.04]"
        />
        <div className="absolute right-3 top-3">
          <span className="rounded-full border border-border/60 bg-background/70 px-2.5 py-1 font-mono text-[9px] uppercase tracking-wider text-muted backdrop-blur-md">
            {collection.chain === "ethereum" ? "Ethereum" : "Base"}
          </span>
        </div>
      </Tilt3D>

      {/* Overlapping avatar */}
      <div className="relative px-4">
        <div className="absolute -top-7 h-14 w-14 overflow-hidden rounded-full border-[3px] border-surface bg-background">
          <GenerativeArt
            seed={`${collection.coverSeed}-avatar`}
            genre={collection.genre}
            size={120}
            className="h-full w-full"
          />
        </div>
      </div>

      <div className="flex flex-1 flex-col px-4 pb-4 pt-9">
        <div className="flex items-center gap-1.5">
          <h3 className="truncate text-[15px] font-semibold text-foreground">{collection.name}</h3>
          {(collection.sovereign || artist?.verified) && (
            <StatusGlyph status="verified" className="shrink-0" />
          )}
        </div>
        <p className="mt-0.5 truncate text-xs text-muted">{artist?.name ?? collection.artistHandle}</p>

        <div className="mt-auto grid grid-cols-3 gap-2 pt-4">
          <Stat label="Floor" value={`${formatEth(collection.floorEth)} ETH`} />
          <Stat label="Volume" value={`${formatEth(collection.volumeEth)} ETH`} />
          <Stat label="Items" value={String(collection.itemCount)} />
        </div>
      </div>
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="font-mono text-[9px] uppercase tracking-wider text-faint">{label}</p>
      <p className="mt-1 truncate font-mono text-[13px] tabular-nums text-foreground">{value}</p>
    </div>
  );
}
