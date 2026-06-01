import { NextResponse } from "next/server";
import { readOwnedTokenIds, readOnchainToken } from "@/lib/web3/read-token";
import { indexCollections } from "@/lib/web3/indexer";
import type { Hex } from "viem";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADDR = /^0x[0-9a-fA-F]{40}$/;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const chainId = Number(url.searchParams.get("chainId"));
  const owner = url.searchParams.get("owner") ?? "";
  if (!Number.isInteger(chainId) || !ADDR.test(owner)) {
    return NextResponse.json(
      { error: "missing or invalid chainId/owner" },
      { status: 400 },
    );
  }

  const collections = await indexCollections(chainId);
  const items: Array<{
    id: string; tokenId: number; title: string;
    chainId: number; contract: string; image: string | null;
  }> = [];

  for (const col of collections) {
    if (items.length >= 24) break;
    const ids = await readOwnedTokenIds(chainId, col.address, owner, col.createdBlock);
    for (const id of ids) {
      if (items.length >= 24) break;
      const t = await readOnchainToken(chainId, col.address as Hex, id);
      if (!t) continue;
      const state = t.permanence.shards.find((s) => s.index === 0);
      items.push({
        id: t.id,
        tokenId: t.tokenId,
        title: t.title,
        chainId,
        contract: col.address.toLowerCase(),
        image: state?.sourceUrl ?? null,
      });
    }
  }

  return NextResponse.json(
    { owner, chainId, count: items.length, items },
    { headers: { "Cache-Control": "no-store" } },
  );
}
