import { NextResponse } from "next/server";
import { readOwnedTokenIds, readOnchainToken } from "@/lib/web3/read-token";

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
  const ids = await readOwnedTokenIds(chainId, owner);
  // Light metadata per token (cap at 24 to bound RPC work).
  const items = [];
  for (const id of ids.slice(0, 24)) {
    const t = await readOnchainToken(chainId, id);
    if (!t) continue;
    const state = t.permanence.shards.find((s) => s.index === 0);
    items.push({
      id: t.id,
      tokenId: t.tokenId,
      title: t.title,
      chainId,
      image: state?.sourceUrl ?? null,
    });
  }
  return NextResponse.json(
    { owner, chainId, count: ids.length, items },
    { headers: { "Cache-Control": "no-store" } },
  );
}
