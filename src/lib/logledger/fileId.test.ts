import { describe, it, expect } from "vitest";
import { keccak256, encodeAbiParameters, type Hex } from "viem";
import { computeFileId } from "./fileId";

const AUTHOR = "0xfB66D6FDB038FdF335b4068C36d2d9Fef5E4f766" as Hex;
const HASH = keccak256(new TextEncoder().encode("artwork")) as Hex;

describe("computeFileId", () => {
  it("matches keccak256(abi.encode(address, bytes32, uint32))", () => {
    const expected = keccak256(
      encodeAbiParameters(
        [{ type: "address" }, { type: "bytes32" }, { type: "uint32" }],
        [AUTHOR, HASH, 0],
      ),
    );
    expect(computeFileId(AUTHOR, HASH, 0)).toBe(expected);
  });

  it("defaults version to 0", () => {
    expect(computeFileId(AUTHOR, HASH)).toBe(computeFileId(AUTHOR, HASH, 0));
  });

  it("is deterministic", () => {
    expect(computeFileId(AUTHOR, HASH, 1)).toBe(computeFileId(AUTHOR, HASH, 1));
  });

  it("differs by version", () => {
    expect(computeFileId(AUTHOR, HASH, 0)).not.toBe(computeFileId(AUTHOR, HASH, 1));
  });

  it("differs by content hash", () => {
    const other = keccak256(new TextEncoder().encode("other")) as Hex;
    expect(computeFileId(AUTHOR, HASH)).not.toBe(computeFileId(AUTHOR, other));
  });

  it("differs by author (un-squattable: distinct callers => distinct fileIds)", () => {
    const other = "0x000000000000000000000000000000000000dEaD" as Hex;
    expect(computeFileId(AUTHOR, HASH)).not.toBe(computeFileId(other, HASH));
  });
});
