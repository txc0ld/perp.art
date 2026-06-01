import { put, list } from "@vercel/blob";
import { NextResponse } from "next/server";

/**
 * Server-side profile store. A user's edited name/bio and uploaded avatar/banner
 * are persisted as a JSON blob at a deterministic path (`profiles/<address>.json`)
 * in Vercel Blob — so profiles live on the server and are shared across devices,
 * not just in one browser.
 *
 * GET  /api/profile?address=0x..   -> the stored overrides (or {} if none)
 * POST /api/profile { address, .. } -> upsert the overrides
 *
 * NOTE (testnet): writes are currently unauthenticated. Before mainnet this must
 * be gated on a SIWE / signed-message proof that the caller controls `address`.
 * Stored image URLs are validated to be Vercel Blob URLs to avoid persisting
 * arbitrary off-site references.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NAME_MAX = 48;
const BIO_MAX = 240;

interface ProfileData {
  name?: string;
  bio?: string;
  avatarUrl?: string;
  bannerUrl?: string;
  updatedAt?: string;
}

function isAddress(a: unknown): a is string {
  return typeof a === "string" && /^0x[0-9a-fA-F]{40}$/.test(a);
}

function isBlobUrl(u: unknown): u is string {
  return (
    typeof u === "string" &&
    /^https:\/\/[a-z0-9.-]+\.public\.blob\.vercel-storage\.com\//.test(u)
  );
}

const pathFor = (address: string) => `profiles/${address.toLowerCase()}.json`;

export async function GET(request: Request): Promise<NextResponse> {
  const address = new URL(request.url).searchParams.get("address");
  if (!isAddress(address)) return NextResponse.json({});
  try {
    const { blobs } = await list({ prefix: pathFor(address), limit: 1 });
    if (blobs.length === 0) return NextResponse.json({});
    const res = await fetch(blobs[0].url, { cache: "no-store" });
    if (!res.ok) return NextResponse.json({});
    return NextResponse.json((await res.json()) as ProfileData);
  } catch {
    return NextResponse.json({});
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const address = body.address;
  if (!isAddress(address)) {
    return NextResponse.json({ error: "invalid address" }, { status: 400 });
  }

  const data: ProfileData = {
    name: typeof body.name === "string" ? body.name.trim().slice(0, NAME_MAX) : undefined,
    bio: typeof body.bio === "string" ? body.bio.trim().slice(0, BIO_MAX) : undefined,
    avatarUrl: isBlobUrl(body.avatarUrl) ? body.avatarUrl : undefined,
    bannerUrl: isBlobUrl(body.bannerUrl) ? body.bannerUrl : undefined,
    updatedAt: new Date().toISOString(),
  };

  try {
    await put(pathFor(address), JSON.stringify(data), {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "save failed" },
      { status: 500 },
    );
  }
}
