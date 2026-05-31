# Log Ledger — Plan 2a: Shared Verification Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the pure, isomorphic `src/lib/logledger/` module (chunking, Merkle, codec, reconstruct) that the relayer (Plan 2b), the resolver (Plan 3), and the frontend verifier (Plan 4) all import — so the verification logic is byte-identical everywhere.

**Architecture:** Four small single-responsibility modules behind a barrel `index.ts`. `merkle` + `chunk` are pure functions over `Uint8Array`. `codec` wraps raw/gzip(fflate)/RLE compress+decompress. `reconstruct` is dependency-injected (takes a `readFile` + `getChunks` callback) so it is fully unit-testable with fakes and has zero hard chain dependency. Hashing uses viem's `keccak256` (isomorphic), matching the on-chain `keccak256` exactly.

**Tech Stack:** TypeScript, viem (already a dep), fflate (new), vitest (new, dev).

**Scope boundary:** Pure library + unit tests only. No React, no API routes, no chain calls, no contract/ABI changes. The codec *selection* heuristic (which codec per MIME) and any chain wiring live in Plan 2b. Brotli (codec 2) is reserved but intentionally unimplemented (we only ever emit raw/gzip/RLE), so `decompress` throws a clear error if it ever sees codec 2.

---

## Merkle definition (MUST be identical in every consumer)

- Leaf = `keccak256(chunkBytes)` (the raw chunk bytes, post-compression).
- Pair = `keccak256(leftHash ++ rightHash)` — 64-byte concat, left then right.
- Odd node at any level is **promoted unchanged** (NOT duplicated).
- Single leaf: root = that leaf hash. Zero leaves: root = `keccak256("")` (the empty-input hash) — documented; in practice `chunks >= 1` always.

---

## File Structure

- `package.json` — add `fflate` (dep), `vitest` (devDep), `"test": "vitest run"` + `"test:watch": "vitest"` scripts.
- `vitest.config.ts` — minimal Node-environment config.
- `src/lib/logledger/chunk.ts` — `CHUNK_SIZE`, `chunkBytes`, `concatChunks`.
- `src/lib/logledger/merkle.ts` — `leafHash`, `merkleRoot`.
- `src/lib/logledger/codec.ts` — `Codec`, `compress`, `decompress`.
- `src/lib/logledger/reconstruct.ts` — `reconstructFile` (dependency-injected).
- `src/lib/logledger/index.ts` — barrel re-exports.
- `src/lib/logledger/*.test.ts` — one test file per module.

---

## Task 1: Add vitest + fflate and prove the runner works

**Files:** `package.json`, `vitest.config.ts`, `src/lib/logledger/smoke.test.ts` (temporary)

- [ ] **Step 1: Install deps**

Run (repo root):
```bash
npm install fflate && npm install -D vitest
```
Expected: both appear in `package.json`.

- [ ] **Step 2: Add test scripts to package.json**

In the `"scripts"` block add (keep existing scripts):
```json
    "test": "vitest run",
    "test:watch": "vitest"
```

- [ ] **Step 3: Add `vitest.config.ts` at repo root**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

- [ ] **Step 4: Add a temporary smoke test**

Create `src/lib/logledger/smoke.test.ts`:
```ts
import { describe, it, expect } from "vitest";

describe("smoke", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Run it**

Run: `npm test`
Expected: vitest runs, 1 passed.

- [ ] **Step 6: Delete the smoke test and commit setup**

```bash
rm src/lib/logledger/smoke.test.ts
git add package.json package-lock.json vitest.config.ts
git commit -m "build: add vitest + fflate for the logledger module"
```

---

## Task 2: `chunk.ts` (TDD)

**Files:** Test `src/lib/logledger/chunk.test.ts`, then `src/lib/logledger/chunk.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/logledger/chunk.test.ts`:
```ts
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
```

- [ ] **Step 2: Run, confirm RED**

Run: `npm test -- chunk`
Expected: FAIL — `./chunk` not found.

- [ ] **Step 3: Implement `chunk.ts`**

```ts
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
```

- [ ] **Step 4: Run, confirm GREEN**

Run: `npm test -- chunk`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/logledger/chunk.ts src/lib/logledger/chunk.test.ts
git commit -m "feat(logledger): byte chunking helpers"
```

