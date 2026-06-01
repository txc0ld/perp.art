import { NextResponse } from "next/server";
import { getFirstActivityDate } from "@/lib/live/catalog";

/**
 * The real "joined" signal for an address: the earliest on-chain mint timestamp
 * across the works it created or owns, or null when the address has no on-chain
 * history. The profile shows "Joined …" only when this is non-null — never a
 * fabricated date. Fail-soft: any error degrades to null.
 *
 * GET /api/profile/joined?address=0x..  -> { joinedAt: string | null }
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADDR = /^0x[0-9a-fA-F]{40}$/;

export async function GET(request: Request): Promise<NextResponse> {
  const address = new URL(request.url).searchParams.get("address") ?? "";
  if (!ADDR.test(address)) {
    return NextResponse.json({ joinedAt: null });
  }
  try {
    const joinedAt = await getFirstActivityDate(address);
    return NextResponse.json(
      { joinedAt },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ joinedAt: null });
  }
}
