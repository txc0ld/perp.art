import type { Hex } from "viem";
import { concatChunks } from "./chunk";
import { merkleRoot } from "./merkle";
import { decompress, type CodecValue } from "./codec";

/** The on-chain commitment for a file (subset of LogLedger.File we verify against). */
export interface FileCommitment {
  root: Hex;
  size: bigint;
  chunks: number;
  codec: CodecValue;
  finalized: boolean;
}

/** A decoded FileChunk log: its index and raw (compressed) bytes. */
export interface RawChunk {
  index: number;
  data: Uint8Array;
}

export interface ReconstructDeps {
  readFile: () => Promise<FileCommitment>;
  getChunks: () => Promise<RawChunk[]>;
}

/**
 * Reassemble a LogLedger file from its chunk logs and verify it against the
 * on-chain commitment BEFORE trusting any bytes: order + completeness, Merkle
 * root, then size. Returns the decompressed original bytes.
 */
export async function reconstructFile(deps: ReconstructDeps): Promise<Uint8Array> {
  const file = await deps.readFile();
  if (!file.finalized) throw new Error("reconstruct: file not sealed");

  const raw = await deps.getChunks();
  const sorted = [...raw].sort((a, b) => a.index - b.index);

  // Completeness: exactly chunks 0..file.chunks-1, no gaps, no dupes.
  if (sorted.length !== file.chunks) {
    throw new Error(`reconstruct: chunk count mismatch (got ${sorted.length}, expected ${file.chunks})`);
  }
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].index !== i) throw new Error(`reconstruct: missing/duplicate chunk at index ${i}`);
  }

  const ordered = sorted.map((c) => c.data);

  // Verify the Merkle root BEFORE trusting the bytes.
  if (merkleRoot(ordered) !== file.root) throw new Error("reconstruct: root mismatch");

  const compressed = concatChunks(ordered);
  if (BigInt(compressed.length) !== file.size) {
    throw new Error(`reconstruct: size mismatch (got ${compressed.length}, expected ${file.size})`);
  }

  return decompress(compressed, file.codec);
}
