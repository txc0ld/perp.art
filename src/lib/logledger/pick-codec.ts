import { Codec, type CodecValue } from "./codec";

/**
 * Choose a compression codec for the LOG copy based on MIME (source brief §3.3).
 * Already-compressed formats (PNG/WEBP/JPEG/GIF, video) are stored raw — re-
 * compressing wastes CPU for ~0 gain. Everything else gets gzip. (Brotli, which
 * would edge out gzip on SVG/text, is reserved/unimplemented in the codec.)
 */
export function pickCodec(mime: string): CodecValue {
  const m = mime.toLowerCase();
  if (/^image\/(png|webp|jpeg|jpg|gif)$/.test(m)) return Codec.Raw;
  if (m.startsWith("video/")) return Codec.Raw;
  return Codec.Gzip;
}
