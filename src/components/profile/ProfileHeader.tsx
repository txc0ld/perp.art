"use client";

import { useState } from "react";
import type { Genre, Token } from "@/lib/types";
import { GenerativeArt } from "@/components/art/GenerativeArt";
import { Button, VerifiedBadge } from "@/components/ui";
import { shortAddress, formatEth, relativeTime } from "@/lib/utils";
import { resolveEns } from "@/lib/mock-data";
import { EditProfileModal } from "./EditProfileModal";

/**
 * ProfileHeader (OpenSea-style identity block in the Perpetual theme).
 * A wide full-bleed GenerativeArt banner, a circular identicon avatar overlapping
 * its bottom-left, the display name + verified/sovereign mark, the address in mono
 * with a copy affordance, joined date, and Edit/Share actions.
 * Edit opens a modal whose result is lifted into local header state. Share copies
 * the public profile link with a live confirmation. Below sits a hairline-separated
 * stats strip that wraps 2-up on mobile. The profile represents the connected user.
 *
 * Mobile: on small screens the name + actions stack under the avatar (the avatar
 * sits in normal flow, not overlapping) so nothing clips or collides at 360px.
 */
export function ProfileHeader({
  address,
  handle,
  name: initialName,
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
  const [name, setName] = useState(initialName);
  const [bio, setBio] = useState(
    "Permanence-first works, hash-anchored onchain and kept across independent shards.",
  );
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const [editing, setEditing] = useState(false);

  const totalValue = ownedTokens.reduce(
    (sum, t) => sum + (t.listing?.priceEth ?? t.offers[0]?.priceEth ?? 0),
    0,
  );

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  }

  async function share() {
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}/profile`
        : "/profile";
    try {
      await navigator.clipboard.writeText(url);
      setShared(true);
      setTimeout(() => setShared(false), 1800);
    } catch {
      /* ignore */
    }
  }

  const stats: Array<{ label: string; value: string }> = [
    { label: "Items", value: String(ownedTokens.length) },
    { label: "Created", value: String(createdCount) },
    { label: "Est. value (approx)", value: `${formatEth(totalValue)} ETH-eq` },
    { label: "Collections", value: String(collectionsCount) },
  ];

  const showMark = verified || sovereign;
  const ens = resolveEns(address);

  return (
    <header className="animate-rise">
      {/* Banner */}
      <div className="relative h-[160px] overflow-hidden rounded-[10px] border border-border bg-background sm:h-[230px] lg:h-[260px]">
        <GenerativeArt
          seed={`banner:${address}`}
          genre={bannerGenre}
          size={1200}
          className="h-full w-full"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background/85 via-background/15 to-transparent" aria-hidden />
      </div>

      {/* Identity block.
          Mobile: avatar sits in normal flow (no overlap, no clipping), name + actions stack below.
          sm+: avatar overlaps the banner bottom-left, name/actions sit in a row beside it. */}
      <div className="relative">
        <div className="-mt-9 sm:absolute sm:-top-14 sm:left-1 sm:mt-0">
          <div className="h-[84px] w-[84px] overflow-hidden rounded-full border-4 border-background bg-background sm:h-[110px] sm:w-[110px]">
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

        <div className="mt-4 flex flex-col gap-4 sm:mt-16 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <h1 className="display-sm font-brand text-foreground">{name}</h1>
              {showMark && (
                <VerifiedBadge size={20} label={sovereign ? "Sovereign creator" : "Verified"} />
              )}
            </div>

            {bio && <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">{bio}</p>}

            <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
              {ens && (
                <span
                  className="inline-flex items-center gap-1.5 font-sans text-sm font-medium text-foreground"
                  title={`Primary ENS name for ${address}`}
                >
                  <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                  {ens}
                </span>
              )}
              <span className="font-mono text-sm text-muted">@{handle}</span>
              <button
                type="button"
                onClick={copyAddress}
                aria-label={`Copy wallet address ${address}`}
                className="group inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 font-mono text-[11px] text-muted transition-colors hover:border-border-bright hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
              >
                <span className="tabular-nums">{shortAddress(address)}</span>
                {copied ? (
                  <svg viewBox="0 0 16 16" className="h-3 w-3 text-accent" fill="none" aria-hidden>
                    <path d="M3.5 8.5l3 3 6-6.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 16 16" className="h-3 w-3 text-faint transition-colors group-hover:text-muted" fill="none" aria-hidden>
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

            {/* Live confirmation for copy + share */}
            <p aria-live="polite" className="sr-only">
              {copied ? "Wallet address copied to clipboard." : ""}
              {shared ? "Profile link copied to clipboard." : ""}
            </p>
          </div>

          {/* Actions */}
          <div className="flex shrink-0 flex-wrap items-center gap-2.5">
            <Button
              variant="secondary"
              size="md"
              className="min-h-[44px]"
              onClick={() => setEditing(true)}
            >
              Edit profile
            </Button>
            <Button
              variant="secondary"
              size="md"
              className="min-h-[44px] px-3.5"
              onClick={share}
            >
              <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden>
                <path d="M11 5.5l-3-3-3 3M8 2.5V10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M3.5 9v3a1.5 1.5 0 001.5 1.5h6A1.5 1.5 0 0012.5 12V9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              <span>{shared ? "Link copied" : "Share"}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Stats strip - 2-up on mobile, 4-up sm+ */}
      <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-[10px] border border-border bg-border sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-background px-4 py-4 sm:px-5">
            <dt className="label-mono text-faint">{s.label}</dt>
            <dd className="mt-2 font-mono text-lg tabular-nums text-foreground">{s.value}</dd>
          </div>
        ))}
      </dl>

      {editing && (
        <EditProfileModal
          initialName={name}
          initialBio={bio}
          onClose={() => setEditing(false)}
          onSave={({ name: nextName, bio: nextBio }) => {
            setName(nextName);
            setBio(nextBio);
          }}
        />
      )}
    </header>
  );
}
