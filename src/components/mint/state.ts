import type { Genre, MediaType, ShardBackend, ShardOption } from "@/lib/types";

/** The single wizard form-state object, driven from MintWizard. */
export interface MintForm {
  // Step 1 - artwork + metadata
  fileSelected: boolean;
  fileName: string;
  artistName: string;
  title: string;
  mediaType: MediaType;
  genre: Genre;
  description: string;

  // Step 2 - royalty
  royaltyPct: number; // 0..15

  // Step 3 - permanence shards (which backends are enabled)
  enabledShards: Record<ShardBackend, boolean>;

  // Step 4 - lock
  lockShards: boolean;
}

export const STEPS = [
  { key: "upload", label: "Artwork" },
  { key: "royalty", label: "Royalty" },
  { key: "permanence", label: "Permanence" },
  { key: "lock", label: "Lock" },
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
    royaltyPct: 7.5,
    enabledShards,
    lockShards: true,
  };
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
