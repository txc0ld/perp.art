import { keccak256, concat, type Hex } from "viem";

/** Leaf hash for a chunk: keccak256 of the raw (post-compression) chunk bytes. */
export function leafHash(chunk: Uint8Array): Hex {
  return keccak256(chunk);
}

/**
 * Merkle root over ordered chunks. Leaf = keccak256(chunk); parent =
 * keccak256(left ++ right); an odd node at any level is promoted unchanged
 * (NOT duplicated). Single leaf → its own hash. MUST match every consumer.
 */
export function merkleRoot(chunks: Uint8Array[]): Hex {
  if (chunks.length === 0) throw new Error("merkleRoot: no chunks");
  let level: Hex[] = chunks.map(leafHash);
  while (level.length > 1) {
    const next: Hex[] = [];
    for (let i = 0; i < level.length; i += 2) {
      if (i + 1 < level.length) {
        next.push(keccak256(concat([level[i], level[i + 1]])));
      } else {
        next.push(level[i]); // odd node promoted unchanged
      }
    }
    level = next;
  }
  return level[0];
}
