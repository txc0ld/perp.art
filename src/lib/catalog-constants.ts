/**
 * Catalog constants — the canonical genre vocabulary and the mint-flow shard
 * options. Real product metadata (PRD §10.3), independent of any fabricated
 * catalog.
 */
import type { Genre, ShardOption } from "./types";

export const GENRES: Genre[] = [
  "Generative", "AI", "PFP", "Photography", "Illustration", "3D", "Pixel",
  "Voxel", "Glitch", "Vector", "Motion", "Fractal", "Collage", "Audio", "Abstract",
];

// ---------------------------------------------------------------------------
// Mint flow shard options (PRD §10.3)
// ---------------------------------------------------------------------------

export const SHARD_OPTIONS: ShardOption[] = [
  { backend: "onchain", label: "Onchain STATE (SSTORE2)", blurb: "The low-res canonical proof, stored in contract state. The consensus-guaranteed backstop and the only shard that satisfies listing eligibility.", estCostEth: 0.012, mandatory: true, defaultEnabled: true },
  { backend: "log", label: "Onchain LOG (high-res)", blurb: "Full-resolution media in event logs (~8 gas/byte). Cost-efficient and root-verifiable; availability is retention-monitored.", estCostEth: 0.002, mandatory: false, defaultEnabled: true },
  { backend: "ipfs", label: "IPFS", blurb: "Content-addressed high-resolution media, auto-pinned.", estCostEth: 0.0, mandatory: false, defaultEnabled: true },
  { backend: "arweave", label: "Arweave", blurb: "Pay-once permanent storage. Confirmed forever.", estCostEth: 0.004, mandatory: false, defaultEnabled: true },
  { backend: "irys", label: "Irys (Datachain)", blurb: "Additional permanent redundancy across an independent network.", estCostEth: 0.003, mandatory: false, defaultEnabled: true },
];
