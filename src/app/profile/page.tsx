import type { Metadata } from "next";
import { Section } from "@/components/ui";
import { ProfileTabs } from "@/components/profile/ProfileTabs";

export const metadata: Metadata = {
  title: "Profile - Perpetual",
  description:
    "Your collection, your creations, your activity, and the sovereign contracts you own outright. Non-custodial throughout.",
};

/**
 * Profile (design prompt §4.5).
 * The profile reflects the CONNECTED wallet. The connected address is only known
 * client-side, and the live catalog is server-only, so this thin server shell
 * just renders the client ProfileTabs — which resolves the connected wallet and
 * fetches every section's live data through the /api endpoints. No mock identity
 * or holdings: not connected → a clean connect prompt; connected → live data
 * with honest empty states.
 */
export default function ProfilePage() {
  return (
    <Section>
      <ProfileTabs />
    </Section>
  );
}
