/**
 * FeaturedDrops - the showpiece section that pairs the standard SectionHeader
 * ("Featured drops") with the client-side Coverflow3D below it. Server
 * component: it receives already-resolved items as a prop so the page keeps
 * all data access on the server and only the coverflow itself is a client
 * island.
 */
import Link from "next/link";
import { SectionHeader } from "@/components/ui";
import { Coverflow3D, type CoverflowItem } from "@/components/home/Coverflow3D";

export function FeaturedDrops({ items }: { items: CoverflowItem[] }) {
  if (items.length === 0) return null;

  return (
    <div>
      <SectionHeader
        eyebrow="Featured drops"
        title="In the gallery this week"
        description="Hand-selected works, provably permanent. Browse the coverflow, open any piece."
        action={
          <Link
            href="/explore"
            className="group inline-flex shrink-0 items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:text-accent"
          >
            View all
            <svg aria-hidden viewBox="0 0 16 16" className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" fill="none">
              <path d="M3 8h9M9 4.5L12.5 8 9 11.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        }
      />

      <Coverflow3D items={items} />
    </div>
  );
}

export default FeaturedDrops;
