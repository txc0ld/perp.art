/**
 * art-core - the single source of truth for the deterministic generative
 * artwork. Both the React renderer (GenerativeArt) and the SVG-string
 * serializer (art-svg, used to pin the real bytes) consume `artShapes`, so the
 * on-screen art and the stored art can never drift apart.
 *
 * artShapes(seed, genre) -> a flat list of primitives + background. The same
 * (seed, genre) always yields the same primitives.
 */
import type { Genre } from "@/lib/types";
import { seededRandom } from "@/lib/utils";

export const PALETTES: Record<Genre, string[]> = {
  Generative: ["#E8D8A0", "#C9A24B", "#8C5A2B", "#3A2A18", "#F4ECD2"],
  Glitch: ["#9EE6B4", "#5B8CFF", "#FF5B8C", "#1A1A2E", "#E0E0FF"],
  Photography: ["#D9C9A8", "#7A6A52", "#2A241C", "#C0B49A", "#F0E8D8"],
  Pixel: ["#FDA4AF", "#7DD3FC", "#FDE68A", "#A7F3D0", "#18181B"],
  AI: ["#C4B5FD", "#67E8F9", "#F0ABFC", "#1E1B4B", "#E9D5FF"],
  Abstract: ["#E8D8A0", "#A1A1AA", "#52525B", "#F4F4F5", "#27272A"],
  "3D": ["#9EE6B4", "#A1A1AA", "#E8D8A0", "#27272A", "#F4F4F5"],
  Illustration: ["#F2B5A0", "#E07A5F", "#81B29A", "#1B1B2A", "#F4E9D8"],
  Vector: ["#FF6B6B", "#4ECDC4", "#FFE66D", "#16161E", "#F7FFF7"],
  Fractal: ["#5EEAD4", "#818CF8", "#F472B6", "#0F172A", "#E0E7FF"],
  Collage: ["#D4A373", "#A3B18A", "#9C6644", "#2B2118", "#EDE0D4"],
  Motion: ["#FBBF24", "#FB7185", "#38BDF8", "#0B0F1A", "#F1F5F9"],
  Voxel: ["#6EE7B7", "#FCD34D", "#93C5FD", "#1F2430", "#F9FAFB"],
  Audio: ["#34D399", "#22D3EE", "#A78BFA", "#101418", "#ECFEFF"],
  PFP: ["#FBCFE8", "#C4B5FD", "#FCD34D", "#211A3E", "#F5F3FF"],
};

export type Prim =
  | { t: "rect"; x: number; y: number; w: number; h: number; fill: string; opacity: number }
  | { t: "line"; x1: number; y1: number; x2: number; y2: number; stroke: string; sw: number; opacity: number }
  | { t: "circle"; cx: number; cy: number; r: number; fill: string; opacity: number }
  | { t: "ellipse"; cx: number; cy: number; rx: number; ry: number; fill?: string; stroke?: string; sw?: number; opacity: number }
  | { t: "poly"; pts: [number, number][]; fill?: string; stroke?: string; sw?: number; opacity: number }
  | { t: "path"; d: string; fill?: string; stroke?: string; sw?: number; opacity: number };

export interface ArtScene {
  W: number;
  H: number;
  bg: string;
  bg2: string;
  prims: Prim[];
}

/** Rotate point (px,py) around (cx,cy) by `ang` radians. */
function rot(px: number, py: number, cx: number, cy: number, ang: number): [number, number] {
  const c = Math.cos(ang), s = Math.sin(ang);
  return [cx + (px - cx) * c - (py - cy) * s, cy + (px - cx) * s + (py - cy) * c];
}

