/**
 * Shared client-side filter/sort logic for Explore.
 * Pure functions + types - no React, no server data. Imported by the
 * client filter shell and its child controls.
 */
import type { Token, Genre, Chain } from "@/lib/types";

export type StorageKind = "arweave" | "irys" | "onchain-only";
export type StatusKind = "listed" | "unlisted";
export type SortKey = "recent" | "price-asc" | "price-desc" | "permanent";
export type Density = "comfortable" | "compact";

export interface ExploreFilters {
  q: string;
  genres: Genre[];
  chains: Chain[];
  storage: StorageKind[];
  status: StatusKind[];
  lockedOnly: boolean;
  minEth: string;
  maxEth: string;
  sort: SortKey;
}

export const EMPTY_FILTERS: ExploreFilters = {
  q: "",
  genres: [],
  chains: [],
  storage: [],
  status: [],
  lockedOnly: false,
  minEth: "",
  maxEth: "",
  sort: "recent",
};

export const CHAINS: { value: Chain; label: string }[] = [
  { value: "ethereum", label: "Ethereum" },
  { value: "base", label: "Base" },
];

export const STORAGE_OPTIONS: { value: StorageKind; label: string }[] = [
  { value: "arweave", label: "Has Arweave" },
  { value: "irys", label: "Has Irys" },
  { value: "onchain-only", label: "Onchain-only" },
];

export const STATUS_OPTIONS: { value: StatusKind; label: string }[] = [
  { value: "listed", label: "Buy now" },
  { value: "unlisted", label: "Not listed" },
];

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "recent", label: "Recently listed" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "permanent", label: "Most permanent" },
];

function verifiedShardCount(t: Token): number {
  return t.permanence.shards.filter((s) => s.status === "verified").length;
}

function hasBackend(t: Token, backend: "arweave" | "irys"): boolean {
  return t.permanence.shards.some((s) => s.backend === backend && s.status === "verified");
}

/** A token is "onchain-only" if its only verified persistence is the mandatory onchain shard. */
function isOnchainOnly(t: Token): boolean {
  const verifiedNonOnchain = t.permanence.shards.filter(
    (s) => s.status === "verified" && s.backend !== "onchain" && s.backend !== "cdn",
  );
  return verifiedNonOnchain.length === 0;
}

/** Price used for sorting/range - listing price, else 0 (treated as unlisted). */
function listingPrice(t: Token): number | undefined {
  return t.listing?.priceEth;
}

export function applyFilters(tokens: Token[], searchHits: Token[], f: ExploreFilters): Token[] {
  // searchHits is the pre-computed result of searchTokens(q) passed from the shell
  // when q is non-empty; otherwise it equals the full list.
  const allowedIds = f.q.trim() ? new Set(searchHits.map((t) => t.id)) : null;

  let out = tokens.filter((t) => {
    if (allowedIds && !allowedIds.has(t.id)) return false;
    if (f.genres.length && !f.genres.includes(t.genre)) return false;
    if (f.chains.length && !f.chains.includes(t.chain)) return false;

    if (f.storage.length) {
      const ok = f.storage.some((s) => {
        if (s === "arweave") return hasBackend(t, "arweave");
        if (s === "irys") return hasBackend(t, "irys");
        return isOnchainOnly(t);
      });
      if (!ok) return false;
    }

    if (f.status.length) {
      const listed = Boolean(t.listing);
      const ok = f.status.some((s) => (s === "listed" ? listed : !listed));
      if (!ok) return false;
    }

    if (f.lockedOnly && !t.permanence.locked) return false;

    const min = parseFloat(f.minEth);
    const max = parseFloat(f.maxEth);
    if (!Number.isNaN(min) || !Number.isNaN(max)) {
      const p = listingPrice(t);
      if (p === undefined) return false; // price filters imply a listed work
      if (!Number.isNaN(min) && p < min) return false;
      if (!Number.isNaN(max) && p > max) return false;
    }

    return true;
  });

  out = sortTokens(out, f.sort);
  return out;
}

