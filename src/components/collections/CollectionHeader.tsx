import Link from "next/link";
import type { Collection, Artist } from "@/lib/types";
import { bpsToPct } from "@/lib/utils";
import { Badge } from "@/components/ui";
import { CopyAddress } from "./CopyAddress";
import { StatStrip } from "./StatStrip";

/**
 * Collection detail header: large name, artist, description, contract address (mono
 * + copy), chain + sovereign badges, royalty %, and the mono stats strip.
 */
export function CollectionHeader({
  collection,
  artist,
}: {
  collection: Collection;
  artist?: Artist;
}) {
  return (
    <header className="flex flex-col gap-8">
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="muted">{collection.genre}</Badge>
          <Badge tone="outline">{collection.chain === "ethereum" ? "Ethereum" : "Base"}</Badge>
          {collection.sovereign && <Badge tone="accent">Sovereign Contract</Badge>}
        </div>

        <div className="max-w-3xl">
          <h1 className="display-sm text-foreground">{collection.name}</h1>
          {artist && (
            <p className="mt-3 text-sm text-muted">
              by{" "}
              <Link
                href={`/profile/${artist.handle}`}
                className="text-foreground underline decoration-border underline-offset-4 transition-colors hover:decoration-accent"
              >
                {artist.name}
              </Link>
              {artist.verified && <span className="ml-2 align-middle text-accent" title="Verified artist">✦</span>}
            </p>
          )}
          <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-muted">{collection.description}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <CopyAddress address={collection.contractAddress} />
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5">
            <span className="font-mono text-[9px] uppercase tracking-wider text-faint">Royalty</span>
            <span className="font-mono text-xs tabular-nums text-foreground">{bpsToPct(collection.royaltyBps)}</span>
          </div>
        </div>
      </div>

      <StatStrip collection={collection} size="lg" />
    </header>
  );
}
