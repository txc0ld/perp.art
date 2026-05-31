import { gzipSync, gunzipSync } from "fflate";

/** Compression codec recorded on-chain at seal time (LogLedger.File.codec). */
export const Codec = {
  Raw: 0,
  Gzip: 1,
  Brotli: 2, // reserved; never emitted by this app — decompress throws.
  RLE: 3,
} as const;
export type CodecValue = (typeof Codec)[keyof typeof Codec];

export function compress(data: Uint8Array, codec: CodecValue): Uint8Array {
  switch (codec) {
    case Codec.Raw:
      return data.slice();
    case Codec.Gzip:
      return gzipSync(data);
    case Codec.RLE:
      return rleEncode(data);
    case Codec.Brotli:
      throw new Error("codec: Brotli (2) is not implemented");
    default:
      throw new Error(`codec: unknown codec ${codec}`);
  }
}

export function decompress(data: Uint8Array, codec: CodecValue): Uint8Array {
  switch (codec) {
    case Codec.Raw:
      return data.slice();
    case Codec.Gzip:
      return gunzipSync(data);
    case Codec.RLE:
      return rleDecode(data);
    case Codec.Brotli:
      throw new Error("codec: Brotli (2) is not implemented");
    default:
      throw new Error(`codec: unknown codec ${codec}`);
  }
}

/** [count(1..255), byte] run-length pairs. */
function rleEncode(data: Uint8Array): Uint8Array {
  const out: number[] = [];
  let i = 0;
  while (i < data.length) {
    const byte = data[i];
    let run = 1;
    while (i + run < data.length && data[i + run] === byte && run < 255) run++;
    out.push(run, byte);
    i += run;
  }
  return new Uint8Array(out);
}

function rleDecode(data: Uint8Array): Uint8Array {
  if (data.length % 2 !== 0) throw new Error("rle: corrupt stream (odd length)");
  const out: number[] = [];
  for (let i = 0; i < data.length; i += 2) {
    const run = data[i];
    const byte = data[i + 1];
    for (let k = 0; k < run; k++) out.push(byte);
  }
  return new Uint8Array(out);
}
