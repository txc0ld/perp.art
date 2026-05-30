/**
 * CategoryPills - horizontally-scrollable genre filter row (OpenSea-style).
 * Pure server component: each pill is a link to /explore?genre=X. The "All"
 * pill (or the one matching the active genre) renders in the accent state.
 */
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Genre } from "@/lib/types";

export function CategoryPills({
  genres,
  active,
}: {
  genres: Genre[];
  active?: string;
}) {
  const items: { label: string; href: string; key: string }[] = [
    { label: "All", href: "/explore", key: "all" },
    ...genres.map((g) => ({ label: g, href: `/explore?genre=${encodeURIComponent(g)}`, key: g })),
  ];
  const activeKey = active ?? "all";

  return (
    <nav aria-label="Browse by category" className="border-b border-border">
      <div className="mx-auto w-full max-w-[1600px] px-4 sm:px-6">
        <ul className="-mx-1 flex items-center gap-2 overflow-x-auto py-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {items.map((item) => {
            const isActive = item.key === activeKey;
            return (
              <li key={item.key} className="shrink-0">
                <Link
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "inline-flex min-h-[44px] items-center rounded-full border px-4 text-[13px] font-medium transition-colors duration-200",
                    isActive
                      ? "border-accent bg-accent text-background"
                      : "border-border bg-surface text-muted hover:border-border-bright hover:text-foreground",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}

export default CategoryPills;
