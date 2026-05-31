import { describe, it, expect } from "vitest";
import { Codec, compress, decompress } from "./codec";

function seq(n: number): Uint8Array {
  const a = new Uint8Array(n);
  for (let i = 0; i < n; i++) a[i] = (i * 7) % 256;
  return a;
}
const repetitive = new Uint8Array(5000).fill(0x41); // 5000 'A' bytes

describe("codec round-trips", () => {
  for (const codec of [Codec.Raw, Codec.Gzip, Codec.RLE] as const) {
    it(`raw/gzip/rle inverse for varied data (codec ${codec})`, () => {
      const data = seq(3333);
      expect(decompress(compress(data, codec), codec)).toEqual(data);
    });
    it(`inverse for empty (codec ${codec})`, () => {
      const data = new Uint8Array(0);
      expect(decompress(compress(data, codec), codec)).toEqual(data);
    });
    it(`inverse for single byte (codec ${codec})`, () => {
      const data = new Uint8Array([0xff]);
      expect(decompress(compress(data, codec), codec)).toEqual(data);
    });
  }

  it("RLE actually shrinks highly repetitive data", () => {
    const out = compress(repetitive, Codec.RLE);
    expect(out.length).toBeLessThan(repetitive.length);
    expect(decompress(out, Codec.RLE)).toEqual(repetitive);
  });

  it("gzip shrinks repetitive data and round-trips", () => {
    const out = compress(repetitive, Codec.Gzip);
    expect(out.length).toBeLessThan(repetitive.length);
    expect(decompress(out, Codec.Gzip)).toEqual(repetitive);
  });

  it("Raw is a pass-through copy", () => {
    const data = seq(64);
    expect(compress(data, Codec.Raw)).toEqual(data);
  });

  it("decompress throws on the unimplemented Brotli codec", () => {
    expect(() => decompress(new Uint8Array([1, 2, 3]), Codec.Brotli)).toThrow();
  });

  it("RLE handles runs longer than 255", () => {
    const data = new Uint8Array(1000).fill(0x7a);
    expect(decompress(compress(data, Codec.RLE), Codec.RLE)).toEqual(data);
  });
});
