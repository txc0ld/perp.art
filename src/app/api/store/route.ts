import { NextResponse } from "next/server";
import { keccak256 } from "viem";
import { serverEnv, publicEnv } from "@/lib/env";

/**
 * POST /api/store  (multipart/form-data)
 * Stores the artist's actual uploaded artwork bytes across the permanent
 * off-chain shards and returns each result + the content hash (keccak256 of the
 * bytes, anchored on-chain).
 *
 *   - IPFS    (Pinata)              -> needs PINATA_JWT
 *   - Arweave (arweave SDK)         -> needs ARWEAVE_WALLET_JWK (funded)
 *   - Irys    (@irys/upload)        -> needs IRYS_PRIVATE_KEY (free < 100 KiB)
 *
 * A backend without a configured/funded key returns { ok:false } and is simply
 * skipped; the others still store. The onchain proof shard (Shard 0) is built
 * client-side from this content hash.
 *
 * Form fields: file (Blob, required), name, description?, genre?, mediaType?,
 *              traits? (JSON array of {key,value})
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Keep under Vercel's ~4.5 MB serverless request-body cap.
const MAX_BYTES = 4_400_000;

type ShardResult = { backend: string; ok: boolean; uri?: string; gateway?: string; error?: string };

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "expected multipart/form-data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "missing file" }, { status: 400 });
  }
  if (file.size === 0 || file.size > MAX_BYTES) {
    return NextResponse.json({ error: "missing or oversized file" }, { status: 413 });
  }

  const name = String(form.get("name") ?? "Untitled");
  const description = String(form.get("description") ?? "");
  const genre = form.get("genre") ? String(form.get("genre")) : undefined;
  const fileName = ("name" in file && typeof (file as File).name === "string" ? (file as File).name : "artwork") || "artwork";
  const mime = file.type || String(form.get("mediaType") ?? "application/octet-stream");

  let traits: { key?: string; value?: string }[] = [];
  try {
    const raw = form.get("traits");
    if (raw) traits = JSON.parse(String(raw));
  } catch {
    traits = [];
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
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

  const [ipfs, arweave, irys] = await Promise.all([
    pinIpfs(file, fileName, metadata, env.pinataJwt),
    uploadArweave(bytes, mime, env.arweaveWalletJwk),
    uploadIrys(bytes, mime, env.irysPrivateKey),
  ]);

  return NextResponse.json({ contentHash, mediaType: mime, ipfs, arweave, irys });
}

async function pinIpfs(
  file: Blob,
  fileName: string,
  metadata: object,
  jwt?: string,
): Promise<ShardResult> {
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
    // Pin a metadata JSON referencing the image so tokenURI consumers resolve cleanly.
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
    return {
      backend: "irys",
      ok: true,
      uri: `irys://${receipt.id}`,
      gateway: `https://gateway.irys.xyz/${receipt.id}`,
    };
  } catch (e) {
    return { backend: "irys", ok: false, error: e instanceof Error ? e.message : "error" };
  }
}
