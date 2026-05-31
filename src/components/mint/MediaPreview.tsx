"use client";

import type { Genre } from "@/lib/types";
import { GenerativeArt } from "@/components/art/GenerativeArt";

/**
 * Renders the artist's actual uploaded artwork (image / video / interactive
 * HTML) when a file is present; otherwise falls back to the deterministic
 * generative art. Shared by the mint upload, review, and success screens so
 * the same media shows the whole way through.
 */
export function MediaPreview({
  url,
  mime,
  seed,
  genre,
  className,
  alt = "Artwork preview",
}: {
  url?: string;
  mime?: string;
  seed: string;
  genre: Genre;
  className?: string;
  alt?: string;
}) {
  if (url && mime) {
    if (mime.startsWith("video/")) {
      return (
        <video
          src={url}
          className={className}
          autoPlay
          muted
          loop
          playsInline
          aria-label={alt}
        />
      );
    }
    if (mime === "text/html") {
      return (
        <iframe
          src={url}
          className={className}
          sandbox="allow-scripts allow-same-origin"
          title={alt}
          loading="lazy"
        />
      );
    }
    // images (incl. svg, gif, webp)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={alt} className={className} loading="lazy" decoding="async" />;
  }
  return <GenerativeArt seed={seed} genre={genre} className={className} />;
}
