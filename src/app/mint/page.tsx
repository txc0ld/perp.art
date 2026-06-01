import type { Metadata } from "next";
import { SHARD_OPTIONS, GENRES } from "@/lib/catalog-constants";
import { MintWizard } from "@/components/mint/MintWizard";

export const metadata: Metadata = {
  title: "Mint · Perpetual",
  description:
    "Commit a work to permanence. A calm, guided flow that writes provenance onchain and replicates across independent permanent backends, so the work endures even if the operator does not.",
};

/**
 * Mint flow (design prompt §4.4, PRD §10.3).
 * Thin server component: passes the plain shard/genre constants down to the
 * interactive client wizard. All wizard state + the on-chain mint is client-side;
 * on an unsupported network the wizard switches the wallet to a supported testnet
 * rather than simulating.
 */
export default function MintPage() {
  return (
    <div className="py-10 sm:py-12">
      <MintWizard shardOptions={SHARD_OPTIONS} genres={GENRES} />
    </div>
  );
}
