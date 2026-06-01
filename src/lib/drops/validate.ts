import { MAX_DROP_SIZE } from "./provenance";

/**
 * Drop ZIP layout we accept (OpenSea-style):
 *
 *   images/1.png        metadata/1.json        (or 1.json at root, etc.)
 *   images/2.png        metadata/2.json
 *   ...
 *
 * A metadata entry's basename (without extension) is its TOKEN INDEX. Token ids
 * are assigned 1..N in ASCENDING numeric index order. Every metadata entry must
 * have a matching image whose basename (without extension) equals the index, OR
 * whose path matches the `image` field in the metadata JSON. We key on the
 * numeric basename so `images/1.png` ↔ `metadata/1.json`.
 */

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|avif)$/i;
const JSON_EXT = /\.json$/i;

/** Per-image hard cap (uncompressed). Bounds a single malicious/oversized entry. */
export const MAX_IMAGE_BYTES = 32 * 1024 * 1024; // 32 MB
/** Per-metadata-JSON hard cap (uncompressed). JSON is tiny; a huge one is junk. */
export const MAX_METADATA_BYTES = 1 * 1024 * 1024; // 1 MB
/** Total uncompressed-payload cap across all accepted entries — anti zip-bomb. */
export const MAX_TOTAL_UNCOMPRESSED_BYTES = 4 * 1024 * 1024 * 1024; // 4 GB

/**
 * Reject path-traversal / absolute / drive-letter entry names. fflate yields the
 * raw archive path; a crafted ZIP can carry `../`, a leading `/`, or `C:\`. We
 * only ever key on a numeric basename (so traversal entries are already ignored
 * for pairing), but we reject them outright so a malicious archive can never be
 * silently partially-accepted.
 */
function isUnsafePath(path: string): boolean {
  if (path.startsWith("/") || /^[a-zA-Z]:/.test(path)) return true;
  return path.split("/").some((seg) => seg === "..");
}

export interface ZipEntry {
  /** Full path inside the ZIP (forward slashes). */
  path: string;
  bytes: Uint8Array;
}

export interface OpenSeaMetadata {
  name?: string;
  description?: string;
  image?: string;
  attributes?: { trait_type?: string; value?: string | number }[];
}

export interface ValidatedToken {
  /** 1-based token id (assigned by ascending index). */
  tokenId: number;
  /** Numeric index parsed from the file basename. */
  index: number;
  imagePath: string;
  metadataPath: string;
  imageBytes: Uint8Array;
  metadata: OpenSeaMetadata;
}

export interface TraitSummary {
  trait_type: string;
  /** value -> count across the drop. */
  values: Record<string, number>;
}

export interface ValidationResult {
  ok: boolean;
  count: number;
  tokens: ValidatedToken[];
  /** Per-trait_type value distribution, for the UI trait summary. */
  traitSummary: TraitSummary[];
  errors: string[];
  warnings: string[];
}

/** Numeric index from a basename like "images/0007.png" -> 7, else null. */
function indexFromPath(path: string): number | null {
  const base = path.split("/").pop() ?? path;
  const stem = base.replace(/\.[^.]+$/, "");
  if (!/^\d+$/.test(stem)) return null;
  return Number(stem);
}

function isImage(path: string): boolean {
  return IMAGE_EXT.test(path) && !path.endsWith("/");
}
function isJson(path: string): boolean {
  return JSON_EXT.test(path) && !path.endsWith("/");
}

/**
 * Validate an unzipped drop. PURE — no I/O, no network. Caps entry count at
 * MAX_DROP_SIZE, requires every metadata entry to have a matching image, and
 * schema-checks each metadata JSON. Surfaces partial failures honestly in
 * `errors` (ok=false) without throwing.
 */
