/**
 * PERPETUAL UI PRIMITIVES
 * The shared vocabulary every screen composes from. Hairline borders,
 * mono labels, one consistent radius, surgical accent. (design prompt §8)
 */
import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------

type ButtonVariant = "primary" | "accent" | "secondary" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

const buttonBase =
  "inline-flex items-center justify-center gap-2 font-medium rounded-[8px] " +
  "transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background " +
  "disabled:opacity-40 disabled:pointer-events-none select-none";

const buttonVariants: Record<ButtonVariant, string> = {
  // The single most important action - earns the accent.
  accent: "bg-accent text-background hover:bg-accent-dim",
  // Standard primary - high contrast white on dark.
  primary: "bg-foreground text-background hover:bg-white/85",
  secondary: "border border-border bg-surface text-foreground hover:border-border-bright hover:bg-surface-2",
  ghost: "text-muted hover:text-foreground hover:bg-surface",
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-[15px]",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({ variant = "primary", size = "md", className, ...props }: ButtonProps) {
  return <button className={cn(buttonBase, buttonVariants[variant], buttonSizes[size], className)} {...props} />;
}

export function ButtonLink({
  href, variant = "primary", size = "md", className, children, ...props
}: { href: string; variant?: ButtonVariant; size?: ButtonSize; className?: string; children: React.ReactNode } & Omit<React.ComponentProps<typeof Link>, "href">) {
  return (
    <Link href={href} className={cn(buttonBase, buttonVariants[variant], buttonSizes[size], className)} {...props}>
      {children}
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Surface / Card
// ---------------------------------------------------------------------------

export function Surface({
  className, children, as: As = "div", ...props
}: { className?: string; children: React.ReactNode; as?: React.ElementType } & React.HTMLAttributes<HTMLElement>) {
  return (
    <As className={cn("bg-surface border border-border rounded-[8px]", className)} {...props}>
      {children}
    </As>
  );
}

// ---------------------------------------------------------------------------
// Badge / Pill (mono uppercase)
// ---------------------------------------------------------------------------

type BadgeTone = "default" | "accent" | "verify" | "muted" | "outline";

const badgeTones: Record<BadgeTone, string> = {
  default: "bg-surface-2 text-foreground border border-border",
  accent: "bg-accent/10 text-accent border border-accent/30",
  verify: "bg-verify/10 text-verify border border-verify/25",
  muted: "bg-transparent text-muted border border-border",
  outline: "bg-transparent text-foreground border border-border-bright",
};

export function Badge({
  tone = "default", className, children,
}: { tone?: BadgeTone; className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider leading-none",
        badgeTones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Mono label + value
// ---------------------------------------------------------------------------

export function MonoLabel({ className, children }: { className?: string; children: React.ReactNode }) {
  return <span className={cn("label-mono", className)}>{children}</span>;
}

export function MonoValue({ className, children }: { className?: string; children: React.ReactNode }) {
  return <span className={cn("font-mono text-sm tabular-nums", className)}>{children}</span>;
}

// ---------------------------------------------------------------------------
// Status glyph (verified / resolving / failed)
// ---------------------------------------------------------------------------

export function StatusGlyph({ status, className }: { status: "verified" | "resolving" | "failed" | "not-configured"; className?: string }) {
  if (status === "verified") {
    return (
      <svg viewBox="0 0 16 16" className={cn("h-3.5 w-3.5 text-accent", className)} fill="none" aria-label="verified">
        <path d="M3.5 8.5l3 3 6-6.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (status === "resolving") {
    return <span className={cn("inline-block h-2 w-2 rounded-full bg-verify animate-verify-pulse", className)} aria-label="resolving" />;
  }
  if (status === "failed") {
    return (
      <svg viewBox="0 0 16 16" className={cn("h-3.5 w-3.5 text-muted", className)} fill="none" aria-label="backstopped">
        <path d="M5 5l6 6M11 5l-6 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    );
  }
  return <span className={cn("inline-block h-2 w-2 rounded-full border border-border", className)} aria-label="not configured" />;
}

// ---------------------------------------------------------------------------
// Divider
// ---------------------------------------------------------------------------

export function Divider({ className }: { className?: string }) {
  return <hr className={cn("border-0 border-t border-border", className)} />;
}

// ---------------------------------------------------------------------------
// Section wrapper (consistent 80px rhythm, design prompt §3)
// ---------------------------------------------------------------------------

export function Section({
  className, children, id,
}: { className?: string; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className={cn("mx-auto w-full max-w-[1600px] px-4 py-12 sm:px-6 sm:py-14 lg:py-16", className)}>
      {children}
    </section>
  );
}
