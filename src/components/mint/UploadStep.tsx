"use client";

import * as React from "react";
import type { Genre, MediaType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { GenerativeArt } from "@/components/art/GenerativeArt";
import { MonoLabel, Badge } from "@/components/ui";
import type { MintForm } from "./state";
import { previewSeed } from "./state";

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
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={htmlFor} className="flex items-baseline justify-between">
        <MonoLabel>{label}</MonoLabel>
        {hint && <span className="font-mono text-[10px] text-faint">{hint}</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full rounded-[8px] border border-border bg-surface-2 px-3.5 py-2.5 text-sm text-foreground " +
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

  const simulateSelect = () => {
    const names = [
      "untitled-01.png",
      "exposure-final.tiff",
      "render_4k.webp",
      "field-study.png",
    ];
    set({
      fileSelected: true,
      fileName: names[Math.floor(Math.random() * names.length)],
    });
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      {/* Upload affordance + live preview */}
      <div className="space-y-4">
        <button
          type="button"
          onClick={simulateSelect}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            simulateSelect();
          }}
          className={cn(
            "group relative flex aspect-square w-full flex-col items-center justify-center overflow-hidden rounded-[8px] border text-center transition-all duration-300",
            form.fileSelected
              ? "border-border-bright"
              : "border-dashed border-border hover:border-border-bright hover:bg-surface-2/40",
          )}
          aria-label={form.fileSelected ? "Replace artwork" : "Select artwork to upload"}
        >
          {form.fileSelected ? (
            <>
              <GenerativeArt
                seed={seed}
                genre={form.genre}
                className="absolute inset-0 h-full w-full"
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
              <p className="text-sm text-foreground">Drop artwork or click to select</p>
              <p className="mt-1.5 font-mono text-[11px] text-faint">
                PNG · TIFF · WEBP · MP4 · HTML
              </p>
            </div>
          )}
        </button>

        {form.fileSelected && (
          <div className="flex items-center justify-between">
            <Badge tone="muted">Preview · seed-locked</Badge>
            <span className="font-mono text-[10px] text-faint">
              {form.genre.toLowerCase()} render
            </span>
          </div>
        )}
      </div>

      {/* Metadata */}
      <div className="space-y-5">
        <Field label="Artist name" htmlFor="mint-artist">
          <input
            id="mint-artist"
            className={inputCls}
            value={form.artistName}
            onChange={(e) => set({ artistName: e.target.value })}
            placeholder="Your name or handle"
            autoComplete="off"
          />
        </Field>

        <Field label="Title" htmlFor="mint-title" hint="drives the preview">
          <input
            id="mint-title"
            className={inputCls}
            value={form.title}
            onChange={(e) => set({ title: e.target.value })}
            placeholder="Name this work"
            autoComplete="off"
          />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Media type">
            <div className="grid grid-cols-3 gap-1.5">
              {MEDIA_TYPES.map((m) => {
                const active = form.mediaType === m.value;
                return (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => set({ mediaType: m.value })}
                    className={cn(
                      "rounded-[8px] border px-2 py-2 font-mono text-[11px] transition-colors duration-200",
                      active
                        ? "border-border-bright bg-surface-2 text-foreground"
                        : "border-border text-muted hover:border-border-bright hover:text-foreground",
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
          />
        </Field>
      </div>
    </div>
  );
}
