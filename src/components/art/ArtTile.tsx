"use client";

import Link from "next/link";
import type { Token } from "@/lib/types";
import { GenerativeArt } from "./GenerativeArt";
import { getArtist, getChainMeta } from "@/lib/mock-data";
import { formatEth } from "@/lib/utils";
import { StatusGlyph } from "@/components/ui";
import { ChainBadge } from "@/components/chain/ChainBadge";
import { Tilt3D } from "@/components/visual/Tilt3D";

/**
 * Derive the token detail href. Live on-chain tokens use
 * `/token/onchain/{chainId}/{tokenId}`; mock tokens use `/token/{id}`.
 */
function tokenHref(token: Token): string {
  if (token.source === "onchain") {
    const chainId = token.chain === "base" ? 84532 : 11155111;
    return `/token/onchain/${chainId}/${token.tokenId}`;
  }
  return `/token/${token.id}`;
}

/**
 * OpenSea-style NFT card in the Perpetual theme, lifted with a tasteful pointer
 * tilt (Tilt3D): the artwork leans toward the cursor with a soft specular sheen.
 * Keeps the signature permanence indicator and the hover "Buy now" bar.
 */
export function ArtTile({ token, priority = false }: { token: Token; priority?: boolean }) {
  const artist = getArtist(token.artistHandle);
  const verifiedShards = token.permanence.shards.filter((s) => s.status === "verified").length;
  const lastSale = [...token.provenance].find((e) => e.kind === "sale")?.priceEth;
  const currency = getChainMeta(token.chain).currency;
  const isOnchain = token.source === "onchain";

  return (
    <Link
      href={tokenHref(token)}
      aria-label={`${token.title} by ${artist?.name ?? token.artistHandle}${token.listing ? `, listed for ${formatEth(token.listing.priceEth)} ${currency}` : ""}`}
      className="block rounded-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <Tilt3D
        max={6}
        lift={10}
        className="flex flex-col overflow-hidden rounded-[10px] border border-border bg-surface transition-[border-color,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-border-bright hover:shadow-[0_22px_60px_-30px_rgba(0,0,0,0.95)]"
      >
        <div className="relative aspect-square overflow-hidden bg-background">
          <GenerativeArt
            seed={token.artSeed}
            genre={token.genre}
            size={priority ? 800 : 600}
            className="h-full w-full"
          />

          {/* permanence indicator */}
          <div className="absolute left-2.5 top-2.5 flex items-center gap-1.5 rounded-full border border-border/60 bg-background/70 px-2 py-1 backdrop-blur-md transition-colors duration-300 group-hover:border-accent/40">
            <StatusGlyph status="verified" />
            <span className="font-mono text-[10px] uppercase tracking-wider text-accent">{verifiedShards}</span>
          </div>

          {/* on-chain badge for live tokens */}
          {isOnchain && (
            <div className="absolute bottom-2.5 left-2.5 rounded-full border border-accent/40 bg-background/80 px-2 py-0.5 backdrop-blur-md">
              <span className="font-mono text-[9px] uppercase tracking-widest text-accent">On-chain</span>
            </div>
          )}
          {token.permanence.locked && (
            <div className="absolute right-2.5 top-2.5 rounded-full border border-border/60 bg-background/70 p-1.5 backdrop-blur-md" title="Shards locked, immutable">
              <span className="sr-only">Shards locked, immutable</span>
              <svg viewBox="0 0 16 16" className="h-3 w-3 text-accent" fill="none" aria-hidden>
                <rect x="3.5" y="7" width="9" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.3" />
                <path d="M5.5 7V5.5a2.5 2.5 0 015 0V7" stroke="currentColor" strokeWidth="1.3" />
              </svg>
            </div>
          )}

          {/* Buy now bar, slides up on hover. Decorative: the whole card links. */}
          {token.listing && (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-full bg-accent py-2.5 text-center text-sm font-semibold text-background transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-y-0"
            >
              Buy now
            </span>
          )}
        </div>

        <div className="flex flex-col gap-1 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-[13px] text-muted">{artist?.name ?? token.artistHandle}</p>
            <ChainBadge chain={token.chain} className="shrink-0 px-1.5 py-0 text-[9px]" />
          </div>
          <p className="truncate text-sm font-semibold text-foreground">{token.title}</p>
          <div className="mt-1.5 flex items-end justify-between gap-2">
            <div className="min-w-0">
              <p className="font-mono text-[9px] uppercase tracking-wider text-faint">Price</p>
              {token.listing ? (
                <p className="truncate font-mono text-sm tabular-nums text-foreground">{formatEth(token.listing.priceEth)} {currency}</p>
              ) : (
                <p className="truncate font-mono text-[13px] text-faint">-</p>
              )}
            </div>
            <div className="shrink-0 text-right">
              <p className="font-mono text-[9px] uppercase tracking-wider text-faint">Last sale</p>
              <p className="font-mono text-[13px] tabular-nums text-muted">
                {lastSale ? `${formatEth(lastSale)} ${currency}` : "-"}
              </p>
            </div>
          </div>
        </div>
      </Tilt3D>
    </Link>
  );
}