export function sortTokens(tokens: Token[], sort: SortKey): Token[] {
  const arr = [...tokens];
  switch (sort) {
    case "price-asc":
      return arr.sort((a, b) => (listingPrice(a) ?? Infinity) - (listingPrice(b) ?? Infinity));
    case "price-desc":
      return arr.sort((a, b) => (listingPrice(b) ?? -Infinity) - (listingPrice(a) ?? -Infinity));
    case "permanent":
      return arr.sort((a, b) => verifiedShardCount(b) - verifiedShardCount(a));
    case "recent":
    default:
      // Listed first (recently-listed surface), then by most recent provenance.
      return arr.sort((a, b) => {
        const al = a.listing ? 1 : 0;
        const bl = b.listing ? 1 : 0;
        if (al !== bl) return bl - al;
        const at = Date.parse(a.provenance[0]?.timestamp ?? "");
        const bt = Date.parse(b.provenance[0]?.timestamp ?? "");
        return (bt || 0) - (at || 0);
      });
  }
}

/** Active filter chips for the removable-pill row. */
export interface ActiveChip {
  key: string;
  label: string;
  clear: (f: ExploreFilters) => ExploreFilters;
}

export function activeChips(f: ExploreFilters): ActiveChip[] {
  const chips: ActiveChip[] = [];

  for (const g of f.genres) {
    chips.push({ key: `genre:${g}`, label: g, clear: (s) => ({ ...s, genres: s.genres.filter((x) => x !== g) }) });
  }
  for (const c of f.chains) {
    const label = CHAINS.find((x) => x.value === c)?.label ?? c;
    chips.push({ key: `chain:${c}`, label, clear: (s) => ({ ...s, chains: s.chains.filter((x) => x !== c) }) });
  }
  for (const s of f.storage) {
    const label = STORAGE_OPTIONS.find((x) => x.value === s)?.label ?? s;
    chips.push({ key: `storage:${s}`, label, clear: (st) => ({ ...st, storage: st.storage.filter((x) => x !== s) }) });
  }
  for (const s of f.status) {
    const label = STATUS_OPTIONS.find((x) => x.value === s)?.label ?? s;
    chips.push({ key: `status:${s}`, label, clear: (st) => ({ ...st, status: st.status.filter((x) => x !== s) }) });
  }
  if (f.lockedOnly) {
    chips.push({ key: "locked", label: "Locked only", clear: (s) => ({ ...s, lockedOnly: false }) });
  }
  if (f.minEth.trim()) {
    chips.push({ key: "min", label: `Min ${f.minEth} ETH`, clear: (s) => ({ ...s, minEth: "" }) });
  }
  if (f.maxEth.trim()) {
    chips.push({ key: "max", label: `Max ${f.maxEth} ETH`, clear: (s) => ({ ...s, maxEth: "" }) });
  }
  if (f.q.trim()) {
    chips.push({ key: "q", label: `"${f.q.trim()}"`, clear: (s) => ({ ...s, q: "" }) });
  }
  return chips;
}

/** Build initial filter state from URL search params (server passes a plain object). */
export function filtersFromSearchParams(sp: Record<string, string | string[] | undefined>): ExploreFilters {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const many = (v: string | string[] | undefined): string[] =>
    v === undefined ? [] : Array.isArray(v) ? v.flatMap((x) => x.split(",")) : v.split(",");

  const validGenres: Genre[] = ["Generative", "Glitch", "Photography", "Pixel", "AI", "3D", "Abstract"];
  const genres = many(sp.genre).filter((g): g is Genre => validGenres.includes(g as Genre));
  const chains = many(sp.chain).filter((c): c is Chain => c === "ethereum" || c === "base");
  const storage = many(sp.storage).filter((s): s is StorageKind =>
    s === "arweave" || s === "irys" || s === "onchain-only",
  );
  const status = many(sp.status).filter((s): s is StatusKind => s === "listed" || s === "unlisted");
  const sortRaw = one(sp.sort);
  const sort: SortKey =
    sortRaw === "price-asc" || sortRaw === "price-desc" || sortRaw === "permanent" ? sortRaw : "recent";

  return {
    q: one(sp.q),
    genres,
    chains,
    storage,
    status,
    lockedOnly: one(sp.locked) === "1" || one(sp.locked) === "true",
    minEth: one(sp.min),
    maxEth: one(sp.max),
    sort,
  };
}
