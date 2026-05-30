import type { Metadata } from "next";
import { AmbientField } from "@/components/visual/AmbientField";
import { ConnectCard } from "@/components/auth/ConnectCard";

export const metadata: Metadata = {
  title: "Connect - Perpetual",
  description:
    "Connect a wallet to Perpetual. Fully non-custodial - you keep the keys, always.",
};

/**
 * Wallet connect / auth (design prompt §4.6).
 * The Nexus login aesthetic applied most directly: a focused, centered, engineered
 * access flow on the near-black canvas with ambient depth sitting behind the card.
 */
export default function ConnectPage() {
  return (
    <div className="relative flex min-h-[calc(100vh-160px)] items-center justify-center overflow-hidden px-6 py-16">
      {/* Ambient depth - strictly behind the card */}
      <AmbientField className="-z-10" />

      {/* Faint engineered lattice line over the field, still behind content */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage: "radial-gradient(70% 60% at 50% 45%, black, transparent)",
          WebkitMaskImage: "radial-gradient(70% 60% at 50% 45%, black, transparent)",
        }}
      />

      <div className="animate-fade relative w-full max-w-[440px]">
        <ConnectCard />
      </div>
    </div>
  );
}
