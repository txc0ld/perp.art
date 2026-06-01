/**
 * EmptyState — the on-brand "nothing here yet" surface. Used everywhere the live
 * data layer honestly returns nothing (sparse testnet). Terse hairline card,
 * mono eyebrow, foreground title, muted body, optional action slot.
 */
import * as React from "react";
import { cn } from "@/lib/utils";
import { MonoLabel } from "./index";

export interface EmptyStateProps {
  title: string;
  body?: string;
  eyebrow?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ title, body, eyebrow, icon, action, className }: EmptyStateProps) {
  return (
    <div
      role="status"
      className={cn(
        "flex flex-col items-center justify-center rounded-[10px] border border-border bg-surface/40 px-6 py-16 text-center sm:py-20",
        className,
      )}
    >
      {icon && <div className="mb-5 text-faint">{icon}</div>}
      {eyebrow && <MonoLabel className="mb-3 text-faint">{eyebrow}</MonoLabel>}
      <h3 className="font-brand text-lg font-semibold tracking-[-0.01em] text-foreground sm:text-xl">
        {title}
      </h3>
      {body && <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">{body}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
