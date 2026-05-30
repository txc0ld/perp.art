import Link from "next/link";
import { WalletButton } from "@/components/wallet/WalletButton";
import { HeaderSearch } from "./HeaderSearch";
import { Wordmark } from "./Brand";

const NAV = [
  { href: "/explore", label: "Explore" },
  { href: "/collections", label: "Collections" },
  { href: "/stats", label: "Stats" },
  { href: "/permanence", label: "Permanence" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-[1600px] items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="shrink-0" aria-label="perpetual.art home">
          <Wordmark markSize={26} />
        </Link>

        <HeaderSearch className="ml-2 hidden max-w-[460px] flex-1 md:block" />

        <nav className="ml-auto hidden items-center gap-1 lg:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="rounded-[8px] px-3 py-2 text-sm font-medium text-muted transition-colors hover:text-foreground"
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 lg:ml-2">
          <Link
            href="/mint"
            className="hidden rounded-[10px] px-3.5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface sm:block"
          >
            Create
          </Link>
          <WalletButton />
        </div>
      </div>
    </header>
  );
}
