import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

/**
 * POST /api/upload  — issues a short-lived client token so the browser can
 * upload the artwork DIRECTLY to Vercel Blob, bypassing the ~4.5 MB serverless
 * request-body cap. The raw bytes never pass through this function; we only
 * authorize the upload. /api/store then pins the file from its Blob URL.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 100 * 1024 * 1024; // 100 MB

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;
  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: [
          "image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml",
          "video/mp4", "video/webm", "text/html",
        ],
        maximumSizeInBytes: MAX_BYTES,
        addRandomSuffix: true,
      }),
      // Pinning happens in /api/store after the client has the URL; nothing to do here.
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(json);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "upload authorization failed" },
      { status: 400 },
    );
  }
}
