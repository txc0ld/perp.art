/**
 * /api/orders
 *
 * POST — Submit a signed order for storage.
 *   Body: SerializedSignedOrder
 *   Validates shape, recovers signer via viem verifyTypedData, stores in Blob.
 *   Returns: { ok: true, orderHash }  or  { error: string }  (400)
 *
 * GET  ?chainId=&nft=&tokenId=
 *   Lists open (unfilled) orders for the given token.
 *   Returns: { orders: SerializedSignedOrder[] }  (no-store)
 *
 * GET  ?chainId=            (nft + tokenId absent)
 *   Lists ALL open orders for the chain (the full orderbook).
 *   Returns: { orders: SerializedSignedOrder[] }  (no-store)
 */
import { NextResponse } from "next/server";
import { verifyTypedData, isAddress } from "viem";
import {
  ORDER_TYPES,
  buildOrderDomain,
  deserializeOrder,
  serializeOrder,
  type SerializedSignedOrder,
} from "@/lib/web3/orders";
import { putOrder, listOpenOrders, listAllOpenOrders } from "@/lib/web3/orderbook";
import { getContracts } from "@/lib/web3/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADDR = /^0x[0-9a-fA-F]{40}$/;
const BYTES32_OR_HEX = /^0x[0-9a-fA-F]+$/;

/** Minimal shape validation for a SerializedSignedOrder from the request body. */
function validateShape(body: unknown): body is SerializedSignedOrder {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  if (typeof b.chainId !== "number") return false;
  if (typeof b.signature !== "string" || !BYTES32_OR_HEX.test(b.signature)) return false;
  if (typeof b.orderHash !== "string" || !BYTES32_OR_HEX.test(b.orderHash)) return false;
  if (typeof b.createdAt !== "number") return false;
  const o = b.order as Record<string, unknown> | undefined;
  if (!o || typeof o !== "object") return false;
  if (!ADDR.test(o.seller as string)) return false;
  if (!ADDR.test(o.nft as string)) return false;
  if (!ADDR.test(o.paymentToken as string)) return false;
  if (typeof o.tokenId !== "string") return false;
  if (typeof o.price !== "string") return false;
  if (typeof o.startTime !== "string") return false;
  if (typeof o.endTime !== "string") return false;
  if (typeof o.counter !== "string") return false;
  if (typeof o.salt !== "string") return false;
  return true;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  if (!validateShape(body)) {
    return NextResponse.json({ error: "invalid or incomplete order shape" }, { status: 400 });
  }

  const serialized = body as SerializedSignedOrder;
  const { chainId } = serialized;

  const contracts = getContracts(chainId);
  if (!contracts.settlement) {
    return NextResponse.json(
      { error: `no settlement contract configured for chainId ${chainId}` },
      { status: 400 },
    );
  }

  // Deserialize so we have typed bigints for viem.
  let signed;
  try {
    signed = deserializeOrder(serialized);
  } catch {
    return NextResponse.json({ error: "could not parse order bigint fields" }, { status: 400 });
  }

  const domain = buildOrderDomain(chainId, contracts.settlement);

  // Recover signer and verify it matches order.seller.
  let valid: boolean;
  try {
    valid = await verifyTypedData({
      address: signed.order.seller,
      domain,
      types: ORDER_TYPES,
      primaryType: "Order",
      message: signed.order,
      signature: signed.signature,
    });
  } catch {
    return NextResponse.json({ error: "signature verification failed" }, { status: 400 });
  }

  if (!valid) {
    return NextResponse.json(
      { error: "signature does not match order.seller" },
      { status: 400 },
    );
  }

  await putOrder(signed);

  return NextResponse.json({ ok: true, orderHash: signed.orderHash });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const chainId = Number(url.searchParams.get("chainId"));
  const nft = url.searchParams.get("nft") ?? "";
  const tokenIdParam = url.searchParams.get("tokenId") ?? "";

  if (!Number.isInteger(chainId) || chainId <= 0) {
    return NextResponse.json({ error: "missing or invalid chainId" }, { status: 400 });
  }

  // Whole-chain orderbook mode: when nft AND tokenId are both absent, return
  // every open order for the chain. (Backwards-compatible: the per-token path
  // below is unchanged when nft+tokenId are supplied.)
  if (!nft && !tokenIdParam) {
    const orders = await listAllOpenOrders(chainId);
    return NextResponse.json(
      { orders: orders.map(serializeOrder) },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  if (!isAddress(nft)) {
    return NextResponse.json({ error: "missing or invalid nft address" }, { status: 400 });
  }
  if (!tokenIdParam || !/^\d+$/.test(tokenIdParam)) {
    return NextResponse.json({ error: "missing or invalid tokenId" }, { status: 400 });
  }

  const tokenId = BigInt(tokenIdParam);
  const orders = await listOpenOrders(chainId, nft, tokenId);
  const serialized = orders.map(serializeOrder);

  return NextResponse.json(
    { orders: serialized },
    { headers: { "Cache-Control": "no-store" } },
  );
}
