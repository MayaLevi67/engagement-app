import type { TaskCategory } from '@prisma/client';

export interface RecommendCandidate {
  id: string;
  category: TaskCategory;
  city: string | null;
  priceMin: number | null;
  priceMax: number | null;
  verified: boolean;
  isPremium: boolean;
  sortOrder: number;
}

export interface RecommendCriteria {
  category?: TaskCategory;
  city?: string | null;
  budgetFit?: { min: number | null; max: number | null } | null;
}

export interface RankedVendor {
  id: string;
  score: number;
}

function rangesOverlap(
  aMin: number | null, aMax: number | null, bMin: number | null, bMax: number | null,
): boolean {
  const a1 = aMin ?? 0;
  const a2 = aMax ?? Number.POSITIVE_INFINITY;
  const b1 = bMin ?? 0;
  const b2 = bMax ?? Number.POSITIVE_INFINITY;
  return a1 <= b2 && a2 >= b1;
}

function scoreVendor(v: RecommendCandidate, c: RecommendCriteria): number {
  let score = 0;
  if (c.city && v.city && v.city.trim().toLowerCase() === c.city.trim().toLowerCase()) score += 100;
  if (c.budgetFit && rangesOverlap(v.priceMin, v.priceMax, c.budgetFit.min, c.budgetFit.max)) score += 50;
  if (v.verified) score += 20;
  if (v.isPremium) score += 10;
  return score;
}

/** Deterministic, explainable ranking: filter by category, score, then sortOrder/id tiebreak. */
export function recommendVendors(
  candidates: RecommendCandidate[],
  criteria: RecommendCriteria,
  limit: number,
): RankedVendor[] {
  const filtered = candidates.filter((v) => criteria.category == null || v.category === criteria.category);
  const scored = filtered.map((v) => ({ v, score: scoreVendor(v, criteria) }));
  scored.sort(
    (a, b) =>
      b.score - a.score ||
      a.v.sortOrder - b.v.sortOrder ||
      (a.v.id < b.v.id ? -1 : a.v.id > b.v.id ? 1 : 0),
  );
  return scored.slice(0, limit).map((x) => ({ id: x.v.id, score: x.score }));
}
