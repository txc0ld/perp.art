"use client";

/**
 * ShardStack3D - the signature permanence visual.
 *
 * The five storage shards rendered as translucent hairline planes stacked in
 * real CSS 3D: a perspective container holds a preserve-3d stage, and each
 * shard is a panel pushed back on translateZ (with a slight Y offset) so they
 * read as parallel, immutable copies layered in depth. Shard 0 (the STATE shard,
 * SSTORE2) is the foundation plane, emphasized with an accent hairline as the
 * consensus-guaranteed permanent backstop.
 *
 * On pointer move the whole stage tilts gently toward the cursor and the layers
 * separate slightly, revealing the depth. On idle it breathes with a very slow
 * float. Under prefers-reduced-motion or on coarse pointers it renders a clean,
 * static stacked state with no pointer handlers - calm, luxurious, on-brand.
 */
import * as React from "react";
import { StatusGlyph } from "@/components/ui";
import { cn } from "@/lib/utils";

type Plane = {
  index: number;
  name: string;
  backend: string;
  note: string;
  mandatory?: boolean;
};

const PLANES: Plane[] = [
  {
    index: 4,
    name: "Irys",
    backend: "datachain",
    note: "Separate failure domain",
  },
  {
    index: 3,
    name: "Arweave",
    backend: "permaweb",
    note: "Endowment funded, independent",
  },
  {
    index: 2,
    name: "IPFS",
    backend: "content-addressed",
    note: "CID = hash(content)",
  },
  {
    index: 1,
    name: "LOG",
    backend: "LogLedger",
    note: "Merkle-verified · retention-monitored",
  },
  {
    index: 0,
    name: "STATE",
    backend: "SSTORE2",
    note: "Consensus-guaranteed backstop",
    mandatory: true,
  },
];

// Depth spacing between planes, in px of translateZ. The foundation (Shard 0)
// sits deepest; redundant mirrors layer above it toward the viewer.
const Z_STEP = 64;
// Slight vertical offset per layer so the stack reads as a leaning deck.
const Y_STEP = 26;

export function ShardStack3D({ className }: { className?: string }) {
  const stageRef = React.useRef<HTMLDivElement>(null);
  const frame = React.useRef<number | null>(null);
  const [interactive, setInteractive] = React.useState(false);

  React.useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const fine = window.matchMedia?.("(pointer: fine)").matches;
    const t = setTimeout(() => setInteractive(!reduce && !!fine), 0);
    return () => clearTimeout(t);
  }, []);

  const apply = React.useCallback((rx: number, ry: number, spread: number) => {
    const stage = stageRef.current;
    if (!stage) return;
    stage.style.setProperty("--rx", `${rx}deg`);
    stage.style.setProperty("--ry", `${ry}deg`);
    stage.style.setProperty("--spread", spread.toFixed(3));
  }, []);

  function onMove(e: React.PointerEvent) {
    if (!interactive) return;
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    if (frame.current) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      // Small angles only, gallery not arcade.
      apply(-py * 12, px * 14, 1.32);
    });
  }

  function onLeave() {
    if (!interactive) return;
    if (frame.current) cancelAnimationFrame(frame.current);
    apply(0, 0, 1);
  }

  const count = PLANES.length;

  return (
    <div className={cn("relative mx-auto w-full max-w-md", className)}>
      {/* Ambient pink wash behind the stack - never competes with the planes. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-10 -z-10 opacity-60 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, rgba(254,147,237,0.10), transparent)",
        }}
      />

      {/* Perspective viewport */}
      <div
        className="perspective-1400 relative"
        style={{ height: 420 }}
        onPointerMove={onMove}
        onPointerLeave={onLeave}
      >
        {/* The 3D stage: tilts toward the cursor; idle float when interactive. */}
        <div
          ref={stageRef}
          className={cn(
            "preserve-3d absolute inset-0 grid place-items-center",
            interactive && "animate-float",
          )}
          style={
            {
              "--rx": "0deg",
              "--ry": "0deg",
              "--spread": "1",
              transform:
                "rotateX(var(--rx)) rotateY(var(--ry))",
              transition: "transform 0.6s var(--ease-spring)",
            } as React.CSSProperties
          }
        >
          {/* A fixed gentle base tilt so depth reads even at rest. */}
          <div
            className="preserve-3d relative h-[260px] w-[300px]"
            style={{ transform: "rotateX(54deg) rotateZ(-32deg)" }}
          >
            {PLANES.map((plane, i) => {
              // i runs top-of-list (Irys, highest) to bottom (Onchain, deepest).
              // Foundation should sit lowest; invert so Shard 0 is the base.
              const layer = count - 1 - i; // 0 = top mirror, count-1 = onchain base
              const isBackstop = plane.mandatory;
              return (
                <div
                  key={plane.index}
                  className={cn(
                    "preserve-3d backface-hidden absolute inset-0 rounded-[10px] border",
                    "flex flex-col justify-between p-4",
                    isBackstop
                      ? "border-accent/45 bg-surface/70 shadow-[0_40px_90px_-50px_rgba(254,147,237,0.55)]"
                      : "border-border bg-surface/35",
                  )}
                  style={{
                    transform: `translateZ(calc((${layer} - ${count - 1}) * ${Z_STEP}px * var(--spread))) translateY(calc((${layer} - ${count - 1}) * ${Y_STEP}px * var(--spread)))`,
                    transition: "transform 0.6s var(--ease-spring)",
                    backdropFilter: "blur(2px)",
                    WebkitBackdropFilter: "blur(2px)",
                  }}
                >
                  {/* Top label row */}
                  <div className="flex items-start justify-between gap-3">
                    <span
                      className={cn(
                        "font-mono text-[10px] font-semibold uppercase tracking-[0.14em]",
                        isBackstop ? "text-accent" : "text-muted",
                      )}
                    >
                      Shard {plane.index} {plane.name}
                    </span>
                    <span aria-hidden className="shrink-0">
                      <StatusGlyph status="verified" />
                    </span>
                  </div>

                  {/* Foundation gets the load-bearing caption; mirrors stay quiet. */}
                  <div>
                    <p
                      className={cn(
                        "font-mono text-[9px] uppercase tracking-[0.12em]",
                        isBackstop ? "text-accent/80" : "text-faint",
                      )}
                    >
                      {isBackstop ? "Consensus-guaranteed backstop" : plane.backend}
                    </p>
                    {isBackstop && (
                      <p className="mt-1 font-mono text-[8.5px] uppercase tracking-[0.1em] text-faint">
                        Survives as long as Ethereum
                      </p>
                    )}
                  </div>

                  {/* Hairline grain so the plane reads as a physical sheet. */}
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 rounded-[10px] opacity-[0.5]"
                    style={{
                      background: isBackstop
                        ? "linear-gradient(135deg, rgba(254,147,237,0.06), transparent 55%)"
                        : "linear-gradient(135deg, rgba(255,255,255,0.035), transparent 55%)",
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <p className="mt-2 text-center font-mono text-[10px] uppercase tracking-wider text-faint">
        Five parallel shards, layered in depth. One consensus-guaranteed STATE backstop.
      </p>
    </div>
  );
}

export default ShardStack3D;
