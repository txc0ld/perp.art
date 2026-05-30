/**
 * FeaturedRail - community-curated featured works (design prompt §4.1).
 * Responsive grid of ArtTiles with a staggered scroll-triggered entrance.
 */
import { Section } from "@/components/ui";
import { ArtTile } from "@/components/art/ArtTile";
import { Reveal } from "./Reveal";
import { SectionHeader } from "./SectionHeader";
import type { Token } from "@/lib/types";

export function FeaturedRail({ tokens }: { tokens: Token[] }) {
  return (
    <Section id="featured">
      <Reveal>
        <SectionHeader
          eyebrow="Curated by community vote"
          title="Featured works"
          note="The most-voted pieces this cycle. Curation is community-driven - collectors surface what deserves to be seen, not an algorithm."
          href="/explore"
          hrefLabel="Browse all"
        />
      </Reveal>

      <div className="mt-10 grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
        {tokens.map((token, i) => (
          <Reveal key={token.id} delay={i * 70}>
            <ArtTile token={token} priority={i < 4} />
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

export default FeaturedRail;
