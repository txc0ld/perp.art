import { resolveEns } from "@/lib/mock-data";
import { shortAddress, cn } from "@/lib/utils";
import { GenerativeArt } from "@/components/art/GenerativeArt";

/**
 * Identity - renders a wallet as its primary ENS name when one exists, falling
 * back to a shortened hex address. ENS names read as a name (sans); raw addresses
 * stay in mono (machine-truth). Server-safe (resolveEns is a pure accessor).
 */
export function Identity({
  address,
  avatar = false,
  className,
  title,
}: {
  address: string;
  avatar?: boolean;
  className?: string;
  /** Override the hover title; defaults to the full address. */
  title?: string;
}) {
  const ens = resolveEns(address);
  const label = ens ?? shortAddress(address);
  return (
    <span className={cn("inline-flex items-center gap-1.5 align-middle", className)} title={title ?? address}>
      {avatar && (
        <span className="h-4 w-4 shrink-0 overflow-hidden rounded-full ring-1 ring-border">
          <GenerativeArt seed={`id:${address}`} genre="Abstract" size={32} className="h-full w-full" />
        </span>
      )}
      <span className={cn("truncate", ens ? "font-sans" : "font-mono tabular-nums", "text-inherit")}>
        {label}
      </span>
    </span>
  );
}
