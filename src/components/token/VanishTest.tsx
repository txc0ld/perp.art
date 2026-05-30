"use client";

/**
 * VanishTest - the signature proof. An interactive simulation of operator
 * shutdown: we take the operator-dependent layers offline one by one
 * (Perpetual indexer, the CDN mirror, then even the IPFS pin), while the
 * onchain proof shard (ethfs) stays lit and keeps resolving the artwork from
 * Ethereum itself. The piece survives even if Perpetual disappears.
 *
 * On-brand: near-black, hairlines, mono, one accent. Restrained dimming + a
 * single strike line per downed layer, no arcade flourish.
 *
 * Reduced-motion: jump straight to the resolved end-state (all operator layers
 * down, onchain still resolving), no sequential animation. setState in effects
 * is deferred via setTimeout(...,0) so it never runs synchronously in an effect
 * body (repo lints react-hooks/set-state-in-effect as an error).
 */
import * as React from "react";
import type { Token } from "@/lib/types";
import { GenerativeArt } from "@/components/art/GenerativeArt";
import { StatusGlyph, Button } from "@/components/ui";
import { cn } from "@/lib/utils";

type Phase = "idle" | "running" | "done";

/** A layer in the resolution stack, ordered from most to least operator-dependent. */
interface Layer {
  key: string;
  label: string;
  sub: string;
  /** Operator-dependent layers go dark during the test; onchain never does. */
  operatorDependent: boolean;
}

const BACKEND_TO_LAYER: Record<string, Omit<Layer, "key">> = {
  cdn: { label: "CDN (high-res mirror)", sub: "perpetual.art edge cache", operatorDependent: true },
  ipfs: { label: "IPFS pin", sub: "operator-maintained pin", operatorDependent: true },
  arweave: { label: "Arweave", sub: "independent permanent net", operatorDependent: false },
  irys: { label: "Irys", sub: "independent permanent net", operatorDependent: false },
  onchain: { label: "Onchain (ethfs)", sub: "stored in Ethereum state", operatorDependent: false },
};

/** Build the takedown stack: indexer first (always), then operator shards, onchain last and untouchable. */
function buildLayers(token: Token): Layer[] {
  const layers: Layer[] = [
    {
      key: "indexer",
      label: "Perpetual indexer + API",
      sub: "perpetual.art services",
      operatorDependent: true,
    },
  ];
  // Operator-dependent shards (CDN, IPFS) downed in order, then independent nets, onchain last.
  const order = ["cdn", "ipfs", "arweave", "irys"];
  for (const backend of order) {
    const shard = token.permanence.shards.find((s) => s.backend === backend);
    if (!shard) continue;
    const meta = BACKEND_TO_LAYER[backend];
    layers.push({ key: `shard-${backend}`, ...meta });
  }
  layers.push({ key: "shard-onchain", ...BACKEND_TO_LAYER.onchain });
  return layers;
}

