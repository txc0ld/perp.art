import { NextResponse } from "next/server";
import { getLiveCollectionsByOwner } from "@/lib/live/catalog";

/**
 * Live sovereign collections deployed by an address (factory
 * CollectionCreated.owner). Returned as serialized Collection records so the
 * client Sovereign Contracts tab can render them. Fail-soft: any error degrades
 * to an empty list.
 *
 * GET /api/onchain/collections?address=0x..  -> { address, count, collections }
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADDR = /^0x[0-9a-fA-F]{40}$/;

export async function GET(request: Request): Promise<NextResponse> {
  const address = new URL(request.url).searchParams.get("address") ?? "";
  if (!ADDR.test(address)) {
    return NextResponse.json({ address, count: 0, collections: [] });
  }
  try {
    const collections = await getLiveCollectionsByOwner(address);
    return NextResponse.json(
      { address, count: collections.length, collections },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ address, count: 0, collections: [] });
  }
}
