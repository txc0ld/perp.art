/**
 * GenerativeArt - deterministic, SSR-safe SVG artwork keyed by (seed, genre).
 * There are no external image assets; every token/collection renders real,
 * reproducible generative art so the marketplace looks alive offline.
 *
 * Shape generation lives in art-core (`artShapes`), shared with the SVG-string
 * serializer that pins the real bytes - so the displayed art and the stored
 * art are guaranteed identical.
 */
import * as React from "react";
import type { Genre } from "@/lib/types";
import { artShapes, type Prim } from "./art-core";

interface Props {
  seed: string;
  genre: Genre;
  className?: string;
  /** rough render resolution; SVG scales fluidly regardless. */
  size?: number;
}

function renderPrim(prim: Prim, key: number): React.ReactNode {
  switch (prim.t) {
    case "rect":
      return <rect key={key} x={prim.x} y={prim.y} width={prim.w} height={prim.h} fill={prim.fill} opacity={prim.opacity} />;
    case "line":
      return <line key={key} x1={prim.x1} y1={prim.y1} x2={prim.x2} y2={prim.y2} stroke={prim.stroke} strokeWidth={prim.sw} opacity={prim.opacity} />;
    case "circle":
      return <circle key={key} cx={prim.cx} cy={prim.cy} r={prim.r} fill={prim.fill} opacity={prim.opacity} />;
    case "ellipse":
      return <ellipse key={key} cx={prim.cx} cy={prim.cy} rx={prim.rx} ry={prim.ry} fill={prim.fill ?? "none"} stroke={prim.stroke} strokeWidth={prim.sw} opacity={prim.opacity} />;
    case "poly":
      return <polygon key={key} points={prim.pts.map(([x, y]) => `${x},${y}`).join(" ")} fill={prim.fill ?? "none"} stroke={prim.stroke} strokeWidth={prim.sw} opacity={prim.opacity} />;
    case "path":
      return <path key={key} d={prim.d} fill={prim.fill ?? "none"} stroke={prim.stroke} strokeWidth={prim.sw} opacity={prim.opacity} />;
  }
}

export function GenerativeArt({ seed, genre, className, size = 600 }: Props) {
  const { W, H, bg, bg2, prims } = artShapes(seed, genre, size);
  const id = React.useId().replace(/:/g, "");

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
        {prims.map(renderPrim)}
        {/* subtle grain vignette to read as material, not flat */}
        <rect x="0" y="0" width={W} height={H} fill="black" opacity="0.04" />
      </g>
    </svg>
  );
}
