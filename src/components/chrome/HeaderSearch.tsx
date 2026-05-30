"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Prominent header search (OpenSea-style). Submits to /explore?q=…
 */
export function HeaderSearch({ className }: { className?: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [focused, setFocused] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const term = q.trim();
    router.push(term ? `/explore?q=${encodeURIComponent(term)}` : "/explore");
  }

  return (
    <form onSubmit={submit} className={className}>
      <div
        className={[
          "flex h-10 items-center gap-2.5 rounded-[10px] border bg-surface px-3 transition-colors",
          focused ? "border-accent/50" : "border-border hover:border-border-bright",
        ].join(" ")}
      >
        <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0 text-faint" fill="none">
          <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.4" />
          <path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Search artists, collections, works"
          aria-label="Search"
          className="w-full bg-transparent text-sm text-foreground placeholder:text-faint focus:outline-none"
        />
        <kbd className="hidden shrink-0 rounded-[5px] border border-border px-1.5 py-0.5 font-mono text-[10px] text-faint sm:block">
          /
        </kbd>
      </div>
    </form>
  );
}