export function VanishTest({ token }: { token: Token }) {
  const layers = React.useMemo(() => buildLayers(token), [token]);

  // Indices of operator-dependent layers, in takedown order.
  const downOrder = React.useMemo(
    () =>
      layers
        .map((l, i) => (l.operatorDependent ? i : -1))
        .filter((i) => i >= 0),
    [layers],
  );

  const [phase, setPhase] = React.useState<Phase>("idle");
  // How many of the operator-dependent layers have gone dark so far.
  const [downCount, setDownCount] = React.useState(0);
  const timersRef = React.useRef<ReturnType<typeof setTimeout>[]>([]);
  const reducedRef = React.useRef(false);

  // Detect reduced-motion once, on mount (deferred setState - never synchronous in effect body).
  React.useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      const t = setTimeout(() => {
        reducedRef.current = true;
      }, 0);
      return () => clearTimeout(t);
    }
  }, []);

  const clearTimers = React.useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  React.useEffect(() => clearTimers, [clearTimers]);

  const run = React.useCallback(() => {
    clearTimers();
    setPhase("running");
    setDownCount(0);

    if (reducedRef.current) {
      // Jump straight to the resolved end-state, no sequence.
      setDownCount(downOrder.length);
      setPhase("done");
      return;
    }

    const STEP = 900;
    downOrder.forEach((_, n) => {
      timersRef.current.push(
        setTimeout(() => setDownCount(n + 1), 500 + n * STEP),
      );
    });
    timersRef.current.push(
      setTimeout(
        () => setPhase("done"),
        500 + downOrder.length * STEP + 400,
      ),
    );
  }, [clearTimers, downOrder]);

  const reset = React.useCallback(() => {
    clearTimers();
    setPhase("idle");
    setDownCount(0);
  }, [clearTimers]);

  // Has a given layer gone dark yet? It is down once its rank in downOrder < downCount.
  const isDown = (layerIndex: number) => {
    const rank = downOrder.indexOf(layerIndex);
    return rank >= 0 && rank < downCount;
  };

  const running = phase === "running";
  const done = phase === "done";
  // The artwork is "operator-served" until the operator layers are gone; then it
  // resolves purely from the onchain shard.
  const onchainOnly = downCount >= downOrder.length;

  return (
    <section
      aria-label="Vanish test"
      className="overflow-hidden rounded-[10px] border border-border-bright bg-surface"
    >
      <div className="grid gap-0 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
        {/* ---------------------------------------------------------------- */}
        {/* The artwork, still resolving                                      */}
        {/* ---------------------------------------------------------------- */}
        <div className="border-b border-border p-4 sm:p-5 lg:border-b-0 lg:border-r">
          <div className="relative overflow-hidden rounded-[8px] border border-border bg-background">
            <div className="aspect-square w-full">
              <GenerativeArt
                seed={token.artSeed}
                genre={token.genre}
                size={520}
                className={cn(
                  "h-full w-full transition-[filter,opacity] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]",
                  // While the operator layers fall, dip briefly; once onchain-only it
                  // resolves crisp again - the point being it never actually goes away.
                  running && !onchainOnly && "opacity-90",
                )}
              />
            </div>
            {/* Source-of-truth caption overlay */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-background/90 to-transparent px-3 pb-2.5 pt-6">
              <StatusGlyph status={running && !onchainOnly ? "resolving" : "verified"} />
              <span className="font-mono text-[10px] uppercase tracking-wider text-faint">
                {phase === "idle"
                  ? "Resolving · all layers"
                  : onchainOnly
                    ? "Resolving · onchain only"
                    : "Resolving · failing over"}
              </span>
            </div>
          </div>
          <p className="mt-3 font-mono text-[10px] uppercase tracking-wider text-faint">
            {token.id}
          </p>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* The resolution stack + controls                                   */}
        {/* ---------------------------------------------------------------- */}
        <div className="flex flex-col p-4 sm:p-5">
          <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-foreground">
              Resolution stack
            </span>
            <span className="font-mono text-[10px] uppercase tracking-wider text-faint">
              {onchainOnly
                ? "operator gone · still resolving"
                : "operator + permanent layers"}
            </span>
          </header>

          {/* Layer rows */}
          <ul className="space-y-1.5">
            {layers.map((layer, i) => {
              const down = isDown(i);
              const isOnchain = layer.key === "shard-onchain";
              return (
                <li
                  key={layer.key}
                  className={cn(
                    "relative flex items-center gap-3 overflow-hidden rounded-[6px] border px-3 py-2.5 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                    down
                      ? "border-border/60 bg-surface-2/20 opacity-40"
                      : isOnchain && (running || done)
                        ? "border-accent/40 bg-accent/[0.05]"
                        : "border-border bg-surface-2/30",
                  )}
                >
                  {/* Strike line over downed layers */}
                  <span
                    aria-hidden
                    className={cn(
                      "pointer-events-none absolute left-3 right-3 top-1/2 h-px origin-left -translate-y-1/2 bg-faint transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                      down ? "scale-x-100" : "scale-x-0",
                    )}
                  />
                  <span className="flex w-4 shrink-0 items-center justify-center">
                    {down ? (
                      <StatusGlyph status="failed" />
                    ) : isOnchain && (running || done) ? (
                      <StatusGlyph status="verified" />
                    ) : (
                      <StatusGlyph status="not-configured" />
                    )}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span
                      className={cn(
                        "truncate text-[13px]",
                        down
                          ? "text-faint line-through decoration-faint/60"
                          : isOnchain
                            ? "font-medium text-foreground"
                            : "text-foreground",
                      )}
                    >
                      {layer.label}
                    </span>
                    <span className="truncate font-mono text-[10px] uppercase tracking-wider text-faint">
                      {layer.sub}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "shrink-0 font-mono text-[10px] uppercase tracking-wider",
                      down
                        ? "text-faint"
                        : isOnchain && (running || done)
                          ? "text-accent"
                          : "text-muted",
                    )}
                  >
                    {down
                      ? "offline"
                      : isOnchain
                        ? "anchor"
                        : layer.operatorDependent
                          ? "operator"
                          : "permanent"}
                  </span>
                </li>
              );
            })}
          </ul>

          {/* Conclusion / controls */}
          <div className="mt-4">
            {done ? (
              <div className="animate-fade rounded-[8px] border border-accent/30 bg-accent/[0.06] px-4 py-3.5">
                <p className="flex items-start gap-2 text-[13px] font-medium leading-relaxed text-foreground">
                  <StatusGlyph status="verified" className="mt-0.5 shrink-0" />
                  <span>
                    Perpetual is gone. The artwork still resolves, read directly
                    from Ethereum itself. It survives even if perpetual.art
                    disappears.
                  </span>
                </p>
                <div className="mt-3.5">
                  <Button variant="secondary" size="sm" onClick={reset}>
                    Reset
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                <p className="text-[12px] leading-relaxed text-muted">
                  Simulate operator shutdown. We take the indexer, CDN, and even
                  the IPFS pin offline, then watch the work keep resolving from
                  the onchain proof.
                </p>
                <div>
                  <Button
                    variant="accent"
                    size="md"
                    onClick={run}
                    disabled={running}
                  >
                    {running ? "Shutting Perpetual down…" : "Run the vanish test"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
