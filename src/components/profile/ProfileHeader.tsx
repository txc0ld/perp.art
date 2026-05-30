"use client";

import { useState } from "react";
import type { Genre, Token } from "@/lib/types";
import { GenerativeArt } from "@/components/art/GenerativeArt";
import { Button, StatusGlyph } from "@/components/ui";
import { shortAddress, formatEth, relativeTime } from "@/lib/utils";

/**
 * ProfileHeader (OpenSea-style identity block in the Perpetual theme).
 * A wide full-bleed GenerativeArt banner, a circular identicon avatar overlapping
 * its bottom-left, the display name + verified/sovereign mark, the address in mono
 * with a copy affordance, joined date, and secondary Edit/Share actions on the right.
 * Below sits a hairline-separated OpenSea-style stats strip.
 * The profile represents the connected user.
 */
export function ProfileHeader({
  address,
  handle,
  name,
  joinedAt,
  verified,
  sovereign,
  bannerGenre,
  ownedTokens,
  createdCount,
  collectionsCount,
}: {
  address: string;
  handle: string;
  name: string;
  joinedAt?: string;
  verified?: boolean;
  sovereign?: boolean;
  bannerGenre: Genre;
  ownedTokens: Token[];
  createdCount: number;
  collectionsCount: number;
}) {
  const [copied, setCopied] = useState(false);

  const totalValue = ownedTokens.reduce(
    (sum, t) => sum + (t.listing?.priceEth ?? t.offers[0]?.priceEth ?? 0),
    0,
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* ignore */
    }
  }

  const stats: Array<{ label: string; value: string }> = [
    { label: "Items", value: String(ownedTokens.length) },
    { label: "Created", value: String(createdCount) },
    { label: "Est. value", value: `${formatEth(totalValue)} ETH` },
    { label: "Collections", value: String(collectionsCount) },
  ];

  const showMark = verified || sovereign;

  return (
    <header className="animate-rise">
      {/* Banner */}
      <div className="relative h-[200px] overflow-hidden rounded-[10px] border border-border bg-background sm:h-[230px] lg:h-[260px]">
        <GenerativeArt
          seed={`banner:${address}`}
          genre={bannerGenre}
          size={1200}
          className="h-full w-full"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background/85 via-background/15 to-transparent" />
      </div>

      {/* Identity row - avatar overlaps the banner bottom-left */}
      <div className="relative px-1">
        <div className="absolute -top-12 left-0 h-[100px] w-[100px] overflow-hidden rounded-full border-4 border-background bg-background sm:-top-14 sm:h-[110px] sm:w-[110px]">
          <div className="h-full w-full overflow-hidden rounded-full ring-1 ring-border-bright">
            <GenerativeArt
              seed={`identicon:${address}`}
              genre={bannerGenre}
              size={240}
              className="h-full w-full"
            />
          </div>
        </div>
      </div>

      <div className="mt-14 flex flex-col gap-4 sm:mt-16 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <h1 className="display-sm font-brand text-foreground">{name}</h1>
            {showMark && (
              <span
                className="inline-flex items-center"
                title={sovereign ? "Sovereign creator" : "Verified"}
              >
                <StatusGlyph status="verified" className="h-5 w-5" />
              </span>
            )}
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="font-mono text-sm text-muted">@{handle}</span>
            <button
              type="button"
              onClick={copy}
              className="group inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 font-mono text-[11px] text-muted transition-colors hover:border-border-bright hover:text-foreground"
              title="Copy address"
            >
              <span className="tabular-nums">{shortAddress(address)}</span>
              {copied ? (
                <svg viewBox="0 0 16 16" className="h-3 w-3 text-accent" fill="none" aria-label="copied">
                  <path d="M3.5 8.5l3 3 6-6.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <svg viewBox="0 0 16 16" className="h-3 w-3 text-faint transition-colors group-hover:text-muted" fill="none" aria-label="copy">
                  <rect x="5.5" y="5.5" width="7" height="7" rx="1.2" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M3.5 10.5V4a.5.5 0 01.5-.5h6.5" stroke="currentColor" strokeWidth="1.2" />
                </svg>
              )}
            </button>
            {joinedAt && (
              <span className="font-mono text-[11px] uppercase tracking-wider text-faint">
                Joined {relativeTime(joinedAt)}
              </span>
            )}
          </div>
        </div>

        {/* Secondary actions */}
        <div className="flex shrink-0 items-center gap-2.5">
          <Button variant="secondary" size="md">
            Edit profile
          </Button>
          <Button variant="secondary" size="md" aria-label="Share profile" className="px-3">
            <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden>
              <path d="M11 5.5l-3-3-3 3M8 2.5V10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M3.5 9v3a1.5 1.5 0 001.5 1.5h6A1.5 1.5 0 0012.5 12V9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            <span className="hidden sm:inline">Share</span>
          </Button>
        </div>
      </div>

      {/* OpenSea-style hairline-separated stats strip */}
      <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-[10px] border border-border bg-border sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-background px-5 py-4">
            <dt className="label-mono text-faint">{s.label}</dt>
            <dd className="mt-2 font-mono text-lg tabular-nums text-foreground">{s.value}</dd>
          </div>
        ))}
      </dl>
    </header>
  );
}
