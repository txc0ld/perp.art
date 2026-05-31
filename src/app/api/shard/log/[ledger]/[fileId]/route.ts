import { NextResponse } from "next/server";
import { list, put } from "@vercel/blob";
import type { Hex } from "viem";
import { loadAndVerifyLogShard } from "@/lib/logledger/resolve";

/**
 * GET /api/shard/log/[ledger]/[fileId]
 * Serve a token's high-res LOG copy: reconstruct from chain logs, verify the
 * Merkle root, cache the verified bytes in Vercel Blob (immutable once sealed),
 * and 302-redirect to the CDN URL. On failure returns 502 + X-Log-Status so the
 * frontend falls back to the on-chain STATE shard.
 *
 * Query: ?mime=<type> (Content-Type override), ?chainId=<id> (else inferred).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const ADDR = /^0x[0-9a-fA-F]{40}$/;
const BYTES32 = /^0x[0-9a-fA-F]{64}$/;

export async function GET(
  request: Request,
  ctx: { params: Promise<{ ledger: string; fileId: string }> },
) {
  const { ledger, fileId } = await ctx.params;
  if (!ADDR.test(ledger) || !BYTES32.test(fileId)) {
    return NextResponse.json({ error: "invalid ledger or fileId" }, { status: 400 });
  }

  const url = new URL(request.url);
  const mimeParam = url.searchParams.get("mime") ?? undefined;
  const chainParam = url.searchParams.get("chainId");
  const chainId = chainParam ? Number(chainParam) : undefined;

  const blobKey = `log-shard/${fileId}.bin`;
  const immutable = "public, max-age=31536000, immutable";

  // Cache hit: serve straight from the Blob CDN.
  try {
    const { blobs } = await list({ prefix: blobKey, limit: 1 });
    if (blobs.length > 0) {
      return NextResponse.redirect(blobs[0].url, {
        status: 302,
        headers: { "Cache-Control": immutable, "X-Log-Status": "cached" },
      });
    }
  } catch {
    /* cache check best-effort; fall through to reconstruct */
  }

  // Miss: reconstruct + verify against the on-chain root.
  let shard;
  try {
    shard = await loadAndVerifyLogShard({ ledger: ledger as Hex, fileId: fileId as Hex, chainId, mime: mimeParam });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "log shard unavailable" },
      { status: 502, headers: { "X-Log-Status": "unavailable" } },
    );
  }

  // Cache the verified bytes (deterministic path) and redirect to the CDN.
  try {
    const blob = await put(blobKey, Buffer.from(shard.bytes), {
      access: "public",
      contentType: shard.mime,
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    return NextResponse.redirect(blob.url, {
      status: 302,
      headers: {
        "Cache-Control": immutable,
        "X-Log-Status": "reconstructed",
        "X-Content-Root": shard.root,
        "X-Codec": String(shard.codec),
        "X-Size": String(shard.size),
      },
    });
  } catch {
    // Blob unavailable — stream the verified bytes directly with headers.
    return new NextResponse(Buffer.from(shard.bytes), {
      headers: {
        "Content-Type": shard.mime,
        "Cache-Control": immutable,
        ETag: shard.root,
        "X-Log-Status": "reconstructed",
        "X-Content-Root": shard.root,
        "X-Codec": String(shard.codec),
        "X-Size": String(shard.size),
      },
    });
  }
}
