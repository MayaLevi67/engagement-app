import type { Priority, TaskCategory } from '@prisma/client';
import { priorityBoostFor } from './priority-map';

export interface ConceptRange {
  min: number;
  max: number;
}

export interface OptimizeInput {
  budgetTotal: number;
  baseline: Partial<Record<TaskCategory, number>>;
  priorities: Priority[];
  conceptRanges: Partial<Record<TaskCategory, ConceptRange>>;
  committed: Partial<Record<TaskCategory, number>>;
  pinned: Partial<Record<TaskCategory, number>>;
}

export interface CategoryAllocation {
  category: TaskCategory;
  recommended: number;
  committed: number;
  open: number;
  ceiling: number | null;
  pinned: boolean;
}

export type BudgetFeedback =
  | { type: 'ok' }
  | { type: 'committed_overrun'; overrun: number }
  | { type: 'over_budget'; shortfall: number; underfunded: TaskCategory[] }
  | { type: 'headroom'; unallocated: number };

export interface OptimizeResult {
  perCategory: CategoryAllocation[];
  distributable: number;
  feedback: BudgetFeedback;
}

/** Largest-remainder rounding: turn fractional `raw` into ints summing to `total`. */
function roundToTotal(cats: TaskCategory[], raw: Record<string, number>, total: number): Record<string, number> {
  const rows = cats.map((c) => ({ c, floor: Math.floor(raw[c]), frac: raw[c] - Math.floor(raw[c]) }));
  const out: Record<string, number> = {};
  let used = 0;
  for (const r of rows) { out[r.c] = r.floor; used += r.floor; }
  let remainder = total - used;
  rows.sort((a, b) => b.frac - a.frac);
  for (let i = 0; i < rows.length && remainder > 0; i++) { out[rows[i].c] += 1; remainder -= 1; }
  if (remainder < 0) {
    rows.sort((a, b) => a.frac - b.frac);
    for (let i = 0; i < rows.length && remainder < 0; i++) {
      if (out[rows[i].c] > 0) { out[rows[i].c] -= 1; remainder += 1; }
    }
  }
  return out;
}

export function optimizeBudget(input: OptimizeInput): OptimizeResult {
  const { budgetTotal } = input;
  const committed = input.committed ?? {};
  const pinned = input.pinned ?? {};
  const baseline = input.baseline ?? {};
  const conceptRanges = input.conceptRanges ?? {};

  // Category universe: active baseline ∪ committed>0 ∪ pinned (money is never hidden).
  const universe = new Set<TaskCategory>();
  (Object.keys(baseline) as TaskCategory[]).forEach((c) => universe.add(c));
  (Object.keys(committed) as TaskCategory[]).forEach((c) => { if ((committed[c] ?? 0) > 0) universe.add(c); });
  (Object.keys(pinned) as TaskCategory[]).forEach((c) => universe.add(c));

  const com = (c: TaskCategory) => Math.max(0, committed[c] ?? 0);
  const ceilingTotal = (c: TaskCategory): number | null => {
    const r = conceptRanges[c];
    return r ? r.max : null;
  };

  const cats = [...universe];
  const pinnedCats = cats.filter((c) => pinned[c] != null);
  const nonPinned = cats.filter((c) => pinned[c] == null);

  const pinnedAlloc: Record<string, number> = {};
  let sumPinned = 0;
  for (const c of pinnedCats) {
    const v = Math.max(pinned[c] ?? 0, com(c));
    pinnedAlloc[c] = v;
    sumPinned += v;
  }

  const committedNonPinned = nonPinned.reduce((s, c) => s + com(c), 0);
  let R = budgetTotal - sumPinned - committedNonPinned;

  const openInt: Record<string, number> = {};
  for (const c of nonPinned) openInt[c] = 0;
  let feedback: BudgetFeedback = { type: 'ok' };

  if (R < 0) {
    feedback = { type: 'committed_overrun', overrun: sumPinned + committedNonPinned - budgetTotal };
    R = 0;
  } else {
    const floorOpen: Record<string, number> = {};
    const ceilOpen: Record<string, number> = {};
    for (const c of nonPinned) {
      const r = conceptRanges[c];
      const maxAbove = r ? Math.max(0, r.max - com(c)) : Infinity;
      const minAbove = r ? Math.max(0, r.min - com(c)) : 0;
      ceilOpen[c] = maxAbove;
      floorOpen[c] = Math.min(minAbove, maxAbove);
    }
    const sumFloors = nonPinned.reduce((s, c) => s + floorOpen[c], 0);

    if (sumFloors >= R) {
      // Can't fund all concept-minimums → proportional trim to fit R.
      const scale = sumFloors > 0 ? R / sumFloors : 0;
      const raw: Record<string, number> = {};
      for (const c of nonPinned) raw[c] = floorOpen[c] * scale;
      Object.assign(openInt, roundToTotal(nonPinned, raw, R));
      const shortfall = Math.round(sumFloors - R);
      const underfunded = nonPinned.filter((c) => openInt[c] < floorOpen[c] - 0.5);
      feedback = shortfall > 0 ? { type: 'over_budget', shortfall, underfunded } : { type: 'ok' };
    } else {
      // Fund floors, water-fill the leftover by weight, capped at ceilings.
      const openF: Record<string, number> = {};
      for (const c of nonPinned) openF[c] = floorOpen[c];
      let leftover = R - sumFloors;
      const weight: Record<string, number> = {};
      for (const c of nonPinned) weight[c] = (baseline[c] ?? 0) * priorityBoostFor(c, input.priorities);
      const free = new Set(nonPinned.filter((c) => openF[c] < ceilOpen[c] && weight[c] > 0));

      while (leftover > 1e-6 && free.size > 0) {
        const totalW = [...free].reduce((s, c) => s + weight[c], 0);
        if (totalW <= 0) break;
        let capped = false;
        for (const c of [...free]) {
          const share = (leftover * weight[c]) / totalW;
          const room = ceilOpen[c] - openF[c];
          if (share >= room) { openF[c] = ceilOpen[c]; leftover -= room; free.delete(c); capped = true; }
        }
        if (!capped) {
          for (const c of free) openF[c] += (leftover * weight[c]) / totalW;
          leftover = 0;
        }
      }

      const distributed = Math.round(R - leftover);
      Object.assign(openInt, roundToTotal(nonPinned, openF, distributed));
      if (leftover > 0.5) feedback = { type: 'headroom', unallocated: Math.round(leftover) };
    }
  }

  const perCategory: CategoryAllocation[] = [
    ...pinnedCats.map((c): CategoryAllocation => ({
      category: c,
      recommended: pinnedAlloc[c],
      committed: com(c),
      open: Math.max(0, pinnedAlloc[c] - com(c)),
      ceiling: ceilingTotal(c),
      pinned: true,
    })),
    ...nonPinned.map((c): CategoryAllocation => ({
      category: c,
      recommended: com(c) + (openInt[c] ?? 0),
      committed: com(c),
      open: openInt[c] ?? 0,
      ceiling: ceilingTotal(c),
      pinned: false,
    })),
  ];

  return { perCategory, distributable: Math.max(0, R), feedback };
}
