/**
 * Permanence Score — a data-backed grade for how durable a token is, computed
 * purely from a Token's on-chain permanence status. No fabricated data; works
 * identically against live indexed tokens.
 */
import type { Token } from "./types";

export interface PermanenceScore {
  score: number;       // 0..100
  grade: "A+" | "A" | "B" | "C" | "D";
  redundancy: number;  // verified non-onchain copies
  factors: Array<{ label: string; ok: boolean; detail?: string }>;
}

export function permanenceScore(t: Token): PermanenceScore {
  const p = t.permanence;
  const verified = p.shards.filter((s) => s.status === "verified");
  const redundancy = verified.filter((s) => s.backend !== "onchain").length;

  let score = 0;
  if (p.onchainProofConfigured) score += 50; // the guarantee itself
  if (p.contentHashMatches) score += 15;
  score += Math.min(redundancy, 4) * 6;      // up to 24 for redundancy
  if (p.locked) score += 11;
  score = Math.min(100, score);

  const grade: PermanenceScore["grade"] =
    score >= 96 ? "A+" : score >= 88 ? "A" : score >= 78 ? "B" : score >= 65 ? "C" : "D";

  return {
    score,
    grade,
    redundancy,
    factors: [
      { label: "Onchain STATE proof (SSTORE2)", ok: p.onchainProofConfigured },
      { label: "Content hash matches record", ok: p.contentHashMatches },
      { label: "Redundant permanent copies", ok: redundancy >= 3, detail: `${redundancy} of 3+` },
      { label: "Shards locked (immutable)", ok: p.locked },
    ],
  };
}

/** Aggregate permanence health across a set of tokens (a wallet's holdings). */
export function portfolioPermanence(tokens: Token[]) {
  if (tokens.length === 0) return { avg: 0, grade: "A+" as const, allPermanent: true, atRisk: 0 };
  const scores = tokens.map((t) => permanenceScore(t));
  const avg = Math.round(scores.reduce((n, s) => n + s.score, 0) / scores.length);
  const atRisk = scores.filter((s) => !tokens[0] || s.grade === "C" || s.grade === "D").length;
  const grade = avg >= 96 ? "A+" : avg >= 88 ? "A" : avg >= 78 ? "B" : avg >= 65 ? "C" : "D";
  const allPermanent = tokens.every((t) => t.permanence.onchainProofConfigured && t.permanence.contentHashMatches);
  return { avg, grade, allPermanent, atRisk };
}
