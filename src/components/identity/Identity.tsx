"use client";

import { useEnsName } from "@/lib/use-ens";
import { displayName } from "@/lib/ens";
import { cn } from "@/lib/utils";
import { GenerativeArt } from "@/components/art/GenerativeArt";

/**
 * Identity - renders a wallet as its primary ENS name when one exists, falling
 * back to a shortened hex address. ENS names read as a name (sans); raw addresses
 * stay in mono (machine-truth). Resolution is real (mainnet) via useEnsName; until
 * it resolves (or if there is no name) it shows the short address.
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
  const ens = useEnsName(address);
  const label = displayName(address, ens);
  const hasEns = Boolean(ens);
  return (
    <span className={cn("inline-flex items-center gap-1.5 align-middle", className)} title={title ?? address}>
      {avatar && (
        <span className="h-4 w-4 shrink-0 overflow-hidden rounded-full ring-1 ring-border">
          <GenerativeArt seed={`id:${address}`} genre="Abstract" size={32} className="h-full w-full" />
        </span>
      )}
      <span className={cn("truncate", hasEns ? "font-sans" : "font-mono tabular-nums", "text-inherit")}>
        {label}
      </span>
    </span>
  );
}
