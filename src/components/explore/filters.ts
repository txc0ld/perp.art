/**
 * Shared client-side filter/sort logic for Explore.
 * Pure functions + types - no React, no server data. Imported by the
 * client filter shell and its child controls.
 */
import type { Token, Genre, Chain } from "@/lib/types";
import { CHAINS as CHAIN_META, CHAIN_ORDER, getChainMeta } from "@/lib/chains";
import { GENRES } from "@/lib/catalog-constants";

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

/** Every supported chain, in display order — used for chip labels. */
export const CHAINS: { value: Chain; label: string }[] = CHAIN_ORDER.map((c) => ({
  value: c,
  label: CHAIN_META[c].short,
}));

/**
 * Facets actually present in the current (live) token set. The Explore filter
 * rail renders ONLY these so that no facet can silently empty the grid — e.g.
 * with only Base tokens live, the chain group shows just "Base", and the genre
 * group shows just the genres that exist on-chain.
 */
export interface ExploreFacets {
  genres: Genre[];
  chains: { value: Chain; label: string }[];
}

export function facetsFromTokens(tokens: Token[]): ExploreFacets {
  const genreSet = new Set<Genre>();
  const chainSet = new Set<Chain>();
  for (const t of tokens) {
    genreSet.add(t.genre);
    chainSet.add(t.chain);
  }
  // Preserve the canonical display order for both groups.
  const genres = GENRES.filter((g) => genreSet.has(g));
  const chains = CHAIN_ORDER.filter((c) => chainSet.has(c)).map((c) => ({
    value: c,
    label: getChainMeta(c).short,
  }));
  return { genres, chains };
}

/** Self-contained search over the live token set (no mock dependency). */
export function searchLiveTokens(tokens: Token[], query: string): Token[] {
  const q = query.trim().toLowerCase();
  if (!q) return tokens;
  return tokens.filter((t) => {
    const hay = [t.title, t.collectionSlug, t.genre, t.artistHandle, t.owner]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}

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

export function applyFilters(tokens: Token[], f: ExploreFilters): Token[] {
  // Search is applied here over the live set (no external mock lookup).
  const searched = searchLiveTokens(tokens, f.q);

  let out = searched.filter((t) => {
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

  const genres = many(sp.genre).filter((g): g is Genre => (GENRES as string[]).includes(g));
  const chains = many(sp.chain).filter((c): c is Chain => (CHAIN_ORDER as string[]).includes(c));
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
