import Link from "next/link";
import type { Collection, Artist } from "@/lib/types";
import { GenerativeArt } from "@/components/art/GenerativeArt";
import { Badge, StatusGlyph } from "@/components/ui";

/**
 * OpenSea-style collection hero: a wide GenerativeArt banner with a circular
 * avatar overlapping its bottom-left, then name + verified/sovereign + chain
 * badges, artist link, and clamped description.
 */
export function CollectionHero({
  collection,
  artist,
}: {
  collection: Collection;
  artist?: Artist;
}) {
  return (
    <header>
      {/* Banner */}
      <div className="relative h-[200px] overflow-hidden rounded-[10px] border border-border bg-background sm:h-[240px] lg:h-[280px]">
        <GenerativeArt
          seed={collection.coverSeed}
          genre={collection.genre}
          size={1200}
          className="h-full w-full"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/10 to-transparent" />
      </div>

      {/* Avatar + identity */}
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

      <div className="mt-14 sm:mt-16">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="display-sm font-brand text-foreground">{collection.name}</h1>
          {(collection.sovereign || artist?.verified) && (
            <span className="inline-flex items-center" title={collection.sovereign ? "Sovereign contract" : "Verified"}>
              <StatusGlyph status="verified" className="h-5 w-5" />
            </span>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge tone="muted">{collection.genre}</Badge>
          <Badge tone="outline">{collection.chain === "ethereum" ? "Ethereum" : "Base"}</Badge>
          {collection.sovereign && <Badge tone="accent">Sovereign</Badge>}
        </div>

        {artist && (
          <p className="mt-4 text-sm text-muted">
            by{" "}
            <Link
              href={`/profile/${artist.handle}`}
              className="text-foreground underline decoration-border underline-offset-4 transition-colors hover:decoration-accent"
            >
              {artist.name}
            </Link>
          </p>
        )}

        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted line-clamp-3">
          {collection.description}
        </p>
      </div>
    </header>
  );
}
