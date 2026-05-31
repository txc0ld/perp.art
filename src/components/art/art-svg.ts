/**
 * artSvgString - the deterministic generative artwork as a standalone SVG
 * markup string. It serializes the exact same primitives the React renderer
 * draws (via the shared art-core `artShapes`), so the bytes pinned to
 * IPFS/Arweave/Irys at mint time match what the collector sees pixel-for-pixel.
 */
import type { Genre } from "@/lib/types";
import { artShapes, type Prim } from "./art-core";

const n = (v: number) => Math.round(v * 100) / 100;
const op = (v: number) => Math.round(v * 1000) / 1000;

function serialize(prim: Prim): string {
  switch (prim.t) {
    case "rect":
      return `<rect x="${n(prim.x)}" y="${n(prim.y)}" width="${n(prim.w)}" height="${n(prim.h)}" fill="${prim.fill}" opacity="${op(prim.opacity)}"/>`;
    case "line":
      return `<line x1="${n(prim.x1)}" y1="${n(prim.y1)}" x2="${n(prim.x2)}" y2="${n(prim.y2)}" stroke="${prim.stroke}" stroke-width="${n(prim.sw)}" opacity="${op(prim.opacity)}"/>`;
    case "circle":
      return `<circle cx="${n(prim.cx)}" cy="${n(prim.cy)}" r="${n(prim.r)}" fill="${prim.fill}" opacity="${op(prim.opacity)}"/>`;
    case "ellipse":
      return `<ellipse cx="${n(prim.cx)}" cy="${n(prim.cy)}" rx="${n(prim.rx)}" ry="${n(prim.ry)}" fill="${prim.fill ?? "none"}"${prim.stroke ? ` stroke="${prim.stroke}" stroke-width="${n(prim.sw ?? 1)}"` : ""} opacity="${op(prim.opacity)}"/>`;
    case "poly":
      return `<polygon points="${prim.pts.map(([x, y]) => `${n(x)},${n(y)}`).join(" ")}" fill="${prim.fill ?? "none"}"${prim.stroke ? ` stroke="${prim.stroke}" stroke-width="${n(prim.sw ?? 1)}"` : ""} opacity="${op(prim.opacity)}"/>`;
    case "path":
      return `<path d="${prim.d}" fill="${prim.fill ?? "none"}"${prim.stroke ? ` stroke="${prim.stroke}" stroke-width="${n(prim.sw ?? 1)}"` : ""} opacity="${op(prim.opacity)}"/>`;
  }
}

export function artSvgString(seed: string, genre: Genre, size = 800): string {
  const { W, H, bg, bg2, prims } = artShapes(seed, genre, size);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`,
    `<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">`,
    `<stop offset="0%" stop-color="${bg}"/><stop offset="100%" stop-color="${bg2}"/>`,
    `</linearGradient></defs>`,
    `<rect width="${W}" height="${H}" fill="url(#bg)"/>`,
    prims.map(serialize).join(""),
    `<rect width="${W}" height="${H}" fill="black" opacity="0.04"/>`,
    `</svg>`,
  ].join("");
}
