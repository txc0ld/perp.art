import type { Genre, MediaType, ShardBackend, ShardOption } from "@/lib/types";

/** A single editable trait/attribute pair on the mint form. */
export interface TraitInput {
  key: string;
  value: string;
}

/** The single wizard form-state object, driven from MintWizard. */
export interface MintForm {
  // Step 1 - artwork + metadata
  fileSelected: boolean;
  fileName: string;
  /** The real uploaded artwork. Client-only; sent to /api/store as multipart. */
  file?: File;
  /** Object URL for previewing the uploaded file in-browser. */
  fileUrl?: string;
  /** The uploaded file's MIME type, e.g. "image/png", "video/mp4". */
  fileMime?: string;
  artistName: string;
  title: string;
  mediaType: MediaType;
  genre: Genre;
  description: string;
  traits: TraitInput[];

  // Step 2 - royalty
  royaltyPct: number; // 0..10 (contract caps mint royalty at 10% / 1000 bps)

  // Step 3 - permanence shards (which backends are enabled)
  enabledShards: Record<ShardBackend, boolean>;

  // Step 4 - lock
  lockShards: boolean;

  // Step 5 - collection & edition type (Phase 4)
  /** Target collection contract address; undefined = canonical ForeverLibrary ("Default (open)"). */
  collectionAddress?: `0x${string}`;
  /** Human-readable name for the chosen collection, for display only. */
  collectionName?: string;
  /**
   * "single" = 1-of-1 mint; "edition" = N copies sharing one upload;
   * "drop" = bulk PFP/generative collection (PerpetualDrop, folder-permanence).
   * The "drop" path bypasses the step wizard entirely (see DropFlow).
   */
  mintType: "single" | "edition" | "drop";
  /** Number of edition copies (1..10). Only used when mintType="edition". */
  editionSize: number;
}

export const STEPS = [
  { key: "upload", label: "Artwork" },
  { key: "royalty", label: "Royalty" },
  { key: "permanence", label: "Permanence" },
  { key: "lock", label: "Lock" },
  { key: "collection", label: "Collection" },
  { key: "review", label: "Review" },
] as const;

export type StepKey = (typeof STEPS)[number]["key"];

export function initialForm(shardOptions: ShardOption[], genres: Genre[]): MintForm {
  const enabledShards = {} as Record<ShardBackend, boolean>;
  for (const o of shardOptions) {
    enabledShards[o.backend] = o.mandatory ? true : o.defaultEnabled;
  }
  return {
    fileSelected: false,
    fileName: "",
    artistName: "",
    title: "",
    mediaType: "image",
    genre: genres[0] ?? "Generative",
    description: "",
    traits: [],
    royaltyPct: 7.5,
    enabledShards,
    lockShards: true,
    collectionAddress: undefined,
    collectionName: undefined,
    mintType: "single",
    editionSize: 1,
  };
}

/**
 * Max upload size. Files are uploaded directly to Vercel Blob from the browser
 * (see useOnchainMint), so the ~4.5 MB serverless body cap doesn't apply; this
 * is our own ceiling. Note: Irys is free only < 100 KiB and Arweave cost scales
 * with size, so large files need those wallets funded.
 */
export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

/** Accepted upload MIME types -> the contract's coarse MediaType bucket. */
export const ACCEPTED_UPLOAD = "image/png,image/jpeg,image/gif,image/webp,image/svg+xml,video/mp4,video/webm,text/html,.html";

export function mediaTypeFromMime(mime: string): MediaType {
  if (mime.startsWith("video/")) return "video";
  if (mime === "text/html") return "interactive";
  return "image";
}

/** Trait rows with both a key and value filled in, trimmed and de-duped by key. */
export function cleanTraits(form: MintForm): TraitInput[] {
  const seen = new Set<string>();
  const out: TraitInput[] = [];
  for (const t of form.traits) {
    const key = t.key.trim();
    const value = t.value.trim();
    if (!key || !value) continue;
    const k = key.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ key, value });
  }
  return out;
}

/** Stable preview seed derived from title + artist (PRD: deterministic art). */
export function previewSeed(form: MintForm): string {
  const base = `${form.title.trim()}|${form.artistName.trim()}`.toLowerCase();
  return base ? `mint:${base}` : "mint:preview";
}

/** Selected shard cost total, in ETH. */
export function totalCostEth(
  form: MintForm,
  shardOptions: ShardOption[],
): number {
  return shardOptions.reduce(
    (sum, o) => (form.enabledShards[o.backend] ? sum + o.estCostEth : sum),
    0,
  );
}

/** Step 1 validity - required metadata before advancing. */
export function uploadValid(form: MintForm): boolean {
  return (
    form.fileSelected &&
    form.title.trim().length > 0 &&
    form.artistName.trim().length > 0
  );
}

export function stepValid(step: StepKey, form: MintForm): boolean {
  switch (step) {
    case "upload":
      return uploadValid(form);
    default:
      // royalty / permanence / lock / review always satisfiable from valid step 1
      return true;
  }
}
