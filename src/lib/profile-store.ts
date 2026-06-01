"use client";

/**
 * Client wrapper for the server-side profile store (`/api/profile`). A user's
 * name/bio and uploaded avatar/banner are persisted server-side (Vercel Blob),
 * keyed by wallet address, so they are shared across devices — not kept in one
 * browser's localStorage.
 */
export interface ProfileOverrides {
  name?: string;
  bio?: string;
  avatarUrl?: string;
  bannerUrl?: string;
}

export async function loadProfile(address: string): Promise<ProfileOverrides> {
  if (!address) return {};
  try {
    const res = await fetch(`/api/profile?address=${encodeURIComponent(address)}`, {
      cache: "no-store",
    });
    if (!res.ok) return {};
    return (await res.json()) as ProfileOverrides;
  } catch {
    return {};
  }
}

export async function saveProfile(address: string, data: ProfileOverrides): Promise<boolean> {
  if (!address) return false;
  try {
    const res = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address, ...data }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