export function artShapes(seed: string, genre: Genre, size = 800): ArtScene {
  const r = seededRandom("art:" + seed);
  const palette = PALETTES[genre] ?? PALETTES.Abstract;
  const pick = () => palette[Math.floor(r() * palette.length)];
  const W = size, H = size;
  const bg = palette[3];
  const bg2 = palette[Math.floor(r() * palette.length)];
  const p: Prim[] = [];

  if (genre === "Generative" || genre === "Abstract" || genre === "3D") {
    // Sedimentary strata - horizontal bands with eroded edges.
    const bands = 7 + Math.floor(r() * 8);
    let y = 0;
    for (let i = 0; i < bands; i++) {
      const h = (H / bands) * (0.5 + r());
      const skew = (r() - 0.5) * 40;
      p.push({ t: "path", d: `M0 ${y} L${W} ${y + skew} L${W} ${y + h + skew} L0 ${y + h} Z`, fill: pick(), opacity: 0.55 + r() * 0.45 });
      y += h * 0.7;
    }
    for (let i = 0; i < 18; i++) {
      const x = r() * W;
      p.push({ t: "line", x1: x, y1: 0, x2: x + (r() - 0.5) * 60, y2: H, stroke: palette[0], sw: 0.5, opacity: 0.15 });
    }
  } else if (genre === "Glitch") {
    const slices = 26 + Math.floor(r() * 20);
    for (let i = 0; i < slices; i++) {
      p.push({ t: "rect", x: (r() - 0.5) * 80, y: r() * H, w: W, h: 2 + r() * 26, fill: pick(), opacity: 0.5 + r() * 0.5 });
    }
    for (let i = 0; i < 6; i++) {
      p.push({ t: "rect", x: r() * W, y: r() * H, w: 20 + r() * 120, h: 6 + r() * 20, fill: palette[2], opacity: 0.6 });
    }
  } else if (genre === "Photography") {
    for (let i = 0; i < 5; i++) {
      p.push({ t: "circle", cx: r() * W, cy: r() * H, r: 80 + r() * 220, fill: pick(), opacity: 0.18 + r() * 0.2 });
    }
    for (let i = 0; i < 4; i++) {
      p.push({ t: "rect", x: 0, y: r() * H, w: W, h: 1 + r() * 3, fill: palette[4], opacity: 0.5 });
    }
  } else if (genre === "Pixel") {
    const cells = 16, cs = W / cells;
    for (let gx = 0; gx < cells; gx++) {
      for (let gy = 0; gy < cells; gy++) {
        if (r() > 0.62) p.push({ t: "rect", x: gx * cs, y: gy * cs, w: cs, h: cs, fill: pick(), opacity: 0.85 });
      }
    }
  } else if (genre === "AI") {
    for (let i = 0; i < 60; i++) {
      let x = r() * W, y = r() * H;
      let d = `M${x} ${y}`;
      for (let s = 0; s < 6; s++) {
        x += (r() - 0.5) * 90;
        y += 20 + r() * 60;
        d += ` Q ${x + (r() - 0.5) * 60} ${y - 30} ${x} ${y}`;
      }
      p.push({ t: "path", d, stroke: pick(), sw: 0.6 + r() * 1.6, opacity: 0.25 + r() * 0.4 });
    }
  } else if (genre === "Illustration") {
    // Painterly: layered translucent ellipse washes + a few drawn contours.
    const blobs = 7 + Math.floor(r() * 5);
    for (let i = 0; i < blobs; i++) {
      const cx = r() * W, cy = r() * H, rad = 100 + r() * 230;
      p.push({ t: "ellipse", cx, cy, rx: rad, ry: rad * (0.55 + r() * 0.7), fill: pick(), opacity: 0.22 + r() * 0.3 });
    }
    for (let i = 0; i < 9; i++) {
      let x = r() * W, y = r() * H;
      let d = `M${x} ${y}`;
      for (let s = 0; s < 4; s++) {
        x += (r() - 0.5) * 220;
        y += (r() - 0.5) * 220;
        d += ` Q ${x + (r() - 0.5) * 120} ${y + (r() - 0.5) * 120} ${x} ${y}`;
      }
      p.push({ t: "path", d, stroke: palette[3], sw: 1.2 + r() * 2.2, opacity: 0.3 + r() * 0.3 });
    }
  } else if (genre === "Vector") {
    // Flat, hard-edged geometry: bold triangles + discs, high opacity.
    const shapes = 9 + Math.floor(r() * 6);
    for (let i = 0; i < shapes; i++) {
      if (r() > 0.5) {
        const cx = r() * W, cy = r() * H, s = 90 + r() * 230, a = r() * Math.PI * 2;
        const pts: [number, number][] = [0, 1, 2].map((k) => {
          const ang = a + (k * 2 * Math.PI) / 3;
          return [cx + Math.cos(ang) * s, cy + Math.sin(ang) * s];
        });
        p.push({ t: "poly", pts, fill: pick(), opacity: 0.85 });
      } else {
        p.push({ t: "circle", cx: r() * W, cy: r() * H, r: 40 + r() * 150, fill: pick(), opacity: 0.85 });
      }
    }
  } else if (genre === "Fractal") {
    // Recursive quad subdivision - self-similar nested squares.
    const subdivide = (x: number, y: number, s: number, depth: number) => {
      if (depth <= 0 || (depth < 4 && r() > 0.62)) {
        p.push({ t: "rect", x, y, w: s, h: s, fill: pick(), opacity: 0.3 + r() * 0.55 });
        if (r() > 0.5) p.push({ t: "circle", cx: x + s / 2, cy: y + s / 2, r: (s / 2) * (0.3 + r() * 0.5), fill: pick(), opacity: 0.4 + r() * 0.4 });
        return;
      }
      const h = s / 2;
      subdivide(x, y, h, depth - 1);
      subdivide(x + h, y, h, depth - 1);
      subdivide(x, y + h, h, depth - 1);
      subdivide(x + h, y + h, h, depth - 1);
    };
    subdivide(0, 0, W, 5);
  } else if (genre === "Collage") {
    // Torn-paper fragments: rotated rectangles with thin frames.
    const frags = 12 + Math.floor(r() * 8);
    for (let i = 0; i < frags; i++) {
      const cx = r() * W, cy = r() * H, w = 80 + r() * 260, h = 60 + r() * 220, ang = (r() - 0.5) * 1.1;
      const corners: [number, number][] = [
        [cx - w / 2, cy - h / 2], [cx + w / 2, cy - h / 2], [cx + w / 2, cy + h / 2], [cx - w / 2, cy + h / 2],
      ].map(([px, py]) => rot(px, py, cx, cy, ang));
      p.push({ t: "poly", pts: corners, fill: pick(), opacity: 0.55 + r() * 0.35 });
      p.push({ t: "poly", pts: corners, stroke: palette[4], sw: 1.5, opacity: 0.4 });
    }
  } else if (genre === "Motion") {
    // Kinetic: concentric rings radiating from a focus + blur streaks.
    const cx = W * (0.3 + r() * 0.4), cy = H * (0.3 + r() * 0.4);
    const rings = 14 + Math.floor(r() * 10);
    for (let i = 0; i < rings; i++) {
      const rad = (i + 1) * (W / (rings * 1.4));
      p.push({ t: "ellipse", cx, cy, rx: rad, ry: rad * (0.7 + r() * 0.5), stroke: pick(), sw: 1 + r() * 3, opacity: 0.5 - (i / rings) * 0.35 });
    }
    for (let i = 0; i < 10; i++) {
      const y = r() * H;
      p.push({ t: "rect", x: 0, y, w: W, h: 1 + r() * 5, fill: pick(), opacity: 0.25 + r() * 0.35 });
    }
  } else if (genre === "Voxel") {
    // Scattered isometric cubes (three shaded faces each).
    const cubes = 16 + Math.floor(r() * 12);
    for (let i = 0; i < cubes; i++) {
      const cx = r() * W, cy = H * 0.15 + r() * H * 0.7, s = 26 + r() * 46, vh = s;
      const top: [number, number][] = [[cx, cy - s / 2], [cx + s, cy], [cx, cy + s / 2], [cx - s, cy]];
      const left: [number, number][] = [[cx - s, cy], [cx, cy + s / 2], [cx, cy + s / 2 + vh], [cx - s, cy + vh]];
      const right: [number, number][] = [[cx + s, cy], [cx, cy + s / 2], [cx, cy + s / 2 + vh], [cx + s, cy + vh]];
      p.push({ t: "poly", pts: top, fill: palette[0], opacity: 0.95 });
      p.push({ t: "poly", pts: left, fill: palette[3], opacity: 0.9 });
      p.push({ t: "poly", pts: right, fill: palette[2], opacity: 0.85 });
    }
  } else if (genre === "Audio") {
    // Waveform / spectrum bars mirrored about the centre line.
    const bars = 48 + Math.floor(r() * 32);
    const bw = W / bars, mid = H / 2;
    for (let i = 0; i < bars; i++) {
      const amp = (0.06 + Math.abs(Math.sin(i * (0.3 + r() * 0.5)) ) * (0.4 + r() * 0.5)) * H * 0.5;
      p.push({ t: "rect", x: i * bw, y: mid - amp, w: bw * 0.7, h: amp * 2, fill: pick(), opacity: 0.55 + r() * 0.4 });
    }
    p.push({ t: "rect", x: 0, y: mid - 0.75, w: W, h: 1.5, fill: palette[4], opacity: 0.5 });
  } else if (genre === "PFP") {
    // Centred generative avatar: framed disc, head, accessory band, face.
    const cx = W / 2, cy = H * 0.54;
    p.push({ t: "circle", cx, cy: cy - H * 0.02, r: W * 0.4, fill: palette[1], opacity: 0.5 });
    const headR = W * 0.27;
    p.push({ t: "circle", cx, cy, r: headR, fill: palette[0], opacity: 0.96 });
    // Accessory band across the brow (hat / visor).
    const bandY = cy - headR * 0.55, bandH = headR * (0.28 + r() * 0.3);
    p.push({ t: "rect", x: cx - headR * 0.96, y: bandY, w: headR * 1.92, h: bandH, fill: palette[2], opacity: 0.92 });
    // Eyes.
    const eyeY = cy - headR * 0.05, eyeDX = headR * 0.42, eyeR = headR * (0.13 + r() * 0.07);
    for (const dx of [-eyeDX, eyeDX]) {
      p.push({ t: "circle", cx: cx + dx, cy: eyeY, r: eyeR, fill: palette[4], opacity: 1 });
      p.push({ t: "circle", cx: cx + dx + eyeR * 0.2, cy: eyeY, r: eyeR * 0.5, fill: palette[3], opacity: 1 });
    }
    // Mouth.
    const mouthW = headR * (0.4 + r() * 0.4);
    p.push({ t: "rect", x: cx - mouthW / 2, y: cy + headR * 0.42, w: mouthW, h: headR * 0.12, fill: palette[3], opacity: 0.85 });
    // Shoulders rising from the bottom edge.
    p.push({ t: "circle", cx, cy: H + W * 0.06, r: W * 0.34, fill: palette[2], opacity: 0.9 });
    // A few orbiting trait dots for variety.
    for (let i = 0; i < 5; i++) {
      const a = r() * Math.PI * 2, rad = headR * (1.25 + r() * 0.4);
      p.push({ t: "circle", cx: cx + Math.cos(a) * rad, cy: cy + Math.sin(a) * rad, r: 4 + r() * 10, fill: pick(), opacity: 0.7 });
    }
  }

  return { W, H, bg, bg2, prims: p };
}
