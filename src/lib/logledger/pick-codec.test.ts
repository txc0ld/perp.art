import { describe, it, expect } from "vitest";
import { pickCodec } from "./pick-codec";
import { Codec } from "./codec";

describe("pickCodec", () => {
  it("stores already-compressed images raw", () => {
    for (const m of ["image/png", "image/webp", "image/jpeg", "image/gif", "IMAGE/PNG"]) {
      expect(pickCodec(m)).toBe(Codec.Raw);
    }
  });

  it("stores video raw", () => {
    expect(pickCodec("video/mp4")).toBe(Codec.Raw);
    expect(pickCodec("video/webm")).toBe(Codec.Raw);
  });

  it("gzips SVG, text, html, json and unknown", () => {
    for (const m of ["image/svg+xml", "text/html", "text/plain", "application/json", "application/octet-stream"]) {
      expect(pickCodec(m)).toBe(Codec.Gzip);
    }
  });

  it("never returns the reserved Brotli codec", () => {
    for (const m of ["image/svg+xml", "text/html", "image/png", "video/mp4", "weird/thing"]) {
      expect(pickCodec(m)).not.toBe(Codec.Brotli);
    }
  });
});
