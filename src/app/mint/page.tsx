import type { Metadata } from "next";
import { SHARD_OPTIONS, GENRES } from "@/lib/mock-data";
import { MintWizard } from "@/components/mint/MintWizard";

export const metadata: Metadata = {
  title: "Mint - Perpetual",
  description:
    "Commit your work to permanence. A calm, guided mint flow that writes provenance onchain and replicates across independent permanent backends.",
};

/**
 * Mint flow (design prompt §4.4, PRD §10.3).
 * Thin server component: passes the plain shard/genre constants down to the
 * interactive client wizard. All wizard state + simulated minting is client-side.
 */
export default function MintPage() {
  return (
    <div className="py-10 sm:py-12">
      <MintWizard shardOptions={SHARD_OPTIONS} genres={GENRES} />
    </div>
  );
}
