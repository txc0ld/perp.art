"use client";

import { useState, useEffect, useMemo } from "react";
import type { Genre, Token } from "@/lib/types";
import { GenerativeArt } from "@/components/art/GenerativeArt";
import { Button } from "@/components/ui";
import { shortAddress, formatEth, relativeTime } from "@/lib/utils";
import { displayName } from "@/lib/ens";
import { useEnsName } from "@/lib/use-ens";
import { loadProfile, saveProfile } from "@/lib/profile-store";
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
  ownedTokens,
  createdCount,
  collectionsCount,
}: {
  address: string;
  ownedTokens: Token[];
  createdCount: number;
  collectionsCount: number;
}) {
  // The display name follows a strict precedence: server profile override →
  // real ENS name → short address. Until either resolves we show the short
  // address (never a fabricated handle).
  const ens = useEnsName(address);
  const [profileName, setProfileName] = useState<string | undefined>(undefined);
  const [bio, setBio] = useState<string | undefined>(undefined);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const [bannerUrl, setBannerUrl] = useState<string | undefined>(undefined);
  const [joinedAt, setJoinedAt] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const [editing, setEditing] = useState(false);

  // The banner/avatar identicon is keyed by the genre the wallet holds most, so
  // it is deterministic per wallet without any fabricated identity.
  const bannerGenre: Genre = useMemo(() => {
    const counts = new Map<Genre, number>();
    for (const t of ownedTokens) counts.set(t.genre, (counts.get(t.genre) ?? 0) + 1);
    let best: Genre = "Abstract";
    let bestN = 0;
    for (const [g, n] of counts) {
      if (n > bestN) {
        best = g;
        bestN = n;
      }
    }
    return best;
  }, [ownedTokens]);

  const name = profileName ?? displayName(address, ens);

  // Hydrate server-stored profile overrides (name/bio/avatar/banner) for this address.
  useEffect(() => {
    let live = true;
    loadProfile(address).then((o) => {
      if (!live) return;
      setProfileName(o.name || undefined);
      setBio(o.bio || undefined);
      setAvatarUrl(o.avatarUrl);
      setBannerUrl(o.bannerUrl);
    });
    return () => {
      live = false;
    };
  }, [address]);

  // Real "joined" = first on-chain activity for this wallet. Omitted when null.
  useEffect(() => {
    let live = true;
    fetch(`/api/profile/joined?address=${encodeURIComponent(address)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { joinedAt: null }))
      .then((d: { joinedAt: string | null }) => {
        if (live) setJoinedAt(d.joinedAt ?? null);
      })
      .catch(() => {
        if (live) setJoinedAt(null);
      });
    return () => {
      live = false;
    };
  }, [address]);

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
    { label: "Est. value (approx)", value: totalValue > 0 ? `${formatEth(totalValue)} ETH-eq` : "—" },
    { label: "Collections", value: String(collectionsCount) },
  ];

  // Show the ENS chip only when a real name resolved AND it isn't already what
  // the heading shows (i.e. there's a server override name in front of it).
  const showEnsChip = !!ens && name !== ens;

  return (
    <header className="animate-rise">
      {/* Banner */}
      <div className="relative h-[160px] overflow-hidden rounded-[10px] border border-border bg-background sm:h-[230px] lg:h-[260px]">
        {bannerUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={bannerUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <GenerativeArt
            seed={`banner:${address}`}
            genre={bannerGenre}
            size={1200}
            className="h-full w-full"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background/85 via-background/15 to-transparent" aria-hidden />
      </div>

      {/* Identity block. The avatar stays in normal flow (pulled up with a
          negative margin so it overlaps the banner's bottom-left); the name,
          bio, and actions always sit below it — so nothing can clip or collide
          at any width, from 360px up. */}
      <div className="relative">
        <div className="-mt-10 sm:-mt-[68px]">
          <div className="h-[84px] w-[84px] overflow-hidden rounded-full border-4 border-background bg-background sm:h-[120px] sm:w-[120px]">
            <div className="h-full w-full overflow-hidden rounded-full ring-1 ring-border-bright">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <GenerativeArt
                  seed={`identicon:${address}`}
                  genre={bannerGenre}
                  size={240}
                  className="h-full w-full"
                />
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <h1 className="display-sm font-brand text-foreground">{name}</h1>
            </div>

            {bio && <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">{bio}</p>}

            <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
              {showEnsChip && (
                <span
                  className="inline-flex items-center gap-1.5 font-sans text-sm font-medium text-foreground"
                  title={`Primary ENS name for ${address}`}
                >
                  <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                  {ens}
                </span>
              )}
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
          initialBio={bio ?? ""}
          initialAvatarUrl={avatarUrl}
          initialBannerUrl={bannerUrl}
          address={address}
          bannerGenre={bannerGenre}
          onClose={() => setEditing(false)}
          onSave={({ name: nextName, bio: nextBio, avatarUrl: nextAvatar, bannerUrl: nextBanner }) => {
            setProfileName(nextName);
            setBio(nextBio);
            setAvatarUrl(nextAvatar);
            setBannerUrl(nextBanner);
            void saveProfile(address, {
              name: nextName,
              bio: nextBio,
              avatarUrl: nextAvatar,
              bannerUrl: nextBanner,
            });
          }}
        />
      )}
    </header>
  );
}
