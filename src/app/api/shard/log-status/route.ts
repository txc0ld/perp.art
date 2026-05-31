import { NextResponse } from "next/server";
import type { Hex } from "viem";
import { checkLogAvailability } from "@/lib/logledger/resolve";

/**
 * GET /api/shard/log-status?ledger=&fileId=[&chainId=]
 * Retention probe: is a LOG shard still reconstructable from public nodes right
 * now? Used by the Permanence panel and for manual/external monitoring.
 *
 * Note: a SCHEDULED job that sweeps every minted Log shard needs the indexer to
 * enumerate them (not built yet), so this is an on-demand probe for now.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADDR = /^0x[0-9a-fA-F]{40}$/;
const BYTES32 = /^0x[0-9a-fA-F]{64}$/;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const ledger = url.searchParams.get("ledger") ?? "";
  const fileId = url.searchParams.get("fileId") ?? "";
  const chainParam = url.searchParams.get("chainId");
  if (!ADDR.test(ledger) || !BYTES32.test(fileId)) {
    return NextResponse.json({ error: "invalid ledger or fileId" }, { status: 400 });
  }
  const result = await checkLogAvailability(
    ledger as Hex,
    fileId as Hex,
    chainParam ? Number(chainParam) : undefined,
  );
  return NextResponse.json(
    { ledger, fileId, ...result, checkedAt: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
