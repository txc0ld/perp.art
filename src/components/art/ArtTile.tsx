"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Token } from "@/lib/types";
import { GenerativeArt } from "./GenerativeArt";
import { getArtist } from "@/lib/mock-data";
import { formatEth } from "@/lib/utils";
import { StatusGlyph } from "@/components/ui";

/**
 * OpenSea-style NFT card in the Perpetual theme: art-forward, hairline-bordered,
 * mono price, with a "Buy now" bar that slides up on hover. Keeps our signature
 * permanence indicator (top-left) and locked glyph (top-right) as the differentiator.
 */
export function ArtTile({ token, priority = false }: { token: Token; priority?: boolean }) {
  const router = useRouter();
  const artist = getArtist(token.artistHandle);
  const verifiedShards = token.permanence.shards.filter((s) => s.status === "verified").length;
  const lastSale = [...token.provenance].find((e) => e.kind === "sale")?.priceEth;

  return (
    <Link
      href={`/token/${token.id}`}
      className="group relative flex flex-col overflow-hidden rounded-[10px] border border-border bg-surface transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-border-bright hover:shadow-[0_12px_40px_-24px_rgba(0,0,0,0.9)]"
    >
      <div className="relative aspect-square overflow-hidden bg-background">
        <GenerativeArt
          seed={token.artSeed}
          genre={token.genre}
          size={priority ? 800 : 600}
          className="h-full w-full transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.04]"
        />

        {/* permanence indicator */}
        <div className="absolute left-2.5 top-2.5 flex items-center gap-1.5 rounded-full border border-border/60 bg-background/70 px-2 py-1 backdrop-blur-md transition-colors duration-300 group-hover:border-accent/40">
          <StatusGlyph status="verified" />
          <span className="font-mono text-[10px] uppercase tracking-wider text-accent">{verifiedShards}</span>
        </div>
        {token.permanence.locked && (
          <div className="absolute right-2.5 top-2.5 rounded-full border border-border/60 bg-background/70 p-1.5 backdrop-blur-md" title="Shards locked, immutable">
            <svg viewBox="0 0 16 16" className="h-3 w-3 text-accent" fill="none">
              <rect x="3.5" y="7" width="9" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.3" />
              <path d="M5.5 7V5.5a2.5 2.5 0 015 0V7" stroke="currentColor" strokeWidth="1.3" />
            </svg>
          </div>
        )}

        {/* Buy now bar, slides up on hover (OpenSea signature) */}
        {token.listing && (
          <button
            onClick={(e) => {
              e.preventDefault();
              router.push(`/token/${token.id}`);
            }}
            className="absolute inset-x-0 bottom-0 translate-y-full bg-accent py-2.5 text-center text-sm font-semibold text-background transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-y-0"
          >
            Buy now
          </button>
        )}
      </div>

      <div className="flex flex-col gap-1 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-[13px] text-muted">{artist?.name ?? token.artistHandle}</p>
          {token.chain === "base" ? (
            <span className="font-mono text-[9px] uppercase tracking-wider text-faint">Base</span>
          ) : null}
        </div>
        <p className="truncate text-sm font-semibold text-foreground">{token.title}</p>
        <div className="mt-1.5 flex items-end justify-between gap-2">
          <div className="min-w-0">
            <p className="font-mono text-[9px] uppercase tracking-wider text-faint">Price</p>
            {token.listing ? (
              <p className="truncate font-mono text-sm tabular-nums text-foreground">{formatEth(token.listing.priceEth)} ETH</p>
            ) : (
              <p className="truncate font-mono text-[13px] text-faint">-</p>
            )}
          </div>
          <div className="shrink-0 text-right">
            <p className="font-mono text-[9px] uppercase tracking-wider text-faint">Last sale</p>
            <p className="font-mono text-[13px] tabular-nums text-muted">
              {lastSale ? `${formatEth(lastSale)} ETH` : "-"}
            </p>
          </div>
        </div>
      </div>
    </Link>
  );
}
