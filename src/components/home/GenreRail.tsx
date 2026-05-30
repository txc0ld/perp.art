/**
 * GenreRail - one horizontally-rhythmic rail per genre (design prompt §4.1).
 * Heading + "View all", then a scrollable row of ArtTiles. Clean grid feel on
 * desktop, snap-scroll on overflow for small screens.
 */
import { Section } from "@/components/ui";
import { ArtTile } from "@/components/art/ArtTile";
import { Reveal } from "./Reveal";
import { SectionHeader } from "./SectionHeader";
import type { Genre, Token } from "@/lib/types";

const GENRE_NOTE: Record<Genre, string> = {
  Generative: "Computed once, fixed forever - systems that erode and re-form.",
  Glitch: "Corruption as geology. The signal degraded; the record is permanent.",
  Photography: "Long exposures of light that has already left.",
  Pixel: "Hand-placed pixels. Patience as a medium.",
  AI: "Latent-space cartography, anchored to immutable storage.",
  Abstract: "Color fields meant to outlast the walls they hang on.",
  "3D": "Volumetric form, rendered for permanence.",
};

export function GenreRail({ genre, tokens }: { genre: Genre; tokens: Token[] }) {
  if (tokens.length === 0) return null;
  const row = tokens.slice(0, 5);

  return (
    <Section className="py-8 sm:py-10 lg:py-12">
      <Reveal>
        <SectionHeader
          eyebrow={genre}
          title={genre}
          note={GENRE_NOTE[genre]}
          href={`/explore?genre=${encodeURIComponent(genre)}`}
        />
      </Reveal>

      <Reveal delay={80}>
        <div className="mt-7 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] sm:gap-5 [&::-webkit-scrollbar]:hidden">
          {row.map((token) => (
            <div
              key={token.id}
              className="w-[58%] shrink-0 snap-start sm:w-[40%] md:w-[30%] lg:w-[calc((100%-4*1.25rem)/5)]"
            >
              <ArtTile token={token} />
            </div>
          ))}
        </div>
      </Reveal>
    </Section>
  );
}

export default GenreRail;
