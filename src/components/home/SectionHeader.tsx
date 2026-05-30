/**
 * SectionHeader - consistent eyebrow + heading + note row for home sections.
 * Optional trailing "View all" link. Pure presentation, server component.
 */
import Link from "next/link";
import { MonoLabel } from "@/components/ui";

export function SectionHeader({
  eyebrow,
  title,
  note,
  href,
  hrefLabel = "View all",
}: {
  eyebrow: string;
  title: string;
  note?: string;
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        <MonoLabel className="text-faint">{eyebrow}</MonoLabel>
        <h2 className="display-sm mt-3 text-foreground">{title}</h2>
        {note ? <p className="mt-3 max-w-prose text-sm leading-relaxed text-muted">{note}</p> : null}
      </div>
      {href ? (
        <Link
          href={href}
          className="group inline-flex shrink-0 items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:text-accent"
        >
          {hrefLabel}
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" fill="none">
            <path d="M3 8h9M9 4.5L12.5 8 9 11.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      ) : null}
    </div>
  );
}

export default SectionHeader;
