"use client";

import * as React from "react";
import { Button } from "@/components/ui";
import { cn, shortAddress } from "@/lib/utils";

/**
 * Collection-detail action cluster: follow (local toggle), share (copies the
 * current URL), and a copy-contract-address control. Every button does
 * something and confirms it via an aria-live region. No dead buttons.
 */
export function CollectionActions({ contractAddress }: { contractAddress: string }) {
  const [following, setFollowing] = React.useState(false);
  const [status, setStatus] = React.useState("");
  const [addrCopied, setAddrCopied] = React.useState(false);
  const timer = React.useRef<number | undefined>(undefined);

  const announce = React.useCallback((msg: string) => {
    setStatus(msg);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setStatus(""), 2000);
  }, []);

  React.useEffect(() => () => window.clearTimeout(timer.current), []);

  function toggleFollow() {
    setFollowing((v) => {
      const next = !v;
      announce(next ? "Following this collection" : "Unfollowed this collection");
      return next;
    });
  }

  function share() {
    if (typeof window !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href).then(
        () => announce("Link copied to clipboard"),
        () => announce("Could not copy link"),
      );
    }
  }

  function copyAddress() {
    if (typeof window !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(contractAddress).then(
        () => {
          setAddrCopied(true);
          announce("Contract address copied");
          window.setTimeout(() => setAddrCopied(false), 1600);
        },
        () => announce("Could not copy address"),
      );
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <Button
        variant={following ? "secondary" : "primary"}
        size="md"
        onClick={toggleFollow}
        aria-pressed={following}
        className="min-h-[44px]"
      >
        {following ? (
          <>
            <svg viewBox="0 0 16 16" className="h-4 w-4 text-accent" fill="none" aria-hidden>
              <path d="M3.5 8.5l3 3 6-6.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Following
          </>
        ) : (
          "Follow"
        )}
      </Button>

      <Button
        variant="secondary"
        size="md"
        onClick={copyAddress}
        aria-label={addrCopied ? "Contract address copied" : `Copy contract address ${shortAddress(contractAddress)}`}
        className="min-h-[44px] font-mono text-[12px]"
      >
        {addrCopied ? (
          <svg viewBox="0 0 16 16" className="h-4 w-4 text-accent" fill="none" aria-hidden>
            <path d="M3.5 8.5l3 3 6-6.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg viewBox="0 0 16 16" className="h-4 w-4 text-faint" fill="none" aria-hidden>
            <rect x="5.5" y="5.5" width="7" height="7" rx="1.2" stroke="currentColor" strokeWidth="1.2" />
            <path d="M3.5 10.5V4a.5.5 0 01.5-.5h6.5" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        )}
        <span className="tabular-nums">{shortAddress(contractAddress)}</span>
      </Button>

      <Button
        variant="secondary"
        size="md"
        onClick={share}
        aria-label="Share collection"
        className="min-h-[44px] px-3"
      >
        <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden>
          <path d="M11 5.5l-3-3-3 3M8 2.5V10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M3.5 9v3a1.5 1.5 0 001.5 1.5h6A1.5 1.5 0 0012.5 12V9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        <span className="hidden sm:inline">Share</span>
      </Button>

      <span aria-live="polite" className={cn("sr-only")}>
        {status}
      </span>
    </div>
  );
}
