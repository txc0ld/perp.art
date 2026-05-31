import { describe, it, expect } from "vitest";
import { chunkBytes } from "./chunk";
import { merkleRoot } from "./merkle";
import { Codec, compress } from "./codec";
import { reconstructFile, type FileCommitment, type RawChunk } from "./reconstruct";

const original = new TextEncoder().encode("the quick brown fox ".repeat(2000));

function fixture(codec = Codec.Gzip) {
  const compressed = compress(original, codec);
  const chunks = chunkBytes(compressed);
  const commitment: FileCommitment = {
    root: merkleRoot(chunks),
    size: BigInt(compressed.length),
    chunks: chunks.length,
    codec,
    finalized: true,
  };
  const rawChunks: RawChunk[] = chunks.map((data, index) => ({ index, data }));
  return { commitment, rawChunks };
}

describe("reconstructFile", () => {
  it("reassembles, verifies, and decompresses to the original", async () => {
    const { commitment, rawChunks } = fixture();
    const out = await reconstructFile({
      readFile: async () => commitment,
      getChunks: async () => rawChunks,
    });
    expect(out).toEqual(original);
  });

  it("sorts out-of-order chunks before verifying", async () => {
    const { commitment, rawChunks } = fixture();
    const shuffled = [...rawChunks].reverse();
    const out = await reconstructFile({
      readFile: async () => commitment,
      getChunks: async () => shuffled,
    });
    expect(out).toEqual(original);
  });

  it("throws if the file is not finalized", async () => {
    const { commitment, rawChunks } = fixture();
    await expect(
      reconstructFile({
        readFile: async () => ({ ...commitment, finalized: false }),
        getChunks: async () => rawChunks,
      }),
    ).rejects.toThrow(/not sealed|finalized/i);
  });

  it("throws on a missing chunk", async () => {
    const { commitment, rawChunks } = fixture();
    await expect(
      reconstructFile({
        readFile: async () => commitment,
        getChunks: async () => rawChunks.slice(1), // drop chunk 0
      }),
    ).rejects.toThrow(/missing|contiguous|count/i);
  });

  it("throws on a tampered chunk (root mismatch)", async () => {
    const { commitment, rawChunks } = fixture();
    const tampered = rawChunks.map((c, i) =>
      i === 0 ? { index: 0, data: new Uint8Array([...c.data].map((x) => x ^ 0xff)) } : c,
    );
    await expect(
      reconstructFile({
        readFile: async () => commitment,
        getChunks: async () => tampered,
      }),
    ).rejects.toThrow(/root mismatch/i);
  });

  it("throws on a size mismatch", async () => {
    const { commitment, rawChunks } = fixture();
    await expect(
      reconstructFile({
        readFile: async () => ({ ...commitment, size: commitment.size + BigInt(1) }),
        getChunks: async () => rawChunks,
      }),
    ).rejects.toThrow(/size/i);
  });
});