export function validateDropEntries(entries: ZipEntry[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Early guard: a drop is one image + one metadata file per token, so the total
  // entry count can't legitimately exceed ~2× the cap (plus junk). Reject wildly
  // oversized archives before we build any per-entry maps.
  const ENTRY_HARD_CAP = MAX_DROP_SIZE * 4;
  if (entries.length > ENTRY_HARD_CAP) {
    errors.push(`Archive has too many entries (${entries.length}); cap is ${ENTRY_HARD_CAP}.`);
    return { ok: false, count: 0, tokens: [], traitSummary: [], errors, warnings };
  }

  // Skip macOS junk + directories.
  const clean = entries.filter(
    (e) =>
      !e.path.startsWith("__MACOSX/") &&
      !e.path.split("/").pop()!.startsWith(".") &&
      !e.path.endsWith("/"),
  );

  const imagesByIndex = new Map<number, ZipEntry>();
  const metaByIndex = new Map<number, ZipEntry>();

  let unsafe = 0;
  let oversizedImages = 0;
  let oversizedMeta = 0;
  let totalBytes = 0;

  for (const e of clean) {
    // Reject path traversal / absolute paths outright (anti malicious-zip).
    if (isUnsafePath(e.path)) {
      unsafe++;
      continue;
    }
    const idx = indexFromPath(e.path);
    if (idx === null) continue; // ignore non-numeric files (README, etc.)
    if (isImage(e.path)) {
      if (e.bytes.byteLength > MAX_IMAGE_BYTES) {
        oversizedImages++;
        continue;
      }
      if (!imagesByIndex.has(idx)) {
        imagesByIndex.set(idx, e);
        totalBytes += e.bytes.byteLength;
      }
    } else if (isJson(e.path)) {
      if (e.bytes.byteLength > MAX_METADATA_BYTES) {
        oversizedMeta++;
        continue;
      }
      if (!metaByIndex.has(idx)) {
        metaByIndex.set(idx, e);
        totalBytes += e.bytes.byteLength;
      }
    }
  }

  if (unsafe > 0) {
    errors.push(`${unsafe} archive ${unsafe === 1 ? "entry" : "entries"} had an unsafe path (traversal/absolute) and were rejected.`);
  }
  if (oversizedImages > 0) {
    warnings.push(`${oversizedImages} image(s) exceeded ${MAX_IMAGE_BYTES / (1024 * 1024)}MB and were skipped.`);
  }
  if (oversizedMeta > 0) {
    warnings.push(`${oversizedMeta} metadata file(s) exceeded ${MAX_METADATA_BYTES / (1024 * 1024)}MB and were skipped.`);
  }
  // Anti zip-bomb: cap the total accepted uncompressed payload.
  if (totalBytes > MAX_TOTAL_UNCOMPRESSED_BYTES) {
    errors.push(
      `Archive uncompressed size (${Math.round(totalBytes / (1024 * 1024))}MB) exceeds the ${Math.round(MAX_TOTAL_UNCOMPRESSED_BYTES / (1024 * 1024 * 1024))}GB cap.`,
    );
    return { ok: false, count: 0, tokens: [], traitSummary: [], errors, warnings };
  }
  if (unsafe > 0) {
    return { ok: false, count: 0, tokens: [], traitSummary: [], errors, warnings };
  }

  const indices = [...metaByIndex.keys()].sort((a, b) => a - b);

  if (indices.length === 0) {
    errors.push("No metadata JSON entries found (expected files like metadata/1.json).");
    return { ok: false, count: 0, tokens: [], traitSummary: [], errors, warnings };
  }
  if (indices.length > MAX_DROP_SIZE) {
    errors.push(`Drop exceeds the maximum size: ${indices.length} entries (cap ${MAX_DROP_SIZE}).`);
    return { ok: false, count: indices.length, tokens: [], traitSummary: [], errors, warnings };
  }

  const decoder = new TextDecoder();
  const tokens: ValidatedToken[] = [];
  const traitMap = new Map<string, Map<string, number>>();
  let tokenId = 0;

  for (const idx of indices) {
    tokenId++;
    const metaEntry = metaByIndex.get(idx)!;
    let meta: OpenSeaMetadata;
    try {
      meta = JSON.parse(decoder.decode(metaEntry.bytes)) as OpenSeaMetadata;
    } catch {
      errors.push(`metadata #${idx}: invalid JSON (${metaEntry.path}).`);
      continue;
    }
    if (meta === null || typeof meta !== "object") {
      errors.push(`metadata #${idx}: not a JSON object.`);
      continue;
    }

    // Resolve the image: prefer the index-matched image; else look up the image
    // field's basename index.
    let imageEntry = imagesByIndex.get(idx);
    if (!imageEntry && typeof meta.image === "string") {
      const imgIdx = indexFromPath(meta.image);
      if (imgIdx !== null) imageEntry = imagesByIndex.get(imgIdx);
    }
    if (!imageEntry) {
      errors.push(`metadata #${idx}: no matching image (expected images/${idx}.<ext>).`);
      continue;
    }

    if (meta.attributes !== undefined && !Array.isArray(meta.attributes)) {
      warnings.push(`metadata #${idx}: "attributes" is not an array — ignored.`);
    } else if (Array.isArray(meta.attributes)) {
      for (const a of meta.attributes) {
        if (!a || a.trait_type === undefined || a.value === undefined) continue;
        const tt = String(a.trait_type);
        const v = String(a.value);
        if (!traitMap.has(tt)) traitMap.set(tt, new Map());
        const vm = traitMap.get(tt)!;
        vm.set(v, (vm.get(v) ?? 0) + 1);
      }
    }

    tokens.push({
      tokenId,
      index: idx,
      imagePath: imageEntry.path,
      metadataPath: metaEntry.path,
      imageBytes: imageEntry.bytes,
      metadata: meta,
    });
  }

  // Orphan images (no metadata) are a warning, not a hard failure.
  for (const idx of imagesByIndex.keys()) {
    if (!metaByIndex.has(idx)) {
      warnings.push(`image #${idx} has no matching metadata — it will not be minted.`);
    }
  }

  const traitSummary: TraitSummary[] = [...traitMap.entries()].map(([trait_type, vm]) => ({
    trait_type,
    values: Object.fromEntries(vm),
  }));

  // ok only when every metadata entry produced a valid token.
  const ok = errors.length === 0 && tokens.length === indices.length && tokens.length > 0;
  return { ok, count: tokens.length, tokens, traitSummary, errors, warnings };
}
