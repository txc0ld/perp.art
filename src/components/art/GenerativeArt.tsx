/**
 * GenerativeArt - deterministic, SSR-safe SVG artwork keyed by (seed, genre).
 * There are no external image assets; every token/collection renders real,
 * reproducible generative art so the marketplace looks alive offline.
 *
 * The art is always the brightest, most saturated thing on screen (design prompt §2);
 * the UI is the quiet near-black frame around it.
 */
import * as React from "react";
import type { Genre } from "@/lib/types";
import { seededRandom } from "@/lib/utils";

interface Props {
  seed: string;
  genre: Genre;
  className?: string;
  /** rough render resolution; SVG scales fluidly regardless. */
  size?: number;
}

const PALETTES: Record<Genre, string[]> = {
  Generative: ["#E8D8A0", "#C9A24B", "#8C5A2B", "#3A2A18", "#F4ECD2"],
  Glitch: ["#9EE6B4", "#5B8CFF", "#FF5B8C", "#1A1A2E", "#E0E0FF"],
  Photography: ["#D9C9A8", "#7A6A52", "#2A241C", "#C0B49A", "#F0E8D8"],
  Pixel: ["#FDA4AF", "#7DD3FC", "#FDE68A", "#A7F3D0", "#18181B"],
  AI: ["#C4B5FD", "#67E8F9", "#F0ABFC", "#1E1B4B", "#E9D5FF"],
  Abstract: ["#E8D8A0", "#A1A1AA", "#52525B", "#F4F4F5", "#27272A"],
  "3D": ["#9EE6B4", "#A1A1AA", "#E8D8A0", "#27272A", "#F4F4F5"],
};

export function GenerativeArt({ seed, genre, className, size = 600 }: Props) {
  const r = seededRandom("art:" + seed);
  const palette = PALETTES[genre] ?? PALETTES.Abstract;
  const pick = () => palette[Math.floor(r() * palette.length)];
  const W = size, H = size;
  const id = React.useId().replace(/:/g, "");

  // Background field
  const bg = palette[3];
  const bg2 = palette[Math.floor(r() * palette.length)];

  const shapes: React.ReactNode[] = [];

  if (genre === "Generative" || genre === "Abstract" || genre === "3D") {
    // Sedimentary strata - horizontal bands with eroded edges
    const bands = 7 + Math.floor(r() * 8);
    let y = 0;
    for (let i = 0; i < bands; i++) {
      const h = (H / bands) * (0.5 + r());
      const c = pick();
      const skew = (r() - 0.5) * 40;
      shapes.push(
        <path key={`b${i}`} d={`M0 ${y} L${W} ${y + skew} L${W} ${y + h + skew} L0 ${y + h} Z`} fill={c} opacity={0.55 + r() * 0.45} />,
      );
      y += h * 0.7;
    }
    // Scattered fine lines (engineered lattice)
    for (let i = 0; i < 18; i++) {
      const x = r() * W;
      shapes.push(<line key={`l${i}`} x1={x} y1={0} x2={x + (r() - 0.5) * 60} y2={H} stroke={palette[0]} strokeWidth={0.5} opacity={0.15} />);
    }
  } else if (genre === "Glitch") {
    // Horizontal data-corruption slices
    const slices = 26 + Math.floor(r() * 20);
    for (let i = 0; i < slices; i++) {
      const y = r() * H;
      const h = 2 + r() * 26;
      const x = (r() - 0.5) * 80;
      shapes.push(<rect key={`s${i}`} x={x} y={y} width={W} height={h} fill={pick()} opacity={0.5 + r() * 0.5} />);
    }
    // RGB shift blocks
    for (let i = 0; i < 6; i++) {
      shapes.push(<rect key={`g${i}`} x={r() * W} y={r() * H} width={20 + r() * 120} height={6 + r() * 20} fill={palette[2]} opacity={0.6} />);
    }
  } else if (genre === "Photography") {
    // Soft long-exposure gradient orbs
    for (let i = 0; i < 5; i++) {
      const cx = r() * W, cy = r() * H, rad = 80 + r() * 220;
      shapes.push(<circle key={`o${i}`} cx={cx} cy={cy} r={rad} fill={pick()} opacity={0.18 + r() * 0.2} />);
    }
    // Light streaks
    for (let i = 0; i < 4; i++) {
      const y = r() * H;
      shapes.push(<rect key={`st${i}`} x={0} y={y} width={W} height={1 + r() * 3} fill={palette[4]} opacity={0.5} />);
    }
  } else if (genre === "Pixel") {
    // Hand-placed grid
    const cells = 16;
    const cs = W / cells;
    for (let gx = 0; gx < cells; gx++) {
      for (let gy = 0; gy < cells; gy++) {
        if (r() > 0.62) {
          shapes.push(<rect key={`p${gx}-${gy}`} x={gx * cs} y={gy * cs} width={cs} height={cs} fill={pick()} opacity={0.85} />);
        }
      }
    }
  } else if (genre === "AI") {
    // Latent-space flow field
    const lines = 60;
    for (let i = 0; i < lines; i++) {
      let x = r() * W, y = r() * H;
      let d = `M${x} ${y}`;
      for (let s = 0; s < 6; s++) {
        x += (r() - 0.5) * 90;
        y += 20 + r() * 60;
        d += ` Q ${x + (r() - 0.5) * 60} ${y - 30} ${x} ${y}`;
      }
      shapes.push(<path key={`f${i}`} d={d} fill="none" stroke={pick()} strokeWidth={0.6 + r() * 1.6} opacity={0.25 + r() * 0.4} />);
    }
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={className}
      role="img"
      aria-label={`${genre} artwork`}
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <linearGradient id={`bg-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={bg} />
          <stop offset="100%" stopColor={bg2} />
        </linearGradient>
        <clipPath id={`clip-${id}`}>
          <rect x="0" y="0" width={W} height={H} />
        </clipPath>
      </defs>
      <g clipPath={`url(#clip-${id})`}>
        <rect x="0" y="0" width={W} height={H} fill={`url(#bg-${id})`} />
        {shapes}
        {/* subtle grain vignette to read as material, not flat */}
        <rect x="0" y="0" width={W} height={H} fill="black" opacity="0.04" />
      </g>
    </svg>
  );
}
