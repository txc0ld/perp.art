import { NextResponse } from "next/server";
import { keccak256 } from "viem";
import { del } from "@vercel/blob";
import { serverEnv, publicEnv } from "@/lib/env";
import { publishToLogLedger } from "@/lib/logledger/relayer";

/**
 * POST /api/store  (application/json)
 * Pins the artist's uploaded artwork (already in Vercel Blob, uploaded directly
 * from the browser) across the permanent off-chain shards, and returns each
 * result + the content hash (keccak256 of the bytes, anchored on-chain).
 *
 *   - IPFS    (Pinata)              -> needs PINATA_JWT
 *   - Arweave (arweave SDK)         -> needs ARWEAVE_WALLET_JWK (funded)
 *   - Irys    (@irys/upload)        -> needs IRYS_PRIVATE_KEY (free < 100 KiB)
 *
 * The bytes are streamed from the Blob URL (not an HTTP request body), so the
 * ~4.5 MB serverless body cap does not apply — files up to ~100 MB work. A
 * backend without a configured/funded key returns { ok:false } and is skipped.
 *
 * Body: { blobUrl, name, description?, genre?, mediaType?, traits? }
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_BYTES = 100 * 1024 * 1024; // 100 MB

type ShardResult = { backend: string; ok: boolean; uri?: string; gateway?: string; error?: string };

export async function POST(request: Request) {
  let body: {
    blobUrl?: string;
    name?: string;
    description?: string;
    genre?: string;
    mediaType?: string;
    fileName?: string;
    traits?: { key?: string; value?: string }[];
    chainId?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const { blobUrl, name = "Untitled", description = "", genre, mediaType, fileName = "artwork", traits = [], chainId } = body;
  if (!blobUrl || typeof blobUrl !== "string" || !/^https:\/\/[^/]+\.public\.blob\.vercel-storage\.com\//.test(blobUrl)) {
    return NextResponse.json({ error: "missing or invalid blobUrl" }, { status: 400 });
  }

  // Stream the uploaded file back from Blob storage (no request-body cap here).
  let fileBlob: Blob;
  try {
    const res = await fetch(blobUrl);
    if (!res.ok) return NextResponse.json({ error: `could not read upload (${res.status})` }, { status: 400 });
    fileBlob = await res.blob();
  } catch {
    return NextResponse.json({ error: "could not read upload" }, { status: 400 });
  }
  if (fileBlob.size === 0 || fileBlob.size > MAX_BYTES) {
    return NextResponse.json({ error: "missing or oversized file" }, { status: 413 });
  }

  const mime = mediaType || fileBlob.type || "application/octet-stream";
  const bytes = new Uint8Array(await fileBlob.arrayBuffer());
  const contentHash = keccak256(bytes);
  const env = serverEnv();

  // OpenSea-style attributes: genre first, then any user-supplied traits.
  const attributes = [
    ...(genre ? [{ trait_type: "Genre", value: genre }] : []),
    ...(Array.isArray(traits) ? traits : [])
      .filter((t) => t && typeof t.key === "string" && typeof t.value === "string" && t.key.trim() && t.value.trim())
      .slice(0, 50)
      .map((t) => ({ trait_type: t.key!.trim().slice(0, 64), value: t.value!.trim().slice(0, 120) })),
  ];

  const metadata = {
    name: name.slice(0, 120),
    description,
    attributes,
    mediaType: mime,
    contentHash,
  };

  // Pin to the off-chain shards and publish the high-res LOG copy in parallel.
  // The LOG relayer (open/upload/seal) is skipped (ok:false) when the chain has
  // no LogLedger configured or the relayer key is absent.
  const [ipfs, arweave, irys, logLedger] = await Promise.all([
    pinIpfs(fileBlob, fileName, metadata, env.pinataJwt),
    uploadArweave(bytes, mime, env.arweaveWalletJwk),
    uploadIrys(bytes, mime, env.irysPrivateKey),
    publishToLogLedger({ chainId: Number(chainId), bytes, contentHash, mime }),
  ]);

  // Best-effort cleanup: the bytes now live in permanent storage; drop the
  // temporary Blob copy so it doesn't accrue storage cost.
  del(blobUrl).catch(() => {});

  return NextResponse.json({ contentHash, mediaType: mime, ipfs, arweave, irys, logLedger });
}

async function pinIpfs(file: Blob, fileName: string, metadata: object, jwt?: string): Promise<ShardResult> {
  if (!jwt) return { backend: "ipfs", ok: false, error: "PINATA_JWT not set" };
  try {
    const fd = new FormData();
    fd.append("file", file, fileName);
    const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
      method: "POST",
      headers: { Authorization: `Bearer ${jwt}` },
      body: fd,
    });
    if (!res.ok) return { backend: "ipfs", ok: false, error: `pin failed ${res.status}` };
    const cid = ((await res.json()) as { IpfsHash: string }).IpfsHash;
    await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
      method: "POST",
      headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
      body: JSON.stringify({ pinataContent: { ...metadata, image: `ipfs://${cid}` } }),
    }).catch(() => {});
    const gw = publicEnv.ipfsGateway.replace(/\/$/, "");
    return { backend: "ipfs", ok: true, uri: `ipfs://${cid}`, gateway: `${gw}/${cid}` };
  } catch (e) {
    return { backend: "ipfs", ok: false, error: e instanceof Error ? e.message : "error" };
  }
}

async function uploadArweave(bytes: Uint8Array, mime: string, jwk?: string): Promise<ShardResult> {
  if (!jwk) return { backend: "arweave", ok: false, error: "ARWEAVE_WALLET_JWK not set" };
  try {
    const Arweave = (await import("arweave")).default;
    const ar = Arweave.init({ host: "arweave.net", port: 443, protocol: "https" });
    const key = JSON.parse(jwk);
    const tx = await ar.createTransaction({ data: bytes }, key);
    tx.addTag("Content-Type", mime);
    await ar.transactions.sign(tx, key);
    const res = await ar.transactions.post(tx);
    if (res.status >= 300) return { backend: "arweave", ok: false, error: `post ${res.status}` };
    return { backend: "arweave", ok: true, uri: `ar://${tx.id}`, gateway: `https://arweave.net/${tx.id}` };
  } catch (e) {
    return { backend: "arweave", ok: false, error: e instanceof Error ? e.message : "error" };
  }
}

async function uploadIrys(bytes: Uint8Array, mime: string, privateKey?: string): Promise<ShardResult> {
  if (!privateKey) return { backend: "irys", ok: false, error: "IRYS_PRIVATE_KEY not set" };
  try {
    const { Uploader } = await import("@irys/upload");
    const { Ethereum } = await import("@irys/upload-ethereum");
    const irys = await Uploader(Ethereum).withWallet(privateKey);
    const receipt = await irys.upload(Buffer.from(bytes), {
      tags: [{ name: "Content-Type", value: mime }],
    });
    return { backend: "irys", ok: true, uri: `irys://${receipt.id}`, gateway: `https://gateway.irys.xyz/${receipt.id}` };
  } catch (e) {
    return { backend: "irys", ok: false, error: e instanceof Error ? e.message : "error" };
  }
}
