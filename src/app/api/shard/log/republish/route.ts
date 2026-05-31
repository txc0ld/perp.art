import { NextResponse } from "next/server";
import type { Hex } from "viem";
import { reEmitLogShard } from "@/lib/logledger/resolve";

/**
 * POST /api/shard/log/republish
 * Re-emission tool: restore a token's high-res LOG copy after its event logs
 * have been pruned. Re-publishes the SAME bytes (fetched from a surviving copy)
 * under a fresh version; identical bytes → identical Merkle root, so it verifies
 * against the original on-chain commitment. Trustless — anyone can call it.
 *
 * Body: { chainId, contentHash, sourceUrl, version? }
 *   sourceUrl: a URL to fetch the authentic bytes from (an IPFS/Arweave/Irys
 *   gateway, the resolver's own cache, or a holder's copy).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const BYTES32 = /^0x[0-9a-fA-F]{64}$/;

export async function POST(request: Request) {
  let body: { chainId?: number; contentHash?: string; sourceUrl?: string; version?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const { chainId, contentHash, sourceUrl, version } = body;
  if (!chainId || !Number.isInteger(chainId)) {
    return NextResponse.json({ error: "missing chainId" }, { status: 400 });
  }
  if (!contentHash || !BYTES32.test(contentHash)) {
    return NextResponse.json({ error: "missing or invalid contentHash" }, { status: 400 });
  }
  if (!sourceUrl || !/^https?:\/\//.test(sourceUrl)) {
    return NextResponse.json({ error: "missing or invalid sourceUrl" }, { status: 400 });
  }

  const result = await reEmitLogShard({
    chainId,
    contentHash: contentHash as Hex,
    sourceUrl,
    version: typeof version === "number" ? version : undefined,
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 502, headers: { "Cache-Control": "no-store" } });
}
