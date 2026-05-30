import type { Token } from "@/lib/types";
import { ArtTile } from "@/components/art/ArtTile";
import type { Density } from "./filters";

/**
 * Art-forward responsive grid of ArtTiles on the near-black canvas.
 * Density toggle switches between fewer (comfortable) and more (compact) columns,
 * OpenSea-style. Staggered rise on mount (capped so long lists don't ripple forever).
 */
export function ExploreGrid({ tokens, density }: { tokens: Token[]; density: Density }) {
  const cols =
    density === "compact"
      ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 2xl:grid-cols-6 gap-3 lg:gap-4"
      : "grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-4 lg:gap-5";

  return (
    <div className={`grid ${cols}`}>
      {tokens.map((t, i) => (
        <div
          key={t.id}
          className="animate-rise"
          style={{ animationDelay: `${Math.min(i, 11) * 40}ms` }}
        >
          <ArtTile token={t} priority={i < 4} />
        </div>
      ))}
    </div>
  );
}
