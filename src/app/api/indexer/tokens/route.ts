import { NextResponse } from "next/server";
import { indexAllTokens } from "@/lib/web3/indexer";

/**
 * GET /api/indexer/tokens?chainId=84532
 * Returns all live on-chain tokens for the requested chain (default Base Sepolia 84532).
 * Uses the module-level TTL cache in indexer.ts (60 s); this layer adds a 30 s
 * public CDN/browser cache on top.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("chainId");
  const chainId = raw !== null ? parseInt(raw, 10) : 84532;

  if (Number.isNaN(chainId)) {
    return NextResponse.json({ error: "invalid chainId" }, { status: 400 });
  }

  const tokens = await indexAllTokens(chainId);

  return NextResponse.json(
    { tokens },
    { headers: { "Cache-Control": "public, max-age=30" } },
  );
}
