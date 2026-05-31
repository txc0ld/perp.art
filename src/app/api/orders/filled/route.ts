/**
 * POST /api/orders/filled
 *
 * Mark an order as filled (called after on-chain fulfillOrder confirmation).
 * Body: { chainId: number, orderHash: string }
 * Returns: { ok: true }  or  { error: string }  (400)
 */
import { NextResponse } from "next/server";
import { markFilled } from "@/lib/web3/orderbook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BYTES32_OR_HEX = /^0x[0-9a-fA-F]+$/;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "body must be an object" }, { status: 400 });
  }

  const { chainId, orderHash } = body as Record<string, unknown>;

  if (typeof chainId !== "number" || !Number.isInteger(chainId) || chainId <= 0) {
    return NextResponse.json({ error: "missing or invalid chainId" }, { status: 400 });
  }
  if (typeof orderHash !== "string" || !BYTES32_OR_HEX.test(orderHash)) {
    return NextResponse.json({ error: "missing or invalid orderHash" }, { status: 400 });
  }

  await markFilled(chainId, orderHash);

  return NextResponse.json({ ok: true });
}
