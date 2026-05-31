import { describe, it, expect } from "vitest";
import {
  MAX_PROOF_BYTES,
  pickProofStrategy,
  escapeXml,
  withinProofCap,
  buildCoverCardSvg,
} from "./state-proof";

describe("pickProofStrategy", () => {
  it("svg → svg, raster image → raster, video → video, else → card", () => {
    expect(pickProofStrategy("image/svg+xml")).toBe("svg");
    expect(pickProofStrategy("image/png")).toBe("raster");
    expect(pickProofStrategy("image/webp")).toBe("raster");
    expect(pickProofStrategy("video/mp4")).toBe("video");
    expect(pickProofStrategy("text/html")).toBe("card");
    expect(pickProofStrategy("audio/mpeg")).toBe("card");
    expect(pickProofStrategy("")).toBe("card");
  });
});

describe("escapeXml", () => {
  it("escapes the five XML metacharacters", () => {
    expect(escapeXml(`<a href="x" & 'y'>`)).toBe("&lt;a href=&quot;x&quot; &amp; &apos;y&apos;&gt;");
  });
});

describe("withinProofCap", () => {
  it("rejects empty and oversized, accepts in-range", () => {
    expect(withinProofCap(new Uint8Array(0))).toBe(false);
    expect(withinProofCap(new Uint8Array(MAX_PROOF_BYTES))).toBe(true);
    expect(withinProofCap(new Uint8Array(MAX_PROOF_BYTES + 1))).toBe(false);
  });
});

describe("buildCoverCardSvg", () => {
  const meta = { title: "Strata No. 1", artist: "Claude Wren", contentHash: "0xabc123def4567890feedface" };

  it("produces a valid, small SVG under the cap", () => {
    const bytes = buildCoverCardSvg(meta);
    expect(withinProofCap(bytes)).toBe(true);
    const svg = new TextDecoder().decode(bytes);
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg.trimEnd().endsWith("</svg>")).toBe(true);
  });

  it("embeds escaped title + artist", () => {
    const svg = new TextDecoder().decode(buildCoverCardSvg({ ...meta, title: "A & B <x>" }));
    expect(svg).toContain("A &amp; B &lt;x&gt;");
    expect(svg).toContain("Claude Wren");
  });

  it("stays under cap even with maximal title/artist", () => {
    const bytes = buildCoverCardSvg({ title: "T".repeat(500), artist: "A".repeat(500), contentHash: "0x" + "f".repeat(64) });
    expect(withinProofCap(bytes)).toBe(true);
  });

  it("shortens a long content hash", () => {
    const svg = new TextDecoder().decode(buildCoverCardSvg(meta));
    expect(svg).toContain("…");
  });

  it("handles empty meta without throwing", () => {
    const bytes = buildCoverCardSvg({ title: "", artist: "", contentHash: "" });
    expect(withinProofCap(bytes)).toBe(true);
  });
});
