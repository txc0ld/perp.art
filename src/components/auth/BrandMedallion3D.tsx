"use client";

import { Tilt3D } from "@/components/visual/Tilt3D";
import { BrandMark } from "@/components/chrome/Brand";

/**
 * BrandMedallion3D - a luxurious centered brand medallion for the access flow.
 * The "fixed point" mark sits in a perspective container, floats gently
 * (animate-float), tilts toward the pointer (Tilt3D), and rests over a soft
 * accent glow. It is a calm, premium accent above the AmbientField, never loud.
 * All motion is reduced-motion + coarse-pointer aware via the shared primitives.
 */
export function BrandMedallion3D() {
  return (
    <div className="perspective-1000 relative mx-auto mb-7 flex h-24 w-24 items-center justify-center">
      {/* Soft accent glow pooled behind the medallion */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 scale-150 opacity-80"
        style={{
          background:
            "radial-gradient(50% 50% at 50% 50%, rgba(254,147,237,0.18), transparent 70%)",
        }}
      />
      <div className="animate-float">
        <Tilt3D max={14} lift={18} glare scale={1.04} className="rounded-full">
          <span className="flex h-24 w-24 items-center justify-center rounded-full border border-border-bright/70 bg-surface/70 text-foreground shadow-[0_24px_60px_-24px_rgba(0,0,0,0.95)] backdrop-blur-md">
            <BrandMark size={44} strokeWidth={3.4} />
          </span>
        </Tilt3D>
      </div>
    </div>
  );
}

export default BrandMedallion3D;
