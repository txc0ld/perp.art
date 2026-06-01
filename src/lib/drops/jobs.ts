import "server-only";
import type { Hex } from "viem";

/**
 * In-memory drop-processing job store.
 *
 * HONESTY / LIMITS (flagged in the report): this lives in module memory, so it
 * only survives within a single serverless instance and is lost on cold start.
 * It is sufficient for dev and single-instance deploys, and for the synchronous
 * processing path below (the job is created, run to completion within one
 * /api/drops/process invocation, and then polled from the SAME warm instance).
 * For multi-instance production durability this MUST be backed by Redis/KV
 * (the repo already references REDIS_URL in env.ts) — see the TODO in
 * /api/drops/process.
 */

export type JobStatus = "pending" | "processing" | "done" | "error";

export interface DropJobResult {
  provenanceHash: Hex;
  /** ipfs://<cid>/ — pass to factory.createDrop placeholder + reveal. */
  mediaCID: string;
  /** ipfs://<cid>/ — the metadata folder baseURI (tokenURI = baseURI + id). */
  metadataBaseURI: string;
  /** Arweave manifest/tx id mirror, when configured. */
  arweaveManifest?: string;
  count: number;
  /** Per-asset ordered hash manifest (token #1..#N). The provenance anchor. */
  assetHashes: Hex[];
  warnings: string[];
}

export interface DropJob {
  id: string;
  status: JobStatus;
  /** 0..100 */
  progress: number;
  /** Human-readable current step. */
  step: string;
  result?: DropJobResult;
  error?: string;
  createdAt: number;
}

const jobs = new Map<string, DropJob>();
const TTL_MS = 30 * 60 * 1000; // 30 min

function sweep() {
  const now = Date.now();
  for (const [id, j] of jobs) {
    if (now - j.createdAt > TTL_MS) jobs.delete(id);
  }
}

export function createJob(): DropJob {
  sweep();
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `job_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const job: DropJob = {
    id,
    status: "pending",
    progress: 0,
    step: "queued",
    createdAt: Date.now(),
  };
  jobs.set(id, job);
  return job;
}

export function getJob(id: string): DropJob | undefined {
  return jobs.get(id);
}

export function updateJob(id: string, patch: Partial<DropJob>): void {
  const j = jobs.get(id);
  if (j) jobs.set(id, { ...j, ...patch });
}
