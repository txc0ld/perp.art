/**
 * Pure unit tests for orders.ts:
 *   - ORDER_TYPES field order (load-bearing for EIP-712 digest)
 *   - serializeOrder / deserializeOrder round-trip
 *   - orderStorageKey format
 *   - buildOrderDomain shape
 */
import { describe, it, expect } from "vitest";
import {
  ORDER_TYPES,
  serializeOrder,
  deserializeOrder,
  orderStorageKey,
  buildOrderDomain,
  type SignedOrder,
} from "./orders";

// Fixture signed order with all bigint fields.
const FIXTURE: SignedOrder = {
  order: {
    seller: "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B",
    nft: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
    tokenId: BigInt(42),
    paymentToken: "0x0000000000000000000000000000000000000000",
    price: BigInt(1000000000000000),
    startTime: BigInt(0),
    endTime: BigInt(4102444800),
    counter: BigInt(0),
    salt: BigInt(1),
  },
  signature: "0xdeadbeef00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001b",
  chainId: 84532,
  orderHash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab",
  createdAt: 1717200000,
};

describe("ORDER_TYPES", () => {
  it("has exactly 9 fields in the Order type", () => {
    expect(ORDER_TYPES.Order).toHaveLength(9);
  });

  it("fields are in the exact contract-specified order", () => {
    const names = ORDER_TYPES.Order.map((f) => f.name);
    expect(names).toEqual([
      "seller",
      "nft",
      "tokenId",
      "paymentToken",
      "price",
      "startTime",
      "endTime",
      "counter",
      "salt",
    ]);
  });

  it("all address fields have type address", () => {
    const addressFields = ORDER_TYPES.Order.filter((f) =>
      ["seller", "nft", "paymentToken"].includes(f.name)
    );
    for (const field of addressFields) {
      expect(field.type).toBe("address");
    }
  });

  it("all remaining fields have type uint256", () => {
    const uint256Fields = ORDER_TYPES.Order.filter((f) =>
      ["tokenId", "price", "startTime", "endTime", "counter", "salt"].includes(f.name)
    );
    for (const field of uint256Fields) {
      expect(field.type).toBe("uint256");
    }
  });
});

describe("serializeOrder / deserializeOrder round-trip", () => {
  it("produces identical bigint values after round-trip", () => {
    const serialized = serializeOrder(FIXTURE);
    const roundTripped = deserializeOrder(serialized);

    expect(roundTripped.order.seller).toBe(FIXTURE.order.seller);
    expect(roundTripped.order.nft).toBe(FIXTURE.order.nft);
    expect(roundTripped.order.tokenId).toBe(FIXTURE.order.tokenId);
    expect(roundTripped.order.paymentToken).toBe(FIXTURE.order.paymentToken);
    expect(roundTripped.order.price).toBe(FIXTURE.order.price);
    expect(roundTripped.order.startTime).toBe(FIXTURE.order.startTime);
    expect(roundTripped.order.endTime).toBe(FIXTURE.order.endTime);
    expect(roundTripped.order.counter).toBe(FIXTURE.order.counter);
    expect(roundTripped.order.salt).toBe(FIXTURE.order.salt);
    expect(roundTripped.signature).toBe(FIXTURE.signature);
    expect(roundTripped.chainId).toBe(FIXTURE.chainId);
    expect(roundTripped.orderHash).toBe(FIXTURE.orderHash);
    expect(roundTripped.createdAt).toBe(FIXTURE.createdAt);
  });

  it("serialized bigints are strings (JSON-safe)", () => {
    const s = serializeOrder(FIXTURE);
    expect(typeof s.order.tokenId).toBe("string");
    expect(typeof s.order.price).toBe("string");
    expect(typeof s.order.startTime).toBe("string");
    expect(typeof s.order.endTime).toBe("string");
    expect(typeof s.order.counter).toBe("string");
    expect(typeof s.order.salt).toBe("string");
  });

  it("serialized form is valid JSON", () => {
    const s = serializeOrder(FIXTURE);
    expect(() => JSON.parse(JSON.stringify(s))).not.toThrow();
  });

  it("roundtrips zero bigints correctly", () => {
    const zeroed: SignedOrder = {
      ...FIXTURE,
      order: { ...FIXTURE.order, startTime: BigInt(0), counter: BigInt(0), salt: BigInt(0) },
    };
    const rt = deserializeOrder(serializeOrder(zeroed));
    expect(rt.order.startTime).toBe(BigInt(0));
    expect(rt.order.counter).toBe(BigInt(0));
    expect(rt.order.salt).toBe(BigInt(0));
  });
});

describe("orderStorageKey", () => {
  it("produces the expected path format", () => {
    const key = orderStorageKey(84532, "0xabcdef");
    expect(key).toBe("orders/84532/0xabcdef.json");
  });

  it("includes chainId and orderHash in the path", () => {
    const hash = "0x1234567890abcdef";
    const key = orderStorageKey(1, hash);
    expect(key).toContain("1");
    expect(key).toContain(hash);
    expect(key).toMatch(/^orders\/\d+\/.*\.json$/);
  });
});

describe("buildOrderDomain", () => {
  it("returns correct EIP-712 domain shape", () => {
    const settlement = "0xD2d3B1A12CB01f44AaFcD1eb17d86c3C31fE56b9" as const;
    const domain = buildOrderDomain(84532, settlement);
    expect(domain.name).toBe("PerpetualSettlement");
    expect(domain.version).toBe("1");
    expect(domain.chainId).toBe(84532);
    expect(domain.verifyingContract).toBe(settlement);
  });
});
