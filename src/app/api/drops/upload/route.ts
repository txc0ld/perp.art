import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

/**
 * POST /api/drops/upload — issues a short-lived client token so the browser can
 * upload the drop ZIP DIRECTLY to Vercel Blob (multipart, GB-scale), bypassing
 * the ~4.5 MB serverless request-body cap. The raw bytes never pass through
 * this function; /api/drops/process then reads + processes the ZIP from its
 * Blob URL.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 500 * 1024 * 1024; // 500 MB

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;
  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: [
          "application/zip",
          "application/x-zip-compressed",
          "application/octet-stream",
          "multipart/x-zip",
        ],
        maximumSizeInBytes: MAX_BYTES,
        addRandomSuffix: true,
      }),
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
