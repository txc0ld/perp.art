"use client";

import { useState } from "react";
import { useWallet, connectWallet, disconnectWallet } from "@/lib/wallet";
import { shortAddress } from "@/lib/utils";

export function WalletButton() {
  const wallet = useWallet();
  const [open, setOpen] = useState(false);

  if (wallet.connected && wallet.address) {
    return (
      <div className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 rounded-[8px] border border-border bg-surface px-3 py-2 text-sm transition-colors hover:border-border-bright"
        >
          <span className="h-2 w-2 rounded-full bg-verify" />
          <span className="font-mono text-xs">{shortAddress(wallet.address)}</span>
        </button>
        {open && (
          <div className="absolute right-0 mt-2 w-44 overflow-hidden rounded-[8px] border border-border bg-surface shadow-2xl">
            <a href="/profile" className="block px-3 py-2.5 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-foreground">
              Profile
            </a>
            <button
              onClick={() => {
                disconnectWallet();
                setOpen(false);
              }}
              className="block w-full px-3 py-2.5 text-left text-sm text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
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
      onClick={() => connectWallet()}
      className="rounded-[8px] bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-white/85"
    >
      Connect
    </button>
  );
}
