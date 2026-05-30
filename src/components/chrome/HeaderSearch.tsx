"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * Prominent header search (OpenSea-style). Submits to /explore?q=…
 * `autoFocus` is used by the compact mobile search sheet.
 */
export function HeaderSearch({
  className,
  autoFocus = false,
}: {
  className?: string;
  autoFocus?: boolean;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const term = q.trim();
    router.push(term ? `/explore?q=${encodeURIComponent(term)}` : "/explore");
  }

  return (
    <form onSubmit={submit} role="search" className={className}>
      <div className="flex h-10 items-center gap-2.5 rounded-[8px] border border-border bg-surface px-3 transition-colors hover:border-border-bright focus-within:border-accent/50 focus-within:ring-2 focus-within:ring-accent/30">
        <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0 text-faint" fill="none" aria-hidden>
          <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.4" />
          <path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        <input
          ref={inputRef}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search artists, collections, works"
          aria-label="Search artists, collections, and works"
          className="w-full bg-transparent text-sm text-foreground placeholder:text-faint focus:outline-none [&::-webkit-search-cancel-button]:appearance-none"
        />
        <kbd className="hidden shrink-0 rounded-[5px] border border-border px-1.5 py-0.5 font-mono text-[10px] text-faint sm:block">
          /
        </kbd>
      </div>
    </form>
  );
}
