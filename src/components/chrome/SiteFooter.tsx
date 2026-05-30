import Link from "next/link";
import { MonoLabel } from "@/components/ui";
import { Wordmark } from "./Brand";

const COLS: Array<{ title: string; links: Array<{ label: string; href: string }> }> = [
  {
    title: "Marketplace",
    links: [
      { label: "Explore", href: "/explore" },
      { label: "Collections", href: "/collections" },
      { label: "Featured", href: "/#featured" },
    ],
  },
  {
    title: "Create",
    links: [
      { label: "Mint", href: "/mint" },
      { label: "Sovereign contracts", href: "/mint#sovereign" },
      { label: "Royalties", href: "/permanence#royalties" },
    ],
  },
  {
    title: "Permanence",
    links: [
      { label: "How it works", href: "/permanence" },
      { label: "Verification service", href: "/permanence#verify" },
      { label: "Indexer spec", href: "/permanence#indexer" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto w-full max-w-[1600px] px-4 py-16 sm:px-6">
        <div className="grid gap-12 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Wordmark markSize={26} />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted">
              Art, engineered to outlast everything. Every artwork is provably permanent,
              and it survives even if perpetual.art disappears.
            </p>
          </div>

          {COLS.map((col) => (
            <div key={col.title}>
              <MonoLabel className="text-faint">{col.title}</MonoLabel>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link href={l.href} className="text-sm text-muted transition-colors hover:text-foreground">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-mono text-[11px] uppercase tracking-wider text-faint">
            Non-custodial · Royalties enforced at settlement · Built on Forever Library
          </p>
          <p className="font-mono text-[11px] uppercase tracking-wider text-faint">
            © 2026 Perpetual - the art cannot die
          </p>
        </div>
      </div>
    </footer>
  );
}
