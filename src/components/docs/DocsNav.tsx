import { MonoLabel } from "@/components/ui";

/**
 * The docs table of contents. A plain anchor list, rendered server-side.
 * Sticky on large screens so the section map stays in view while reading.
 * No scroll-spy client state: anchors are honest, keyboard-navigable links.
 */
export interface DocsSectionMeta {
  id: string;
  index: string;
  title: string;
}

export const DOCS_SECTIONS: DocsSectionMeta[] = [
  { id: "overview", index: "01", title: "Overview" },
  { id: "permanence", index: "02", title: "Permanence" },
  { id: "networks", index: "03", title: "Networks" },
  { id: "trading", index: "04", title: "Trading" },
  { id: "settlement", index: "05", title: "Cross-chain settlement" },
  { id: "royalties", index: "06", title: "Royalties" },
  { id: "verification", index: "07", title: "Verification features" },
  { id: "identities", index: "08", title: "ENS identities" },
  { id: "sovereign", index: "09", title: "Sovereign contracts" },
  { id: "indexer", index: "10", title: "Indexer and rebuildability" },
  { id: "getting-started", index: "11", title: "Getting started" },
];

export function DocsNav() {
  const list = (
    <ol className="space-y-0.5">
      {DOCS_SECTIONS.map((s) => (
        <li key={s.id}>
          <a
            href={`#${s.id}`}
            className="group -mx-2 flex min-h-[44px] items-center gap-3 rounded-[8px] px-2 py-2 text-sm text-muted transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <span className="font-mono text-[11px] tabular-nums text-faint transition-colors group-hover:text-accent">
              {s.index}
            </span>
            <span className="leading-snug">{s.title}</span>
          </a>
        </li>
      ))}
    </ol>
  );

  return (
    <nav aria-label="Documentation contents" className="lg:sticky lg:top-24">
      {/* Mobile / tablet: a collapsible disclosure so the contents map does not
          push the body down. Native <details>, no client JS. */}
      <details className="group rounded-[10px] border border-border bg-surface lg:hidden">
        <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-3 rounded-[10px] px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 [&::-webkit-details-marker]:hidden">
          <MonoLabel className="text-faint">Contents</MonoLabel>
          <svg
            aria-hidden
            viewBox="0 0 16 16"
            className="h-3.5 w-3.5 text-muted transition-transform duration-200 group-open:rotate-180"
            fill="none"
          >
            <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </summary>
        <div className="border-t border-border px-2 pb-3 pt-2">{list}</div>
      </details>

      {/* Desktop: the persistent sticky rail. */}
      <div className="hidden lg:block">
        <MonoLabel className="text-faint">Contents</MonoLabel>
        <div className="mt-4">{list}</div>
      </div>
    </nav>
  );
}
