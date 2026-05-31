/**
 * Client-side generation of the on-chain STATE proof (Shard 0) bytes.
 *
 * The proof is ALWAYS a small image so the deployed contract can serve Shard 0
 * as a `data:<mime>;base64,...` URI. It must be <= MAX_PROOF_BYTES (one SSTORE2
 * write). Strategy by media kind:
 *   - raster image  -> canvas downscale to WEBP
 *   - SVG           -> rasterize then downscale to WEBP
 *   - video         -> first-frame poster -> WEBP
 *   - everything else (audio / html / unknown) or ANY failure -> generated SVG
 *     cover-card (title + artist + content hash); always tiny, always works.
 *
 * The canvas/video paths require the browser; the SVG card + helpers are pure.
 */

/** Must match ForeverLibrary.MAX_PROOF_BYTES (raw bytes, pre-base64). */
export const MAX_PROOF_BYTES = 24_000;

export interface ProofMeta {
  title: string;
  artist: string;
  contentHash: string;
}

export interface ProofBytes {
  bytes: Uint8Array;
  mime: string;
}

export type ProofStrategy = "raster" | "svg" | "video" | "card";

/** Decide how to build the proof from a MIME type (pure). */
export function pickProofStrategy(mime: string): ProofStrategy {
  const m = (mime || "").toLowerCase();
  if (m === "image/svg+xml") return "svg";
  if (m.startsWith("image/")) return "raster";
  if (m.startsWith("video/")) return "video";
  return "card";
}

/** XML-escape a string for safe embedding in SVG text (pure). */
export function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** True if these bytes fit the on-chain proof cap (pure). */
export function withinProofCap(bytes: Uint8Array): boolean {
  return bytes.length > 0 && bytes.length <= MAX_PROOF_BYTES;
}

/**
 * Build the deterministic SVG cover-card used as the universal fallback proof
 * (pure; no DOM). Title/artist are truncated and XML-escaped; the content hash
 * is shown short. Output is UTF-8 SVG bytes, always well under the cap.
 */
export function buildCoverCardSvg(meta: ProofMeta): Uint8Array {
  const title = escapeXml((meta.title || "Untitled").slice(0, 64));
  const artist = escapeXml((meta.artist || "Unknown").slice(0, 48));
  const hash = (meta.contentHash || "").toLowerCase();
  const shortHash = hash.length > 14 ? `${hash.slice(0, 10)}…${hash.slice(-6)}` : hash;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">` +
    `<rect width="600" height="600" fill="#0b0b0f"/>` +
    `<rect x="24" y="24" width="552" height="552" fill="none" stroke="#2a2a35" stroke-width="2"/>` +
    `<text x="48" y="120" fill="#e8e8ef" font-family="Georgia,serif" font-size="40" font-weight="600">${title}</text>` +
    `<text x="48" y="168" fill="#9aa0b4" font-family="Georgia,serif" font-size="24">${artist}</text>` +
    `<text x="48" y="540" fill="#5b6072" font-family="monospace" font-size="16">${escapeXml(shortHash)}</text>` +
    `<text x="48" y="566" fill="#5b6072" font-family="monospace" font-size="13" letter-spacing="2">PERPETUAL · ON-CHAIN PROOF</text>` +
    `</svg>`;
  return new TextEncoder().encode(svg);
}

// ---------------------------------------------------------------------------
// Browser-only rasterization (canvas / video). Not unit-tested in node.
// ---------------------------------------------------------------------------

function loadImageEl(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image decode failed"));
    };
    img.src = url;
  });
}

function canvasToBytes(canvas: HTMLCanvasElement, quality: number): Promise<Uint8Array | null> {
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return resolve(null);
        blob.arrayBuffer().then((buf) => resolve(new Uint8Array(buf)));
      },
      "image/webp",
      quality,
    );
  });
}

/**
 * Draw a source onto a canvas downscaled to fit `maxDim`, then encode WEBP,
 * stepping quality (and then dimension) down until under the proof cap.
 * Returns null if it cannot get under the cap (caller falls back to the card).
 */
async function rasterToProof(
  source: CanvasImageSource,
  w: number,
  h: number,
): Promise<ProofBytes | null> {
  const baseW = w || 512;
  const baseH = h || 512;
  for (const maxDim of [512, 384, 256, 192, 128]) {
    const scale = Math.min(1, maxDim / Math.max(baseW, baseH));
    const cw = Math.max(1, Math.round(baseW * scale));
    const ch = Math.max(1, Math.round(baseH * scale));
    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(source, 0, 0, cw, ch);
    for (const q of [0.8, 0.6, 0.45, 0.3, 0.2]) {
      const bytes = await canvasToBytes(canvas, q);
      if (bytes && withinProofCap(bytes)) return { bytes, mime: "image/webp" };
    }
  }
  return null;
}

function videoPosterToProof(file: Blob): Promise<ProofBytes | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    const done = (out: ProofBytes | null) => {
      URL.revokeObjectURL(url);
      resolve(out);
    };
    video.onloadeddata = () => {
      const seekTo = Math.min(0.1, (video.duration || 1) / 2);
      const grab = async () => {
        const out = await rasterToProof(video, video.videoWidth, video.videoHeight);
        done(out);
      };
      video.onseeked = grab;
      try {
        video.currentTime = seekTo;
      } catch {
        void grab();
      }
    };
    video.onerror = () => done(null);
    video.src = url;
  });
}

/**
 * Produce the on-chain STATE proof bytes for an uploaded file. Always succeeds:
 * any decode/encode failure falls back to the SVG cover-card. Guaranteed
 * <= MAX_PROOF_BYTES.
 */
export async function generateStateProof(file: File, meta: ProofMeta): Promise<ProofBytes> {
  const strategy = pickProofStrategy(file.type || "");
  try {
    if (strategy === "raster" || strategy === "svg") {
      const img = await loadImageEl(file);
      const out = await rasterToProof(img, img.naturalWidth, img.naturalHeight);
      if (out) return out;
    } else if (strategy === "video") {
      const out = await videoPosterToProof(file);
      if (out) return out;
    }
  } catch {
    /* fall through to the card */
  }
  return { bytes: buildCoverCardSvg(meta), mime: "image/svg+xml" };
}
