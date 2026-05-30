"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet, connectWallet, disconnectWallet } from "@/lib/wallet";
import { shortAddress } from "@/lib/utils";

export function WalletButton() {
  const router = useRouter();
  const wallet = useWallet();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click + Escape; return focus to the trigger on Escape.
  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // Move focus into the menu when it opens.
  useEffect(() => {
    if (open) {
      const first = menuRef.current?.querySelector<HTMLElement>("[role='menuitem']");
      first?.focus();
    }
  }, [open]);

  if (wallet.connected && wallet.address) {
    return (
      <div ref={containerRef} className="relative">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={`Wallet menu, connected as ${shortAddress(wallet.address)}`}
          className="flex h-10 items-center gap-2 rounded-[8px] border border-border bg-surface px-3 text-sm transition-colors hover:border-border-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <span className="h-2 w-2 shrink-0 rounded-full bg-verify" aria-hidden />
          <span className="font-mono text-xs tabular-nums">{shortAddress(wallet.address)}</span>
        </button>
        {open && (
          <div
            ref={menuRef}
            role="menu"
            aria-label="Wallet"
            className="absolute right-0 mt-2 w-48 overflow-hidden rounded-[8px] border border-border bg-surface p-1 shadow-2xl"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                router.push("/profile");
              }}
              className="block w-full rounded-[6px] px-3 py-2.5 text-left text-sm text-muted transition-colors hover:bg-surface-2 hover:text-foreground focus-visible:bg-surface-2 focus-visible:text-foreground focus-visible:outline-none"
            >
              Profile
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                disconnectWallet();
                setOpen(false);
                triggerRef.current?.focus();
              }}
              className="block w-full rounded-[6px] px-3 py-2.5 text-left text-sm text-muted transition-colors hover:bg-surface-2 hover:text-foreground focus-visible:bg-surface-2 focus-visible:text-foreground focus-visible:outline-none"
            >
              Disconnect
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => connectWallet()}
      className="flex h-10 items-center justify-center rounded-[8px] bg-foreground px-4 text-sm font-medium text-background transition-colors hover:bg-white/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      Connect
    </button>
  );
}
