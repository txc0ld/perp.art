"use client";

/**
 * EditProfileModal - edits the connected user's display name + bio over a near-black
 * scrim. Mirrors the BuyModal pattern: role=dialog/aria-modal, Esc to close, focus
 * trap, body-scroll lock, optimistic "Saved" feedback. On save the edited values are
 * lifted into the header via onSave so the UI updates immediately. Full-width and
 * scrollable on mobile.
 */
import * as React from "react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";

type Phase = "edit" | "saving" | "done";

const NAME_MAX = 48;
const BIO_MAX = 240;

export function EditProfileModal({
  initialName,
  initialBio,
  onClose,
  onSave,
}: {
  initialName: string;
  initialBio: string;
  onClose: () => void;
  onSave: (next: { name: string; bio: string }) => void;
}) {
  const [phase, setPhase] = React.useState<Phase>("edit");
  const [name, setName] = React.useState(initialName);
  const [bio, setBio] = React.useState(initialBio);
  const dialogRef = React.useRef<HTMLDivElement | null>(null);

  const nameError = name.trim().length === 0;

  // Focus the name field on open; return focus to the opener on close.
  React.useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLInputElement>("[data-autofocus]")?.focus();
    return () => opener?.focus?.();
  }, []);

  // Esc to close + lightweight focus trap + body-scroll lock.
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "Tab" && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  function save() {
    if (nameError) return;
    setPhase("saving");
    onSave({ name: name.trim(), bio: bio.trim() });
    window.setTimeout(() => setPhase("done"), 900);
    window.setTimeout(() => onClose(), 1600);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && phase !== "saving") onClose();
      }}
    >
      <div className="absolute inset-0 bg-background/85 backdrop-blur-sm animate-fade" aria-hidden />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-profile-title"
        className="animate-rise relative max-h-[90vh] w-full max-w-[460px] overflow-y-auto rounded-[10px] border border-border-bright bg-surface shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <span id="edit-profile-title" className="label-mono text-foreground">
            {phase === "done" ? "Profile saved" : "Edit profile"}
          </span>
          <button
            type="button"
            onClick={onClose}
            disabled={phase === "saving"}
            className="flex h-11 w-11 items-center justify-center rounded-[8px] text-faint transition-colors hover:text-foreground disabled:opacity-30"
            aria-label="Close"
          >
            <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden>
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5">
          {phase === "done" ? (
            <div className="animate-fade flex items-center gap-2.5 rounded-[8px] border border-verify/25 bg-verify/10 px-4 py-3">
              <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-verify" aria-hidden />
              <p className="text-[13px] text-foreground">Your profile has been updated.</p>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="edit-name" className="font-mono text-[11px] uppercase tracking-wider text-faint">
                  Display name
                </label>
                <input
                  id="edit-name"
                  data-autofocus
                  type="text"
                  value={name}
                  maxLength={NAME_MAX}
                  disabled={phase === "saving"}
                  onChange={(e) => setName(e.target.value)}
                  aria-invalid={nameError}
                  aria-describedby={nameError ? "edit-name-error" : undefined}
                  className={cn(
                    "h-11 w-full rounded-[8px] border bg-background px-3.5 text-sm text-foreground transition-colors placeholder:text-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
                    nameError ? "border-error/50" : "border-border focus-visible:border-border-bright",
                  )}
                  placeholder="Your name"
                />
                {nameError && (
                  <p id="edit-name-error" className="text-[12px] text-error">
                    A display name is required.
                  </p>
                )}
              </div>

              <div className="mt-4 flex flex-col gap-1.5">
                <label htmlFor="edit-bio" className="font-mono text-[11px] uppercase tracking-wider text-faint">
                  Bio
                </label>
                <textarea
                  id="edit-bio"
                  value={bio}
                  maxLength={BIO_MAX}
                  disabled={phase === "saving"}
                  onChange={(e) => setBio(e.target.value)}
                  rows={4}
                  className="w-full resize-none rounded-[8px] border border-border bg-background px-3.5 py-2.5 text-sm leading-relaxed text-foreground transition-colors placeholder:text-faint focus-visible:border-border-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                  placeholder="A short line about your work."
                />
                <span className="self-end font-mono text-[10px] tabular-nums text-faint">
                  {bio.length}/{BIO_MAX}
                </span>
              </div>

              <div className="mt-6 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
                <Button
                  variant="secondary"
                  size="md"
                  className="min-h-[44px] sm:min-w-[110px]"
                  onClick={onClose}
                  disabled={phase === "saving"}
                >
                  Cancel
                </Button>
                <Button
                  variant="accent"
                  size="md"
                  className="min-h-[44px] sm:min-w-[110px]"
                  onClick={save}
                  disabled={phase === "saving" || nameError}
                >
                  {phase === "saving" ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="inline-block h-2 w-2 animate-verify-pulse rounded-full bg-background" aria-hidden />
                      Saving…
                    </span>
                  ) : (
                    "Save changes"
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
