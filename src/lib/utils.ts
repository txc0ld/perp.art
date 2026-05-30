/** Tiny classname combiner (no clsx dependency needed). */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/** Deterministic 32-bit hash from a string - drives all generated art/avatars. */
export function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Seeded PRNG (mulberry32) for reproducible generated visuals. */
export function seededRandom(seed: string): () => number {
  let a = hashSeed(seed);
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shortAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function shortHash(hash: string, len = 8): string {
  if (!hash) return hash;
  return hash.length > len * 2 + 1 ? `${hash.slice(0, len)}…${hash.slice(-len)}` : hash;
}

/** ETH with the right precision; raw mono price form. */
export function formatEth(value: number): string {
  if (value >= 100) return value.toFixed(1);
  if (value >= 1) return value.toFixed(2);
  return value.toFixed(3);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Compact relative time, e.g. "3d ago", "2mo ago". */
export function relativeTime(iso: string, now = Date.parse("2026-05-30T00:00:00Z")): string {
  const then = Date.parse(iso);
  const diff = Math.max(0, now - then);
  const min = 60_000, hr = 60 * min, day = 24 * hr, mo = 30 * day, yr = 365 * day;
  if (diff < hr) return `${Math.max(1, Math.round(diff / min))}m ago`;
  if (diff < day) return `${Math.round(diff / hr)}h ago`;
  if (diff < mo) return `${Math.round(diff / day)}d ago`;
  if (diff < yr) return `${Math.round(diff / mo)}mo ago`;
  return `${(diff / yr).toFixed(1)}y ago`;
}

export function bpsToPct(bps: number): string {
  return `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 1)}%`;
}

/** Perpetual protocol fee (PRD §8.4) - displayed at point of sale. */
export const PROTOCOL_FEE_BPS = 225; // 2.25%

export function feeBreakdown(priceEth: number, royaltyBps: number) {
  const protocol = (priceEth * PROTOCOL_FEE_BPS) / 10_000;
  const royalty = (priceEth * royaltyBps) / 10_000;
  const toSeller = priceEth - protocol - royalty;
  return { price: priceEth, protocol, royalty, toSeller };
}
