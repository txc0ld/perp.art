"use client";

/**
 * ProposeSwapButton - opens the SwapModal for a given token. Variant + size are
 * configurable so it can sit as a secondary action in the BuyPanel or as a
 * prominent CTA on the token page / TokenSwaps section.
 */
import * as React from "react";
import type { Token } from "@/lib/types";
import { Button, type ButtonProps } from "@/components/ui";
import { SwapModal } from "./SwapModal";

export function ProposeSwapButton({
  token,
  variant = "secondary",
  size = "lg",
  className,
  children,
}: {
  token: Token;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button variant={variant} size={size} className={className} onClick={() => setOpen(true)}>
        {children ?? "Propose swap"}
      </Button>
      {open && <SwapModal token={token} onClose={() => setOpen(false)} />}
    </>
  );
}
