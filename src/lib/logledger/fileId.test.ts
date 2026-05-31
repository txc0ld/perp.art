import { describe, it, expect } from "vitest";
import { keccak256, encodeAbiParameters, type Hex } from "viem";
import { computeFileId } from "./fileId";

const COLLECTION = "0xfB66D6FDB038FdF335b4068C36d2d9Fef5E4f766" as Hex;
const HASH = keccak256(new TextEncoder().encode("artwork")) as Hex;

describe("computeFileId", () => {
  it("matches keccak256(abi.encode(address, bytes32, uint32))", () => {
    const expected = keccak256(
      encodeAbiParameters(
        [{ type: "address" }, { type: "bytes32" }, { type: "uint32" }],
        [COLLECTION, HASH, 0],
      ),
    );
    expect(computeFileId(COLLECTION, HASH, 0)).toBe(expected);
  });

  it("defaults version to 0", () => {
    expect(computeFileId(COLLECTION, HASH)).toBe(computeFileId(COLLECTION, HASH, 0));
  });

  it("is deterministic", () => {
    expect(computeFileId(COLLECTION, HASH, 1)).toBe(computeFileId(COLLECTION, HASH, 1));
  });

  it("differs by version", () => {
    expect(computeFileId(COLLECTION, HASH, 0)).not.toBe(computeFileId(COLLECTION, HASH, 1));
  });

  it("differs by content hash", () => {
    const other = keccak256(new TextEncoder().encode("other")) as Hex;
    expect(computeFileId(COLLECTION, HASH)).not.toBe(computeFileId(COLLECTION, other));
  });

  it("differs by collection", () => {
    const other = "0x000000000000000000000000000000000000dEaD" as Hex;
    expect(computeFileId(COLLECTION, HASH)).not.toBe(computeFileId(other, HASH));
  });
});
