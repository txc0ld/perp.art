"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { WalletButton } from "@/components/wallet/WalletButton";
import { NetworkButton } from "@/components/wallet/NetworkButton";
import { HeaderSearch } from "./HeaderSearch";
import { Wordmark } from "./Brand";

const NAV = [
  { href: "/explore", label: "Explore" },
  { href: "/collections", label: "Collections" },
  { href: "/swaps", label: "Swaps" },
  { href: "/stats", label: "Stats" },
  { href: "/permanence", label: "Permanence" },
  { href: "/mint", label: "Create" },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader() {
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Close mobile overlays on route change (deferred to a callback to avoid a
  // synchronous setState in the effect body).
  useEffect(() => {
    const t = setTimeout(() => {
      setSearchOpen(false);
      setMenuOpen(false);
    }, 0);
    return () => clearTimeout(t);
  }, [pathname]);

  // Escape closes whichever overlay is open.
  useEffect(() => {
    if (!searchOpen && !menuOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setSearchOpen(false);
        setMenuOpen(false);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [searchOpen, menuOpen]);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-[1600px] items-center gap-3 px-4 sm:gap-4 sm:px-6">
        <Link
          href="/"
          className="shrink-0 rounded-[8px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          aria-label="perpetual.art home"
        >
          <Wordmark markSize={26} />
        </Link>

        <HeaderSearch className="ml-2 hidden min-w-0 max-w-[460px] flex-1 md:block" />

        <nav aria-label="Primary" className="ml-auto hidden items-center gap-1 lg:flex">
          {NAV.map((n) => {
            const active = isActive(pathname, n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-[8px] px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  active ? "text-foreground" : "text-muted hover:text-foreground",
                )}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2 lg:ml-3">
          {/* Mobile search toggle (search bar is hidden < md) */}
          <button
            type="button"
            onClick={() => {
              setSearchOpen((v) => !v);
              setMenuOpen(false);
            }}
            aria-label="Search"
            aria-expanded={searchOpen}
            className="flex h-10 w-10 items-center justify-center rounded-[8px] text-muted transition-colors hover:bg-surface hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background md:hidden"
          >
            <svg viewBox="0 0 16 16" className="h-[18px] w-[18px]" fill="none" aria-hidden>
              <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.4" />
              <path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>

          <NetworkButton />
          <WalletButton />

          {/* Mobile nav toggle (primary nav is hidden < lg) */}
          <button
            type="button"
            onClick={() => {
              setMenuOpen((v) => !v);
              setSearchOpen(false);
            }}
            aria-label="Menu"
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            className="flex h-10 w-10 items-center justify-center rounded-[8px] text-muted transition-colors hover:bg-surface hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background lg:hidden"
          >
            <svg viewBox="0 0 16 16" className="h-[18px] w-[18px]" fill="none" aria-hidden>
              {menuOpen ? (
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              ) : (
                <path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile search sheet */}
      {searchOpen && (
        <div className="border-t border-border bg-background px-4 py-3 md:hidden">
          <HeaderSearch autoFocus />
        </div>
      )}

      {/* Mobile nav sheet */}
      {menuOpen && (
        <nav
          id="mobile-nav"
          aria-label="Primary"
          className="border-t border-border bg-background px-2 py-2 lg:hidden"
        >
          {NAV.map((n) => {
            const active = isActive(pathname, n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center rounded-[8px] px-3 py-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-inset",
                  active ? "bg-surface text-foreground" : "text-muted hover:bg-surface hover:text-foreground",
                )}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
      )}
    </header>
  );
}
