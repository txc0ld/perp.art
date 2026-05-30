/**
 * SectionHeader - shared eyebrow + heading + lede block for the permanence
 * explainer sections. Keeps the 80px section rhythm and mono-eyebrow language
 * consistent across the page. Server component.
 */
import { MonoLabel } from "@/components/ui";
import { cn } from "@/lib/utils";

export function SectionHeader({
  eyebrow,
  title,
  lede,
  className,
}: {
  eyebrow: string;
  title: string;
  lede?: string;
  className?: string;
}) {
  return (
    <div className={cn("max-w-2xl", className)}>
      <MonoLabel className="text-faint">{eyebrow}</MonoLabel>
      <h2 className="display-sm mt-4 text-foreground">{title}</h2>
      {lede ? (
        <p className="mt-4 text-[17px] leading-relaxed text-muted">{lede}</p>
      ) : null}
    </div>
  );
}

export default SectionHeader;
