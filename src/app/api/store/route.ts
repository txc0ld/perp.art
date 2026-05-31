import { NextResponse } from "next/server";
import { keccak256, toBytes } from "viem";
import { serverEnv, publicEnv } from "@/lib/env";

/**
 * POST /api/store
 * Stores the artwork bytes across the permanent off-chain shards and returns
 * each result + the content hash (keccak256 of the bytes, anchored on-chain).
 *
 *   - IPFS    (Pinata)              -> needs PINATA_JWT
 *   - Arweave (arweave SDK)         -> needs ARWEAVE_WALLET_JWK (funded)
 *   - Irys    (@irys/upload)        -> needs IRYS_PRIVATE_KEY (funded)
 *
 * A backend without a configured/funded key returns { ok:false } and is simply
 * skipped; the others still store. The onchain proof shard (Shard 0) is built
 * client-side from this content hash.
 *
 * Body: { svg, name, description?, genre?, mediaType? }
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type ShardResult = { backend: string; ok: boolean; uri?: string; gateway?: string; error?: string };

export async function POST(request: Request) {
  let body: {
    svg?: string;
    name?: string;
    description?: string;
    genre?: string;
    mediaType?: string;
    traits?: { key?: string; value?: string }[];
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const { svg, name = "Untitled", description = "", genre, mediaType = "image/svg+xml", traits = [] } = body;
  if (!svg || typeof svg !== "string" || svg.length > 2_000_000) {
    return NextResponse.json({ error: "missing or oversized svg" }, { status: 400 });
  }

  const bytes = toBytes(svg);
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
    mediaType,
    contentHash,
  };

  const [ipfs, arweave, irys] = await Promise.all([
    pinIpfs(svg, metadata, env.pinataJwt),
    uploadArweave(svg, env.arweaveWalletJwk),
    uploadIrys(svg, env.irysPrivateKey),
  ]);

  return NextResponse.json({ contentHash, ipfs, arweave, irys });
}

async function pinIpfs(svg: string, metadata: object, jwt?: string): Promise<ShardResult> {
  if (!jwt) return { backend: "ipfs", ok: false, error: "PINATA_JWT not set" };
  try {
    const fd = new FormData();
    fd.append("file", new Blob([svg], { type: "image/svg+xml" }), "artwork.svg");
    const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
      method: "POST",
      headers: { Authorization: `Bearer ${jwt}` },
      body: fd,
    });
    if (!res.ok) return { backend: "ipfs", ok: false, error: `pin failed ${res.status}` };
    const cid = ((await res.json()) as { IpfsHash: string }).IpfsHash;
    // Pin metadata referencing the image so tokenURI consumers resolve cleanly.
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

async function uploadArweave(svg: string, jwk?: string): Promise<ShardResult> {
  if (!jwk) return { backend: "arweave", ok: false, error: "ARWEAVE_WALLET_JWK not set" };
  try {
    const Arweave = (await import("arweave")).default;
    const ar = Arweave.init({ host: "arweave.net", port: 443, protocol: "https" });
    const key = JSON.parse(jwk);
    const tx = await ar.createTransaction({ data: svg }, key);
    tx.addTag("Content-Type", "image/svg+xml");
    await ar.transactions.sign(tx, key);
    const res = await ar.transactions.post(tx);
    if (res.status >= 300) return { backend: "arweave", ok: false, error: `post ${res.status}` };
    return { backend: "arweave", ok: true, uri: `ar://${tx.id}`, gateway: `https://arweave.net/${tx.id}` };
  } catch (e) {
    return { backend: "arweave", ok: false, error: e instanceof Error ? e.message : "error" };
  }
}

async function uploadIrys(svg: string, privateKey?: string): Promise<ShardResult> {
  if (!privateKey) return { backend: "irys", ok: false, error: "IRYS_PRIVATE_KEY not set" };
  try {
    const { Uploader } = await import("@irys/upload");
    const { Ethereum } = await import("@irys/upload-ethereum");
    const irys = await Uploader(Ethereum).withWallet(privateKey);
    const receipt = await irys.upload(svg, {
      tags: [{ name: "Content-Type", value: "image/svg+xml" }],
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
