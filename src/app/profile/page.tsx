import type { Metadata } from "next";
import {
  getAllTokens,
  getArtists,
  getTokensByArtist,
  getCollections,
  CURRENT_USER,
} from "@/lib/mock-data";
import { Section } from "@/components/ui";
import { ProfileTabs } from "@/components/profile/ProfileTabs";

export const metadata: Metadata = {
  title: "Profile - Perpetual",
  description:
    "Your collection, your creations, your activity, and the sovereign contracts you own outright. Non-custodial throughout.",
};

/**
 * Profile (design prompt §4.5).
 * Server component: does all data access and hands plain data to the client
 * ProfileTabs shell, which resolves owned works against live wallet state.
 * The first artist stands in as the connected user's "creator" identity in the
 * demo dataset (CURRENT_USER is a collector, not an artist).
 */
export default function ProfilePage() {
  const allTokens = getAllTokens();
  const creator = getArtists()[0];
  const creatorTokens = getTokensByArtist(creator.handle);
  const creatorCollections = getCollections().filter(
    (c) => c.artistHandle === creator.handle,
  );
  // The creator's primary collection genre keys the banner + avatar identicon.
  const bannerGenre = creatorCollections[0]?.genre ?? "Abstract";

  return (
    <Section>
      <ProfileTabs
        allTokens={allTokens}
        previewAddress={CURRENT_USER.address}
        creator={creator}
        creatorTokens={creatorTokens}
        creatorCollections={creatorCollections}
        bannerGenre={bannerGenre}
      />
    </Section>
  );
}
