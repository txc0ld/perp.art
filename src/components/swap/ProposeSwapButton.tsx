"use client";

/**
 * ProposeSwapButton - opens the SwapModal. With a `token`, it proposes against
 * that specific target (BuyPanel / token page). Without a token, it
 * opens in criteria mode as a generic "Create swap" entry point (Swaps desk).
 */
import * as React from "react";
import type { Token } from "@/lib/types";
import { Button, type ButtonProps } from "@/components/ui";
import { SwapModal, type SwapMode } from "./SwapModal";

export function ProposeSwapButton({
  token,
  defaultMode,
  variant = "secondary",
  size = "lg",
  className,
  children,
}: {
  /** Target token. Omit for a generic criteria-mode "Create swap". */
  token?: Token;
  defaultMode?: SwapMode;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button variant={variant} size={size} className={className} onClick={() => setOpen(true)}>
        {children ?? (token ? "Propose swap" : "Create swap")}
      </Button>
      {open && <SwapModal token={token} defaultMode={defaultMode} onClose={() => setOpen(false)} />}
    </>
  );
}
