/** Fixed chunk size for LogLedger uploads: 12 KiB keeps each upload tx well
 *  under block gas limits. MUST match every consumer of the module. */
export const CHUNK_SIZE = 12 * 1024;

/** Split bytes into <= CHUNK_SIZE pieces, in order. Empty input → []. */
export function chunkBytes(data: Uint8Array): Uint8Array[] {
  const chunks: Uint8Array[] = [];
  for (let off = 0; off < data.length; off += CHUNK_SIZE) {
    chunks.push(data.subarray(off, Math.min(off + CHUNK_SIZE, data.length)));
  }
  return chunks;
}

/** Concatenate ordered chunks back into one buffer (inverse of chunkBytes). */
export function concatChunks(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}