---

## Task 3: `merkle.ts` (TDD)

**Files:** Test `src/lib/logledger/merkle.test.ts`, then `src/lib/logledger/merkle.ts`

- [ ] **Step 1: Write the failing test**

The expected roots are derived independently in the test using viem primitives (concat + keccak256), so this is a genuine cross-check of the tree logic, not a tautology.

Create `src/lib/logledger/merkle.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { keccak256, concat, type Hex } from "viem";
import { leafHash, merkleRoot } from "./merkle";

const b = (s: string) => new TextEncoder().encode(s);
const pair = (l: Hex, r: Hex): Hex => keccak256(concat([l, r]));

describe("leafHash", () => {
  it("is keccak256 of the chunk bytes", () => {
    expect(leafHash(b("hello"))).toBe(keccak256(b("hello")));
  });
});

describe("merkleRoot", () => {
  it("single leaf: root == that leaf's hash", () => {
    const c0 = b("only");
    expect(merkleRoot([c0])).toBe(leafHash(c0));
  });

  it("two leaves: root == pair(h0, h1)", () => {
    const c = [b("a"), b("b")];
    const [h0, h1] = c.map(leafHash);
    expect(merkleRoot(c)).toBe(pair(h0, h1));
  });

  it("three leaves: odd node promoted unchanged", () => {
    const c = [b("a"), b("b"), b("c")];
    const [h0, h1, h2] = c.map(leafHash);
    // level1: [pair(h0,h1), h2(promoted)] -> root = pair(pair(h0,h1), h2)
    expect(merkleRoot(c)).toBe(pair(pair(h0, h1), h2));
  });

  it("four leaves: balanced", () => {
    const c = [b("a"), b("b"), b("c"), b("d")];
    const [h0, h1, h2, h3] = c.map(leafHash);
    expect(merkleRoot(c)).toBe(pair(pair(h0, h1), pair(h2, h3)));
  });

  it("five leaves: promotion at multiple levels", () => {
    const c = [b("a"), b("b"), b("c"), b("d"), b("e")];
    const [h0, h1, h2, h3, h4] = c.map(leafHash);
    // L1: [p(h0,h1), p(h2,h3), h4]
    // L2: [p(p01,p23), h4]
    // root: p(p(p01,p23), h4)
    const p01 = pair(h0, h1);
    const p23 = pair(h2, h3);
    expect(merkleRoot(c)).toBe(pair(pair(p01, p23), h4));
  });

  it("is order-sensitive", () => {
    const r1 = merkleRoot([b("a"), b("b")]);
    const r2 = merkleRoot([b("b"), b("a")]);
    expect(r1).not.toBe(r2);
  });

  it("throws on empty input", () => {
    expect(() => merkleRoot([])).toThrow();
  });
});
```

- [ ] **Step 2: Run, confirm RED**

Run: `npm test -- merkle`
Expected: FAIL — `./merkle` not found.

- [ ] **Step 3: Implement `merkle.ts`**

```ts
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
```

- [ ] **Step 4: Run, confirm GREEN**

Run: `npm test -- merkle`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/logledger/merkle.ts src/lib/logledger/merkle.test.ts
git commit -m "feat(logledger): merkle root (odd-promotion) over chunks"
```

---

## Task 4: `codec.ts` (TDD)

**Files:** Test `src/lib/logledger/codec.test.ts`, then `src/lib/logledger/codec.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/logledger/codec.test.ts`:
```ts
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
```

- [ ] **Step 2: Run, confirm RED**

Run: `npm test -- codec`
Expected: FAIL — `./codec` not found.

- [ ] **Step 3: Implement `codec.ts`**

RLE scheme: a sequence of `[count, byte]` pairs where `count` is 1..255; runs longer than 255 are split into multiple pairs. Works for any byte values; only chosen for low-entropy data.

```ts
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
```

- [ ] **Step 4: Run, confirm GREEN**

Run: `npm test -- codec`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/logledger/codec.ts src/lib/logledger/codec.test.ts
git commit -m "feat(logledger): raw/gzip/RLE codec (brotli reserved)"
```

