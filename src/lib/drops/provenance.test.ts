import { describe, it, expect } from "vitest";
import { keccak256, concatHex } from "viem";
import { computeProvenanceHash, hashAsset, MAX_DROP_SIZE } from "./provenance";

describe("hashAsset", () => {
  it("is keccak256 of the bytes", () => {
    const bytes = new TextEncoder().encode("hello");
    expect(hashAsset(bytes)).toBe(keccak256(bytes));
  });

  it("is deterministic for identical bytes", () => {
    const a = new Uint8Array([1, 2, 3, 4]);
    const b = new Uint8Array([1, 2, 3, 4]);
    expect(hashAsset(a)).toBe(hashAsset(b));
  });

  it("differs for different bytes", () => {
    expect(hashAsset(new Uint8Array([1]))).not.toBe(hashAsset(new Uint8Array([2])));
  });
});

describe("computeProvenanceHash", () => {
  it("equals keccak256(concat(orderedHashes))", () => {
    const h1 = hashAsset(new TextEncoder().encode("a"));
    const h2 = hashAsset(new TextEncoder().encode("b"));
    const h3 = hashAsset(new TextEncoder().encode("c"));
    const expected = keccak256(concatHex([h1, h2, h3]));
    expect(computeProvenanceHash([h1, h2, h3])).toBe(expected);
  });

  it("is order-sensitive", () => {
    const h1 = hashAsset(new Uint8Array([1]));
    const h2 = hashAsset(new Uint8Array([2]));
    expect(computeProvenanceHash([h1, h2])).not.toBe(computeProvenanceHash([h2, h1]));
  });

  it("is stable for a fixed ordered set (regression anchor)", () => {
    const hashes = [
      hashAsset(new Uint8Array([0])),
      hashAsset(new Uint8Array([1])),
      hashAsset(new Uint8Array([2])),
    ];
    // Recompute the reference the same way the contract verification would.
    const ref = keccak256(concatHex(hashes));
    expect(computeProvenanceHash(hashes)).toBe(ref);
  });

  it("throws on empty input", () => {
    expect(() => computeProvenanceHash([])).toThrow(/no asset hashes/);
  });

  it("throws on a malformed hash", () => {
    expect(() => computeProvenanceHash(["0x1234"])).toThrow(/not a 32-byte hash/);
  });

  it("MAX_DROP_SIZE is 7000", () => {
    expect(MAX_DROP_SIZE).toBe(7000);
  });
});
