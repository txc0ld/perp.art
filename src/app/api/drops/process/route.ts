import { NextResponse } from "next/server";
import { unzipSync } from "fflate";
import type { Hex } from "viem";
import { serverEnv, publicEnv } from "@/lib/env";
import { createJob, updateJob, type DropJobResult } from "@/lib/drops/jobs";
import { validateDropEntries, type ZipEntry, type ValidatedToken } from "@/lib/drops/validate";
import { computeProvenanceHash, hashAsset, MAX_DROP_SIZE } from "@/lib/drops/provenance";
import { pinDirectory, type DirFile } from "@/lib/drops/pin";

/**
 * POST /api/drops/process  { blobUrl }
 *
 * Kicks off processing of a drop ZIP already uploaded to Vercel Blob (via
 * /api/upload). Returns a job id immediately; the actual work runs within this
 * invocation (synchronously) and reports progress through the in-memory job
 * store, polled via GET /api/drops/status?id=.
 *
 * Pipeline: download ZIP → unzip (fflate) → validate (count ≤ MAX_DROP_SIZE,
 * image↔metadata pairing, schema) → keccak each image → provenanceHash =
 * keccak256(concat(orderedAssetHashes)) → pin the IMAGE folder + METADATA folder
 * to IPFS as DIRECTORIES (Pinata) → return { provenanceHash, mediaCID,
 * metadataBaseURI, count, assetHashes }.
 *
 * SCALE / DURABILITY (see jobs.ts + pin.ts): the job store is in-memory and the
 * IPFS directory pin is a single multipart request per folder. This is reliable
 * for modest drops within the function limits. TODO for large (multi-thousand)
 * production drops: back the job store with Redis/KV and chunk the directory
 * pins (Pinata CAR upload or a pinning queue), resuming across invocations.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_ZIP_BYTES = 500 * 1024 * 1024; // 500 MB

const IMAGE_CT: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif",
  webp: "image/webp", svg: "image/svg+xml", avif: "image/avif",
};
function imageContentType(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return IMAGE_CT[ext] ?? "application/octet-stream";
}

export async function POST(request: Request) {
  let body: { blobUrl?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const { blobUrl } = body;
  if (!blobUrl || typeof blobUrl !== "string" || !/^https:\/\/[^/]+\.public\.blob\.vercel-storage\.com\//.test(blobUrl)) {
    return NextResponse.json({ error: "missing or invalid blobUrl" }, { status: 400 });
  }

  const job = createJob();
  // Run to completion within this invocation; the client polls the status route.
  await runJob(job.id, blobUrl).catch((e) => {
    updateJob(job.id, { status: "error", error: e instanceof Error ? e.message : "processing failed" });
  });

  const finished = (await import("@/lib/drops/jobs")).getJob(job.id);
  return NextResponse.json({ id: job.id, status: finished?.status ?? "processing" });
}

async function runJob(id: string, blobUrl: string): Promise<void> {
  const env = serverEnv();
  updateJob(id, { status: "processing", step: "downloading", progress: 2 });

  // 1) Download ZIP from Blob (no request-body cap; streamed from Blob URL).
  let zipBytes: Uint8Array;
  try {
    const res = await fetch(blobUrl);
    if (!res.ok) throw new Error(`could not read upload (${res.status})`);
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength === 0 || buf.byteLength > MAX_ZIP_BYTES) {
      throw new Error("missing or oversized ZIP");
    }
    zipBytes = buf;
  } catch (e) {
    updateJob(id, { status: "error", error: e instanceof Error ? e.message : "download failed" });
    return;
  }

  // 2) Unzip.
  updateJob(id, { step: "unzipping", progress: 8 });
  let entries: ZipEntry[];
  try {
    const files = unzipSync(zipBytes);
    entries = Object.entries(files).map(([path, bytes]) => ({ path: path.replace(/\\/g, "/"), bytes }));
  } catch {
    updateJob(id, { status: "error", error: "could not unzip the archive" });
    return;
  }

  // 3) Validate.
  updateJob(id, { step: "validating", progress: 14 });
  const v = validateDropEntries(entries);
  if (!v.ok) {
    updateJob(id, {
      status: "error",
      error: `Validation failed: ${v.errors.slice(0, 5).join(" ")}${v.errors.length > 5 ? ` (+${v.errors.length - 5} more)` : ""}`,
    });
    return;
  }
  if (v.count > MAX_DROP_SIZE) {
    updateJob(id, { status: "error", error: `Drop exceeds ${MAX_DROP_SIZE} (got ${v.count}).` });
    return;
  }

  // 4) Hash each asset (ordered by token id) + compute provenance hash.
  updateJob(id, { step: "hashing", progress: 22 });
  const ordered: ValidatedToken[] = [...v.tokens].sort((a, b) => a.tokenId - b.tokenId);
  const assetHashes: Hex[] = ordered.map((t) => hashAsset(t.imageBytes));
  let provenanceHash: Hex;
  try {
    provenanceHash = computeProvenanceHash(assetHashes);
  } catch (e) {
    updateJob(id, { status: "error", error: e instanceof Error ? e.message : "provenance failed" });
    return;
  }

  // 5) Pin the IMAGE folder as a directory. File name = token id (no extension
  //    is risky for content-type, so we keep the original extension and point
  //    metadata `image` at it). We name images by token id + extension.
  updateJob(id, { step: "pinning-images", progress: 35 });
  const gateway = publicEnv.ipfsGateway;
  const imageFiles: DirFile[] = ordered.map((t) => {
    const ext = t.imagePath.split(".").pop()?.toLowerCase() ?? "png";
    return { name: `${t.tokenId}.${ext}`, bytes: t.imageBytes, contentType: imageContentType(t.imagePath) };
  });
  const mediaPin = await pinDirectory("drop-media", imageFiles, env.pinataJwt, gateway);
  if (!mediaPin.ok || !mediaPin.cid) {
    updateJob(id, { status: "error", error: `IPFS media pin failed: ${mediaPin.error ?? "unknown"}` });
    return;
  }
  const mediaCID = `ipfs://${mediaPin.cid}/`;

  // 6) Rewrite each metadata JSON's `image` to point into the pinned media
  //    directory, then pin the METADATA folder as a directory. File name =
  //    token id with NO extension, so `tokenURI = baseURI + id` resolves to the
  //    JSON (matching the contract's string.concat(baseURI, id.toString())).
  updateJob(id, { step: "pinning-metadata", progress: 62 });
  const encoder = new TextEncoder();
  const metaFiles: DirFile[] = ordered.map((t) => {
    const ext = t.imagePath.split(".").pop()?.toLowerCase() ?? "png";
    const meta = { ...t.metadata, image: `${mediaCID}${t.tokenId}.${ext}` };
    return {
      name: `${t.tokenId}`,
      bytes: encoder.encode(JSON.stringify(meta)),
      contentType: "application/json",
    };
  });
  const metaPin = await pinDirectory("drop-metadata", metaFiles, env.pinataJwt, gateway);
  if (!metaPin.ok || !metaPin.cid) {
    updateJob(id, { status: "error", error: `IPFS metadata pin failed: ${metaPin.error ?? "unknown"}` });
    return;
  }
  const metadataBaseURI = `ipfs://${metaPin.cid}/`;

  // 7) Mirror to Arweave (optional — best effort). Single-tx-per-file Arweave
  //    mirroring at drop scale is expensive/slow; we skip it unless explicitly
  //    enabled and a funded wallet is present. Surface as a warning, not a fail.
  updateJob(id, { step: "finalizing", progress: 92 });
  const warnings = [...v.warnings];
  let arweaveManifest: string | undefined;
  if (!env.arweaveWalletJwk) {
    warnings.push("Arweave mirror skipped: ARWEAVE_WALLET_JWK not set (IPFS folder is the primary store).");
  } else {
    warnings.push("Arweave folder mirroring at drop scale is deferred (per-file Arweave txs are cost-prohibitive); IPFS folder is the primary store.");
  }

  const result: DropJobResult = {
    provenanceHash,
    mediaCID,
    metadataBaseURI,
    arweaveManifest,
    count: v.count,
    assetHashes,
    warnings,
  };
  updateJob(id, { status: "done", step: "done", progress: 100, result });
}
