import { describe, it, expect } from "vitest";
import { validateDropEntries, MAX_IMAGE_BYTES, type ZipEntry } from "./validate";
import { MAX_DROP_SIZE } from "./provenance";

const enc = new TextEncoder();

function img(): Uint8Array {
  return new Uint8Array([0x89, 0x50, 0x4e, 0x47]); // PNG magic-ish
}
function meta(name: string, attrs: { trait_type: string; value: string }[] = []): Uint8Array {
  return enc.encode(JSON.stringify({ name, description: "", image: "", attributes: attrs }));
}

function buildEntries(n: number): ZipEntry[] {
  const out: ZipEntry[] = [];
  for (let i = 1; i <= n; i++) {
    out.push({ path: `images/${i}.png`, bytes: img() });
    out.push({ path: `metadata/${i}.json`, bytes: meta(`#${i}`, [{ trait_type: "Background", value: i % 2 ? "Blue" : "Red" }]) });
  }
  return out;
}

describe("validateDropEntries", () => {
  it("validates a well-formed drop and assigns token ids 1..N in index order", () => {
    const v = validateDropEntries(buildEntries(3));
    expect(v.ok).toBe(true);
    expect(v.count).toBe(3);
    expect(v.tokens.map((t) => t.tokenId)).toEqual([1, 2, 3]);
    expect(v.tokens.map((t) => t.index)).toEqual([1, 2, 3]);
    expect(v.errors).toHaveLength(0);
  });

  it("orders tokens by ascending numeric index regardless of zip order", () => {
    const entries: ZipEntry[] = [
      { path: "metadata/10.json", bytes: meta("#10") },
      { path: "images/10.png", bytes: img() },
      { path: "metadata/2.json", bytes: meta("#2") },
      { path: "images/2.png", bytes: img() },
    ];
    const v = validateDropEntries(entries);
    expect(v.ok).toBe(true);
    expect(v.tokens.map((t) => t.index)).toEqual([2, 10]);
    expect(v.tokens.map((t) => t.tokenId)).toEqual([1, 2]);
  });

  it("fails when a metadata entry has no matching image", () => {
    const entries: ZipEntry[] = [
      { path: "metadata/1.json", bytes: meta("#1") },
      { path: "images/1.png", bytes: img() },
      { path: "metadata/2.json", bytes: meta("#2") },
      // no images/2.png
    ];
    const v = validateDropEntries(entries);
    expect(v.ok).toBe(false);
    expect(v.errors.some((e) => /no matching image/.test(e))).toBe(true);
  });

  it("fails on invalid metadata JSON", () => {
    const entries: ZipEntry[] = [
      { path: "metadata/1.json", bytes: enc.encode("{not json") },
      { path: "images/1.png", bytes: img() },
    ];
    const v = validateDropEntries(entries);
    expect(v.ok).toBe(false);
    expect(v.errors.some((e) => /invalid JSON/.test(e))).toBe(true);
  });

  it("fails when over MAX_DROP_SIZE", () => {
    // Build just over the cap with cheap entries (metadata only counts for the cap check).
    const entries: ZipEntry[] = [];
    for (let i = 1; i <= 7001; i++) {
      entries.push({ path: `metadata/${i}.json`, bytes: meta(`#${i}`) });
      entries.push({ path: `images/${i}.png`, bytes: img() });
    }
    const v = validateDropEntries(entries);
    expect(v.ok).toBe(false);
    expect(v.errors.some((e) => /exceeds the maximum size/.test(e))).toBe(true);
  });

  it("ignores __MACOSX and dotfiles", () => {
    const entries: ZipEntry[] = [
      ...buildEntries(1),
      { path: "__MACOSX/images/1.png", bytes: img() },
      { path: ".DS_Store", bytes: img() },
    ];
    const v = validateDropEntries(entries);
    expect(v.ok).toBe(true);
    expect(v.count).toBe(1);
  });

  it("builds a trait summary across the drop", () => {
    const v = validateDropEntries(buildEntries(4));
    const bg = v.traitSummary.find((t) => t.trait_type === "Background");
    expect(bg).toBeDefined();
    // 4 tokens: ids 1&3 → Blue, 2&4 → Red.
    expect(bg!.values.Blue).toBe(2);
    expect(bg!.values.Red).toBe(2);
  });

  it("warns on orphan images without failing", () => {
    const entries: ZipEntry[] = [
      ...buildEntries(1),
      { path: "images/99.png", bytes: img() },
    ];
    const v = validateDropEntries(entries);
    expect(v.ok).toBe(true);
    expect(v.warnings.some((w) => /image #99 has no matching metadata/.test(w))).toBe(true);
  });

  it("returns an error for an empty archive", () => {
    const v = validateDropEntries([]);
    expect(v.ok).toBe(false);
    expect(v.count).toBe(0);
  });

  it("token ids are strictly 1-based and contiguous (matches PerpetualDrop mint)", () => {
    // The contract mints ids 1..N; ownerOf(0)/tokenURI(0) revert. The validator
    // must never emit a token id 0 and must start at 1 regardless of file index.
    const entries: ZipEntry[] = [
      { path: "metadata/0.json", bytes: meta("#0") }, // a 0-indexed file present
      { path: "images/0.png", bytes: img() },
      { path: "metadata/1.json", bytes: meta("#1") },
      { path: "images/1.png", bytes: img() },
    ];
    const v = validateDropEntries(entries);
    expect(v.ok).toBe(true);
    expect(v.count).toBe(2);
    // Even though one source file is index 0, assigned token ids start at 1.
    expect(v.tokens.map((t) => t.tokenId)).toEqual([1, 2]);
    expect(v.tokens.some((t) => t.tokenId === 0)).toBe(false);
  });

  it("rejects path-traversal / absolute entry names (malicious zip)", () => {
    const entries: ZipEntry[] = [
      ...buildEntries(1),
      { path: "../../etc/2.json", bytes: meta("#evil") },
      { path: "/abs/3.json", bytes: meta("#abs") },
    ];
    const v = validateDropEntries(entries);
    expect(v.ok).toBe(false);
    expect(v.errors.some((e) => /unsafe path/.test(e))).toBe(true);
  });

  it("skips an oversized image (per-file cap) with a warning, failing its token", () => {
    const big = new Uint8Array(MAX_IMAGE_BYTES + 1);
    const entries: ZipEntry[] = [
      { path: "metadata/1.json", bytes: meta("#1") },
      { path: "images/1.png", bytes: big },
    ];
    const v = validateDropEntries(entries);
    // The oversized image is dropped → metadata #1 has no matching image → error.
    expect(v.ok).toBe(false);
    expect(v.warnings.some((w) => /exceeded/.test(w))).toBe(true);
  });

  it("rejects an archive with too many raw entries before mapping", () => {
    const entries: ZipEntry[] = [];
    for (let i = 0; i < MAX_DROP_SIZE * 4 + 1; i++) {
      entries.push({ path: `junk/${i}.txt`, bytes: new Uint8Array(0) });
    }
    const v = validateDropEntries(entries);
    expect(v.ok).toBe(false);
    expect(v.errors.some((e) => /too many entries/.test(e))).toBe(true);
  });
});
