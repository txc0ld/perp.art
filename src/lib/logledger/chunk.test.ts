import { describe, it, expect } from "vitest";
import { CHUNK_SIZE, chunkBytes, concatChunks } from "./chunk";

function seq(n: number): Uint8Array {
  const a = new Uint8Array(n);
  for (let i = 0; i < n; i++) a[i] = i % 256;
  return a;
}

describe("chunkBytes", () => {
  it("CHUNK_SIZE is 12 KiB", () => {
    expect(CHUNK_SIZE).toBe(12 * 1024);
  });

  it("returns a single chunk for input <= CHUNK_SIZE", () => {
    const data = seq(100);
    const chunks = chunkBytes(data);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toEqual(data);
  });

  it("splits into ceil(len/CHUNK_SIZE) chunks, last is the remainder", () => {
    const data = seq(CHUNK_SIZE * 2 + 5);
    const chunks = chunkBytes(data);
    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toHaveLength(CHUNK_SIZE);
    expect(chunks[1]).toHaveLength(CHUNK_SIZE);
    expect(chunks[2]).toHaveLength(5);
  });

  it("exact multiple of CHUNK_SIZE yields no trailing empty chunk", () => {
    const data = seq(CHUNK_SIZE * 2);
    expect(chunkBytes(data)).toHaveLength(2);
  });

  it("empty input yields zero chunks", () => {
    expect(chunkBytes(new Uint8Array(0))).toHaveLength(0);
  });

  it("concatChunks is the inverse of chunkBytes", () => {
    const data = seq(CHUNK_SIZE * 3 + 777);
    expect(concatChunks(chunkBytes(data))).toEqual(data);
  });
});
