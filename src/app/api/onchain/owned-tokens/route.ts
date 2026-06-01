import { NextResponse } from "next/server";
import { getLiveTokensByOwner } from "@/lib/live/catalog";

/**
 * Live works owned by an address across the live chains, returned as
 * fully-serialized Token objects (with permanence + provenance) so the client
 * profile can drive Collected, Permanence, and Activity from one source.
 * Fail-soft: any error degrades to an empty list.
 *
 * GET /api/onchain/owned-tokens?address=0x..  -> { address, count, tokens }
 *
 * NOTE: distinct from /api/onchain/owned, which returns a lightweight,
 * chain-scoped projection consumed by the "on-chain works" strip.
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
    const tokens = await getLiveTokensByOwner(address);
    return NextResponse.json(
      { address, count: tokens.length, tokens },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ address, count: 0, tokens: [] });
  }
}
