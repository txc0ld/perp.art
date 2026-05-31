"use client";

import * as React from "react";
import type { Genre, MediaType } from "@/lib/types";
import { cn, formatBytes } from "@/lib/utils";
import { MediaPreview } from "./MediaPreview";
import { MonoLabel, Badge } from "@/components/ui";
import type { MintForm } from "./state";
import { previewSeed, mediaTypeFromMime, MAX_UPLOAD_BYTES, ACCEPTED_UPLOAD } from "./state";

const MEDIA_TYPES: { value: MediaType; label: string }[] = [
  { value: "image", label: "Image" },
  { value: "video", label: "Video" },
  { value: "interactive", label: "Interactive" },
];

/** Hairline field shell with a mono label and accent focus ring. */
function Field({
  label,
  htmlFor,
  children,
  hint,
  required,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
  hint?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={htmlFor} className="flex items-baseline justify-between">
        <MonoLabel>
          {label}
          {required && (
            <span className="ml-1 text-accent" aria-hidden>
              *
            </span>
          )}
        </MonoLabel>
        {hint && <span className="font-mono text-[10px] text-faint">{hint}</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full rounded-[8px] border border-border bg-surface-2 px-3.5 py-2.5 text-base text-foreground sm:text-sm " +
  "placeholder:text-faint transition-colors duration-200 " +
  "focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/30";

export function UploadStep({
  form,
  set,
  genres,
}: {
  form: MintForm;
  set: (patch: Partial<MintForm>) => void;
  genres: Genre[];
}) {
  const seed = previewSeed(form);
  const [touched, setTouched] = React.useState<{ artist?: boolean; title?: boolean }>({});
  const artistError = touched.artist && form.artistName.trim().length === 0;
  const titleError = touched.title && form.title.trim().length === 0;

  const addTrait = () => set({ traits: [...form.traits, { key: "", value: "" }] });
  const updateTrait = (i: number, patch: Partial<{ key: string; value: string }>) =>
    set({ traits: form.traits.map((t, idx) => (idx === i ? { ...t, ...patch } : t)) });
  const removeTrait = (i: number) =>
    set({ traits: form.traits.filter((_, idx) => idx !== i) });

  const inputRef = React.useRef<HTMLInputElement>(null);
  const [fileError, setFileError] = React.useState<string>();
  const [dragging, setDragging] = React.useState(false);

  const onFile = (file: File | undefined | null) => {
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      setFileError(`That file is ${formatBytes(file.size)} — the limit is ${formatBytes(MAX_UPLOAD_BYTES)} for now.`);
      return;
    }
    const okType =
      file.type.startsWith("image/") ||
      file.type.startsWith("video/") ||
      file.type === "text/html" ||
      /\.html?$/i.test(file.name);
    if (!okType) {
      setFileError("Unsupported file type. Use an image, MP4/WebM video, or HTML.");
      return;
    }
    setFileError(undefined);
    // Revoke the previous preview URL to avoid leaking object URLs.
    if (form.fileUrl) URL.revokeObjectURL(form.fileUrl);
    const mime = file.type || (/\.html?$/i.test(file.name) ? "text/html" : "image/png");
    set({
      fileSelected: true,
      fileName: file.name,
      file,
      fileUrl: URL.createObjectURL(file),
      fileMime: mime,
      mediaType: mediaTypeFromMime(mime),
    });
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      {/* Upload affordance + live preview */}
      <div className="space-y-4">
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_UPLOAD}
          className="sr-only"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            onFile(e.dataTransfer.files?.[0]);
          }}
          className={cn(
            "group relative flex aspect-square w-full flex-col items-center justify-center overflow-hidden rounded-[8px] border text-center transition-all duration-300",
            form.fileSelected
              ? "border-border-bright"
              : "border-dashed border-border hover:border-border-bright hover:bg-surface-2/40",
            dragging && "border-accent/60 bg-accent/5",
          )}
          aria-label={form.fileSelected ? "Replace artwork" : "Select artwork to upload"}
        >
          {form.fileSelected ? (
            <>
              <MediaPreview
                url={form.fileUrl}
                mime={form.fileMime}
                seed={seed}
                genre={form.genre}
                className="absolute inset-0 h-full w-full object-contain bg-surface-2"
              />
              <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-background/90 to-transparent px-3 pb-3 pt-8">
                <span className="font-mono text-[11px] text-foreground/90 truncate">
                  {form.fileName}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-wider text-faint opacity-0 transition-opacity group-hover:opacity-100">
                  Replace
                </span>
              </span>
            </>
          ) : (
            <div className="px-6">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-border text-muted transition-colors group-hover:border-accent/40 group-hover:text-accent">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
                  <path
                    d="M12 16V4m0 0L7 9m5-5l5 5M5 20h14"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <p className="text-sm text-foreground">Drop your work, or tap to choose a file</p>
              <p className="mt-1.5 font-mono text-[11px] text-faint">
                PNG · JPG · GIF · WEBP · SVG · MP4 · HTML · up to {formatBytes(MAX_UPLOAD_BYTES)}
              </p>
            </div>
          )}
        </button>

        {fileError && (
          <p className="font-mono text-[11px] leading-tight text-[#fda4af]">{fileError}</p>
        )}

        {form.fileSelected && form.file && (
          <div className="flex items-center justify-between">
            <Badge tone="muted">{form.mediaType}</Badge>
            <span className="font-mono text-[10px] text-faint">
              {formatBytes(form.file.size)} · will be pinned
            </span>
          </div>
        )}
      </div>

      {/* Metadata */}
      <div className="space-y-5">
        <Field label="Artist name" htmlFor="mint-artist" required>
          <input
            id="mint-artist"
            className={cn(inputCls, artistError && "border-[#fda4af]/60")}
            value={form.artistName}
            onChange={(e) => set({ artistName: e.target.value })}
            onBlur={() => setTouched((t) => ({ ...t, artist: true }))}
            required
            aria-required="true"
            aria-invalid={artistError || undefined}
            aria-describedby={artistError ? "mint-artist-err" : undefined}
            placeholder="Your name or handle"
            autoComplete="off"
          />
          {artistError && (
            <p id="mint-artist-err" className="font-mono text-[11px] text-[#fda4af]">
              Artist name is required.
            </p>
          )}
        </Field>

        <Field label="Title" htmlFor="mint-title" hint="drives the preview" required>
          <input
            id="mint-title"
            className={cn(inputCls, titleError && "border-[#fda4af]/60")}
            value={form.title}
            onChange={(e) => set({ title: e.target.value })}
            onBlur={() => setTouched((t) => ({ ...t, title: true }))}
            required
            aria-required="true"
            aria-invalid={titleError || undefined}
            aria-describedby={titleError ? "mint-title-err" : undefined}
            placeholder="Name this work"
            autoComplete="off"
          />
          {titleError && (
            <p id="mint-title-err" className="font-mono text-[11px] text-[#fda4af]">
              Title is required.
            </p>
          )}
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Media type">
            <div className="flex w-full rounded-[8px] border border-border p-1">
              {MEDIA_TYPES.map((m) => {
                const active = form.mediaType === m.value;
                return (
                  <button
                    key={m.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => set({ mediaType: m.value })}
                    className={cn(
                      "min-h-[40px] flex-1 rounded-[6px] px-2 py-2 font-mono text-[11px] leading-none transition-colors duration-200",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
                      active
                        ? "bg-surface-2 text-foreground"
                        : "text-muted hover:text-foreground",
                    )}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="Genre" htmlFor="mint-genre">
            <div className="relative">
              <select
                id="mint-genre"
                className={cn(inputCls, "appearance-none pr-9")}
                value={form.genre}
                onChange={(e) => set({ genre: e.target.value as Genre })}
              >
                {genres.map((g) => (
                  <option key={g} value={g} className="bg-surface text-foreground">
                    {g}
                  </option>
                ))}
              </select>
              <svg
                viewBox="0 0 16 16"
                className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint"
                fill="none"
                aria-hidden
              >
                <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </Field>
        </div>

        <Field label="Description" htmlFor="mint-desc" hint="optional">
          <textarea
            id="mint-desc"
            className={cn(inputCls, "min-h-[96px] resize-none leading-relaxed")}
            value={form.description}
            onChange={(e) => set({ description: e.target.value })}
            placeholder="What is this work, and what is it meant to outlast?"
            maxLength={1000}
          />
        </Field>

        <Field label="Attributes" hint="optional · filterable traits">
          <div className="space-y-2">
            {form.traits.length > 0 && (
              <ul className="space-y-2">
                {form.traits.map((t, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <input
                      className={cn(inputCls, "flex-1")}
                      value={t.key}
                      onChange={(e) => updateTrait(i, { key: e.target.value })}
                      placeholder="Trait (e.g. Background)"
                      aria-label={`Trait ${i + 1} name`}
                      autoComplete="off"
                    />
                    <span className="font-mono text-faint" aria-hidden>·</span>
                    <input
                      className={cn(inputCls, "flex-1")}
                      value={t.value}
                      onChange={(e) => updateTrait(i, { value: e.target.value })}
                      placeholder="Value (e.g. Nebula)"
                      aria-label={`Trait ${i + 1} value`}
                      autoComplete="off"
                    />
                    <button
                      type="button"
                      onClick={() => removeTrait(i)}
                      aria-label={`Remove trait ${i + 1}`}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] border border-border text-faint transition-colors hover:border-[#fda4af]/50 hover:text-[#fda4af] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                    >
                      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden>
                        <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              onClick={addTrait}
              className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 rounded-[6px] px-1 py-1"
            >
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden>
                <path d="M8 3.5v9M3.5 8h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              {form.traits.length === 0 ? "Add an attribute" : "Add another"}
            </button>
          </div>
        </Field>
      </div>
    </div>
  );
}
