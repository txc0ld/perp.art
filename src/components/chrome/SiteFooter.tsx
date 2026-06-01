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
  {
    title: "Learn",
    links: [
      { label: "Documentation", href: "/docs" },
      { label: "Trading & swaps", href: "/docs#trading" },
      { label: "Getting started", href: "/docs#getting-started" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto w-full max-w-[1600px] px-4 py-16 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 md:grid-cols-[1.4fr_1fr_1fr_1fr_1fr] md:gap-12">
          <div className="col-span-full md:col-span-1">
            <Link
              href="/"
              className="inline-flex rounded-[8px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              aria-label="perpetual.art home"
            >
              <Wordmark markSize={26} />
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted">
              Art, engineered to outlast everything. Every artwork is provably permanent,
              and it survives even if Perpetual disappears.
            </p>
          </div>

          {COLS.map((col) => (
            <div key={col.title}>
              <MonoLabel className="text-faint">{col.title}</MonoLabel>
              <ul className="mt-4 space-y-1">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="-mx-2 inline-flex min-h-[44px] items-center rounded-[8px] px-2 py-2 text-sm text-muted transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
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
