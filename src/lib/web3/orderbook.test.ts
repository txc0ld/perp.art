/**
 * Unit tests for listAllOpenOrders — the whole-chain orderbook scan.
 * Mocks @vercel/blob (list) and global fetch so no network/Blob is touched.
 *
 * ES2017: BigInt() constructor only, no BigInt literals.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SerializedSignedOrder } from "./orders";

const list = vi.fn();
vi.mock("@vercel/blob", () => ({
  list: (args: unknown) => list(args),
  put: vi.fn(),
  del: vi.fn(),
}));

function serialized(tokenId: string, price: string, createdAt: number, hash: string): SerializedSignedOrder {
  return {
    order: {
      seller: "0x00000000000000000000000000000000000000a1",
      nft: "0x00000000000000000000000000000000000000bb",
      tokenId,
      paymentToken: "0x0000000000000000000000000000000000000000",
      price,
      startTime: "0",
      endTime: "0",
      counter: "0",
      salt: "1",
    },
    signature: "0xdead",
    chainId: 84532,
    orderHash: hash as `0x${string}`,
    createdAt,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listAllOpenOrders", () => {
  it("returns every open order, skips .filled tombstones, sorts newest first", async () => {
    list.mockResolvedValue({
      blobs: [
        { pathname: "orders/84532/0xh1.json", url: "https://blob/0xh1" },
        { pathname: "orders/84532/0xh2.json", url: "https://blob/0xh2" },
        { pathname: "orders/84532/0xh3.filled", url: "https://blob/0xh3" }, // tombstone
      ],
    });

    const bodies: Record<string, SerializedSignedOrder> = {
      "https://blob/0xh1": serialized("1", "5", 100, "0xh1"),
      "https://blob/0xh2": serialized("2", "9", 200, "0xh2"),
    };

    vi.stubGlobal(
      "fetch",
      vi.fn(async (u: string) => ({
        ok: true,
        json: async () => bodies[u],
      })),
    );

    const { listAllOpenOrders } = await import("./orderbook");
    const orders = await listAllOpenOrders(84532);

    expect(list).toHaveBeenCalledWith({ prefix: "orders/84532/" });
    expect(orders).toHaveLength(2); // tombstone excluded
    // newest createdAt first
    expect(orders[0].orderHash).toBe("0xh2");
    expect(orders[1].orderHash).toBe("0xh1");
    // bigint round-trip
    expect(orders[0].order.price).toBe(BigInt(9));
    expect(orders[0].order.tokenId).toBe(BigInt(2));

    vi.unstubAllGlobals();
  });

  it("skips unreadable blobs without throwing", async () => {
    list.mockResolvedValue({
      blobs: [{ pathname: "orders/84532/0xh1.json", url: "https://blob/bad" }],
    });
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false })));

    const { listAllOpenOrders } = await import("./orderbook");
    const orders = await listAllOpenOrders(84532);
    expect(orders).toEqual([]);
    vi.unstubAllGlobals();
  });
});
