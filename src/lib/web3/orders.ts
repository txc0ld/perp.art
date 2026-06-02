/**
 * orders.ts — Pure EIP-712 order types, domain builder, and serialisation helpers.
 *
 * NO server-only import here: this file is shared with client components
 * (TradePanel etc.). All blob/server logic lives in orderbook.ts.
 *
 * ES2017 target: BigInt() constructor only — no BigInt literals (1n syntax).
 */

// ---------------------------------------------------------------------------
// EIP-712 types — field order MUST match PerpetualSettlement exactly.
// ---------------------------------------------------------------------------

export const ORDER_TYPES = {
  Order: [
    { name: "seller", type: "address" },
    { name: "nft", type: "address" },
    { name: "tokenId", type: "uint256" },
    { name: "paymentToken", type: "address" },
    { name: "price", type: "uint256" },
    { name: "startTime", type: "uint256" },
    { name: "endTime", type: "uint256" },
    { name: "counter", type: "uint256" },
    { name: "salt", type: "uint256" },
    { name: "minSellerProceeds", type: "uint256" },
  ],
} as const;

// ---------------------------------------------------------------------------
// Core interfaces
// ---------------------------------------------------------------------------

export interface OrderStruct {
  seller: `0x${string}`;
  nft: `0x${string}`;
  tokenId: bigint;
  paymentToken: `0x${string}`;
  price: bigint;
  startTime: bigint;
  endTime: bigint;
  counter: bigint;
  salt: bigint;
  minSellerProceeds: bigint;
}

export interface SignedOrder {
  order: OrderStruct;
  signature: `0x${string}`;
  chainId: number;
  orderHash: `0x${string}`;
  createdAt: number;
}

// ---------------------------------------------------------------------------
// JSON-safe serialisation: bigint ↔ string
// (Vercel Blob and HTTP transports cannot round-trip bigint in JSON natively.)
// ---------------------------------------------------------------------------

/** JSON-safe representation of an OrderStruct (bigints as decimal strings). */
export interface SerializedOrderStruct {
  seller: `0x${string}`;
  nft: `0x${string}`;
  tokenId: string;
  paymentToken: `0x${string}`;
  price: string;
  startTime: string;
  endTime: string;
  counter: string;
  salt: string;
  minSellerProceeds: string;
}

export interface SerializedSignedOrder {
  order: SerializedOrderStruct;
  signature: `0x${string}`;
  chainId: number;
  orderHash: `0x${string}`;
  createdAt: number;
}

export function serializeOrder(signed: SignedOrder): SerializedSignedOrder {
  return {
    order: {
      seller: signed.order.seller,
      nft: signed.order.nft,
      tokenId: signed.order.tokenId.toString(),
      paymentToken: signed.order.paymentToken,
      price: signed.order.price.toString(),
      startTime: signed.order.startTime.toString(),
      endTime: signed.order.endTime.toString(),
      counter: signed.order.counter.toString(),
      salt: signed.order.salt.toString(),
      minSellerProceeds: signed.order.minSellerProceeds.toString(),
    },
    signature: signed.signature,
    chainId: signed.chainId,
    orderHash: signed.orderHash,
    createdAt: signed.createdAt,
  };
}

export function deserializeOrder(raw: SerializedSignedOrder): SignedOrder {
  return {
    order: {
      seller: raw.order.seller,
      nft: raw.order.nft,
      tokenId: BigInt(raw.order.tokenId),
      paymentToken: raw.order.paymentToken,
      price: BigInt(raw.order.price),
      startTime: BigInt(raw.order.startTime),
      endTime: BigInt(raw.order.endTime),
      counter: BigInt(raw.order.counter),
      salt: BigInt(raw.order.salt),
      minSellerProceeds: BigInt(raw.order.minSellerProceeds),
    },
    signature: raw.signature,
    chainId: raw.chainId,
    orderHash: raw.orderHash,
    createdAt: raw.createdAt,
  };
}

// ---------------------------------------------------------------------------
// Domain + storage key helpers
// ---------------------------------------------------------------------------

/** Build the EIP-712 domain for PerpetualSettlement. */
export function buildOrderDomain(
  chainId: number,
  settlement: `0x${string}`,
): {
  name: string;
  version: string;
  chainId: number;
  verifyingContract: `0x${string}`;
} {
  return {
    name: "PerpetualSettlement",
    version: "1",
    chainId,
    verifyingContract: settlement,
  };
}

/** Blob storage key for a signed order (pure, no I/O). */
export function orderStorageKey(chainId: number, orderHash: string): string {
  return `orders/${chainId}/${orderHash}.json`;
}
