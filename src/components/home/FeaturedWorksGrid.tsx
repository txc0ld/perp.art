/**
 * FeaturedWorksGrid - "Notable works" grid of ArtTiles (OpenSea uses 4-5
 * across on desktop). Responsive 2/3/4/5 column grid. Server component.
 */
import Link from "next/link";
import { ArtTile } from "@/components/art/ArtTile";
import { SectionHeader } from "@/components/ui";
import type { Token } from "@/lib/types";

export function FeaturedWorksGrid({ tokens }: { tokens: Token[] }) {
  return (
    <div>
      <SectionHeader
        eyebrow="Selected by the community"
        title="Notable works"
        action={
          <Link
            href="/explore"
            className="group inline-flex shrink-0 items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:text-accent"
          >
            Browse all
            <svg aria-hidden viewBox="0 0 16 16" className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" fill="none">
              <path d="M3 8h9M9 4.5L12.5 8 9 11.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {tokens.map((token, i) => (
          <ArtTile key={token.id} token={token} priority={i < 5} />
        ))}
      </div>
    </div>
  );
}

export default FeaturedWorksGrid;
