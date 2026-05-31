/**
 * artSvgString - the deterministic generative artwork as a standalone SVG
 * markup string, mirroring GenerativeArt's per-genre logic. Used to pin the
 * real artwork bytes to IPFS/Arweave/Irys at mint time (the same seed always
 * yields the same SVG).
 */
import type { Genre } from "@/lib/types";
import { seededRandom } from "@/lib/utils";

const PALETTES: Record<Genre, string[]> = {
  Generative: ["#E8D8A0", "#C9A24B", "#8C5A2B", "#3A2A18", "#F4ECD2"],
  Glitch: ["#9EE6B4", "#5B8CFF", "#FF5B8C", "#1A1A2E", "#E0E0FF"],
  Photography: ["#D9C9A8", "#7A6A52", "#2A241C", "#C0B49A", "#F0E8D8"],
  Pixel: ["#FDA4AF", "#7DD3FC", "#FDE68A", "#A7F3D0", "#18181B"],
  AI: ["#C4B5FD", "#67E8F9", "#F0ABFC", "#1E1B4B", "#E9D5FF"],
  Abstract: ["#E8D8A0", "#A1A1AA", "#52525B", "#F4F4F5", "#27272A"],
  "3D": ["#9EE6B4", "#A1A1AA", "#E8D8A0", "#27272A", "#F4F4F5"],
};

const n = (v: number) => Math.round(v * 100) / 100;

export function artSvgString(seed: string, genre: Genre, size = 800): string {
  const r = seededRandom("art:" + seed);
  const palette = PALETTES[genre] ?? PALETTES.Abstract;
  const pick = () => palette[Math.floor(r() * palette.length)];
  const W = size, H = size;

  const bg = palette[3];
  const bg2 = palette[Math.floor(r() * palette.length)];
  const parts: string[] = [];

  if (genre === "Generative" || genre === "Abstract" || genre === "3D") {
    const bands = 7 + Math.floor(r() * 8);
    let y = 0;
    for (let i = 0; i < bands; i++) {
      const h = (H / bands) * (0.5 + r());
      const c = pick();
      const skew = (r() - 0.5) * 40;
      parts.push(`<path d="M0 ${n(y)} L${W} ${n(y + skew)} L${W} ${n(y + h + skew)} L0 ${n(y + h)} Z" fill="${c}" opacity="${n(0.55 + r() * 0.45)}"/>`);
      y += h * 0.7;
    }
    for (let i = 0; i < 18; i++) {
      const x = r() * W;
      parts.push(`<line x1="${n(x)}" y1="0" x2="${n(x + (r() - 0.5) * 60)}" y2="${H}" stroke="${palette[0]}" stroke-width="0.5" opacity="0.15"/>`);
    }
  } else if (genre === "Glitch") {
    const slices = 26 + Math.floor(r() * 20);
    for (let i = 0; i < slices; i++) {
      const y = r() * H, h = 2 + r() * 26, x = (r() - 0.5) * 80;
      parts.push(`<rect x="${n(x)}" y="${n(y)}" width="${W}" height="${n(h)}" fill="${pick()}" opacity="${n(0.5 + r() * 0.5)}"/>`);
    }
    for (let i = 0; i < 6; i++) {
      parts.push(`<rect x="${n(r() * W)}" y="${n(r() * H)}" width="${n(20 + r() * 120)}" height="${n(6 + r() * 20)}" fill="${palette[2]}" opacity="0.6"/>`);
    }
  } else if (genre === "Photography") {
    for (let i = 0; i < 5; i++) {
      parts.push(`<circle cx="${n(r() * W)}" cy="${n(r() * H)}" r="${n(80 + r() * 220)}" fill="${pick()}" opacity="${n(0.18 + r() * 0.2)}"/>`);
    }
    for (let i = 0; i < 4; i++) {
      parts.push(`<rect x="0" y="${n(r() * H)}" width="${W}" height="${n(1 + r() * 3)}" fill="${palette[4]}" opacity="0.5"/>`);
    }
  } else if (genre === "Pixel") {
    const cells = 16, cs = W / cells;
    for (let gx = 0; gx < cells; gx++) {
      for (let gy = 0; gy < cells; gy++) {
        if (r() > 0.62) {
          parts.push(`<rect x="${n(gx * cs)}" y="${n(gy * cs)}" width="${n(cs)}" height="${n(cs)}" fill="${pick()}" opacity="0.85"/>`);
        }
      }
    }
  } else if (genre === "AI") {
    for (let i = 0; i < 60; i++) {
      let x = r() * W, y = r() * H;
      let d = `M${n(x)} ${n(y)}`;
      for (let s = 0; s < 6; s++) {
        x += (r() - 0.5) * 90;
        y += 20 + r() * 60;
        d += ` Q ${n(x + (r() - 0.5) * 60)} ${n(y - 30)} ${n(x)} ${n(y)}`;
      }
      parts.push(`<path d="${d}" fill="none" stroke="${pick()}" stroke-width="${n(0.6 + r() * 1.6)}" opacity="${n(0.25 + r() * 0.4)}"/>`);
    }
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`,
    `<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">`,
    `<stop offset="0%" stop-color="${bg}"/><stop offset="100%" stop-color="${bg2}"/>`,
    `</linearGradient></defs>`,
    `<rect width="${W}" height="${H}" fill="url(#bg)"/>`,
    parts.join(""),
    `<rect width="${W}" height="${H}" fill="black" opacity="0.04"/>`,
    `</svg>`,
  ].join("");
}
