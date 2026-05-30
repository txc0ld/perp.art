/**
 * SectionNav - a subtle in-page anchor sub-nav for the token detail sections.
 * Mono pill links that jump to each labelled accordion card. Pure anchors, so no
 * client JS is required (global `scroll-behavior: smooth` handles the motion, and
 * each target carries `scroll-mt` to clear the sticky chrome).
 */
import { cn } from "@/lib/utils";

export interface SectionNavItem {
  id: string;
  label: string;
}

export function SectionNav({
  items,
  className,
}: {
  items: SectionNavItem[];
  className?: string;
}) {
  if (items.length === 0) return null;
  return (
    <nav
      aria-label="Jump to section"
      className={cn("flex flex-wrap items-center gap-1.5", className)}
    >
      {items.map((item) => (
        <a
          key={item.id}
          href={`#${item.id}`}
          className={cn(
            "inline-flex items-center rounded-full border border-border px-3 py-1.5",
            "font-mono text-[10px] uppercase tracking-wider text-muted transition-colors",
            "hover:border-border-bright hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          )}
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}
