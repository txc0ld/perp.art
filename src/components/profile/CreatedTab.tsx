import type { Token } from "@/lib/types";
import { ArtTile } from "@/components/art/ArtTile";
import { MonoLabel } from "@/components/ui";
import { EmptyState } from "./OwnedTab";

/**
 * Created tab (design prompt §4.5) - works the user authored. In the demo dataset
 * the connected user is treated as the first artist, so this shows their minted works.
 */
export function CreatedTab({ tokens }: { tokens: Token[] }) {
  if (tokens.length === 0) {
    return (
      <EmptyState
        title="Nothing minted yet"
        body="Works you create will live here. Mint to a sovereign Forever Library contract you own outright."
        cta={{ href: "/mint", label: "Mint a work" }}
      />
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-baseline sm:justify-between">
        <MonoLabel className="text-foreground">
          {tokens.length} {tokens.length === 1 ? "work" : "works"} created
        </MonoLabel>
        <p className="max-w-md text-xs leading-relaxed text-muted">
          Every work you mint is hash-anchored onchain at mint and kept across independent permanence shards.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 lg:gap-5">
        {tokens.map((t, i) => (
          <div key={t.id} className="animate-rise" style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}>
            <ArtTile token={t} />
          </div>
        ))}
      </div>
    </div>
  );
}
