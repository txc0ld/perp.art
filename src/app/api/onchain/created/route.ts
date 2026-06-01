import { NextResponse } from "next/server";
import { getLiveTokensByCreator } from "@/lib/live/catalog";

/**
 * Live works created by an address (creator = ERC-2981 royalty receiver),
 * returned as fully-serialized Token objects so the client Created tab can
 * render them with ArtTile. Fail-soft: any error degrades to an empty list.
 *
 * GET /api/onchain/created?address=0x..  -> { address, count, tokens }
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADDR = /^0x[0-9a-fA-F]{40}$/;

export async function GET(request: Request): Promise<NextResponse> {
  const address = new URL(request.url).searchParams.get("address") ?? "";
  if (!ADDR.test(address)) {
    return NextResponse.json({ address, count: 0, tokens: [] });
  }
  try {
    const tokens = await getLiveTokensByCreator(address);
    return NextResponse.json(
      { address, count: tokens.length, tokens },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ address, count: 0, tokens: [] });
  }
}