---

## Task 5: `reconstruct.ts` (TDD, dependency-injected)

**Files:** Test `src/lib/logledger/reconstruct.test.ts`, then `src/lib/logledger/reconstruct.ts`

`reconstructFile` takes injected callbacks so it has no hard chain dependency: `readFile()` returns the on-chain `File` commitment, `getChunks()` returns the decoded `{ index, data }[]` from logs (the real chain wiring is provided by Plan 3's resolver). It verifies ordering/completeness, the Merkle root, and the size, then decompresses.

- [ ] **Step 1: Write the failing test**

Create `src/lib/logledger/reconstruct.test.ts`:
```ts
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
        readFile: async () => ({ ...commitment, size: commitment.size + 1n }),
        getChunks: async () => rawChunks,
      }),
    ).rejects.toThrow(/size/i);
  });
});
```

- [ ] **Step 2: Run, confirm RED**

Run: `npm test -- reconstruct`
Expected: FAIL — `./reconstruct` not found.

- [ ] **Step 3: Implement `reconstruct.ts`**

```ts
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
```

- [ ] **Step 4: Run, confirm GREEN**

Run: `npm test -- reconstruct`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/logledger/reconstruct.ts src/lib/logledger/reconstruct.test.ts
git commit -m "feat(logledger): dependency-injected reconstruct + verify"
```

---

## Task 6: Barrel export + full module test gate

**Files:** `src/lib/logledger/index.ts`

- [ ] **Step 1: Create the barrel**

```ts
export { CHUNK_SIZE, chunkBytes, concatChunks } from "./chunk";
export { leafHash, merkleRoot } from "./merkle";
export { Codec, compress, decompress, type CodecValue } from "./codec";
export {
  reconstructFile,
  type FileCommitment,
  type RawChunk,
  type ReconstructDeps,
} from "./reconstruct";
```

- [ ] **Step 2: Typecheck + full test run**

Run: `npx tsc --noEmit` then `npm test`
Expected: tsc reports no new errors in `src/lib/logledger/`; all logledger tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/lib/logledger/index.ts
git commit -m "feat(logledger): barrel exports for the shared module"
```

---

## Self-Review (completed during authoring)

- **Spec coverage:** design spec §5 (shared module: chunk/merkle/codec/reconstruct, byte-identical, brotli reserved) → Tasks 2-6. §11 pitfall #1 (single shared module, identical leaf/pair/odd handling) → `merkle.ts` + barrel reused everywhere. Chain wiring for reconstruct is deferred to Plan 3 via dependency injection — explicitly out of scope here.
- **Placeholder scan:** no TBD/TODO; every step has full code; test vectors derive expected roots from viem primitives (no uncomputable magic constants).
- **Type consistency:** `CodecValue` defined in `codec.ts`, imported by `reconstruct.ts` and re-exported by the barrel. `FileCommitment`/`RawChunk`/`ReconstructDeps` defined in `reconstruct.ts`, used in its test, re-exported. `merkleRoot(Uint8Array[]) → Hex`, `leafHash(Uint8Array) → Hex`, `chunkBytes(Uint8Array) → Uint8Array[]`, `compress/decompress(Uint8Array, CodecValue) → Uint8Array` — signatures consistent across tasks.
- **Determinism note:** verified the Merkle root is computed over the emitted compressed bytes and reconstruction recomputes over the same retrieved bytes, so cross-machine compression determinism is NOT required (only compress/decompress inverse, which the tests assert).
