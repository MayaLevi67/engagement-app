import { describe, it, expect } from 'vitest';
import { optimizeBudget, type OptimizeInput } from './optimize';

const base = (over: Partial<OptimizeInput>): OptimizeInput => ({
  budgetTotal: 100000,
  baseline: { VENUE: 50, CATERING: 50 },
  priorities: [],
  conceptRanges: {},
  committed: {},
  pinned: {},
  ...over,
});

function alloc(result: ReturnType<typeof optimizeBudget>, category: string) {
  return result.perCategory.find((p) => p.category === category)!;
}

describe('optimizeBudget', () => {
  it('splits by baseline weight when there are no other signals', () => {
    const r = optimizeBudget(base({}));
    expect(alloc(r, 'VENUE').recommended).toBe(50000);
    expect(alloc(r, 'CATERING').recommended).toBe(50000);
    expect(r.feedback).toEqual({ type: 'ok' });
  });

  it('applies the priority boost (CATERING gets 1.5× weight)', () => {
    // weights VENUE=50, CATERING=50*1.5=75 → total 125 → VENUE 40k, CATERING 60k
    const r = optimizeBudget(base({ priorities: ['FOOD'] }));
    expect(alloc(r, 'VENUE').recommended).toBe(40000);
    expect(alloc(r, 'CATERING').recommended).toBe(60000);
  });

  it('freezes committed money and only redistributes the open remainder', () => {
    // CATERING has 30k committed on DONE tasks. R = 100k − 30k = 70k, split by weight 50/50 → 35k each open.
    const r = optimizeBudget(base({ committed: { CATERING: 30000 } }));
    expect(alloc(r, 'CATERING').committed).toBe(30000);
    expect(alloc(r, 'CATERING').open).toBe(35000);
    expect(alloc(r, 'CATERING').recommended).toBe(65000);
    expect(alloc(r, 'VENUE').recommended).toBe(35000);
  });

  it('excludes a pinned category from redistribution', () => {
    // Pin VENUE at 20k. R = 100k − 20k = 80k over CATERING only → CATERING 80k.
    const r = optimizeBudget(base({ pinned: { VENUE: 20000 } }));
    expect(alloc(r, 'VENUE').recommended).toBe(20000);
    expect(alloc(r, 'VENUE').pinned).toBe(true);
    expect(alloc(r, 'CATERING').recommended).toBe(80000);
  });

  it('renders max(pin, committed) when committed exceeds the pin', () => {
    // Pin VENUE at 20k but 26k already committed there → shows 26k.
    const r = optimizeBudget(base({ pinned: { VENUE: 20000 }, committed: { VENUE: 26000 } }));
    expect(alloc(r, 'VENUE').recommended).toBe(26000);
  });

  it('caps a category at its concept ceiling and redistributes the excess', () => {
    // CATERING capped at 20k max. Weight would give 50k; excess 30k flows to VENUE → VENUE 80k, CATERING 20k.
    const r = optimizeBudget(base({ conceptRanges: { CATERING: { min: 0, max: 20000 } } }));
    expect(alloc(r, 'CATERING').recommended).toBe(20000);
    expect(alloc(r, 'VENUE').recommended).toBe(80000);
  });

  it('reports headroom when every category caps out below the budget', () => {
    const r = optimizeBudget(base({
      budgetTotal: 100000,
      conceptRanges: { VENUE: { min: 0, max: 30000 }, CATERING: { min: 0, max: 30000 } },
    }));
    expect(alloc(r, 'VENUE').recommended).toBe(30000);
    expect(alloc(r, 'CATERING').recommended).toBe(30000);
    expect(r.feedback).toEqual({ type: 'headroom', unallocated: 40000 });
  });

  it('reports over_budget when the concept minimums exceed the budget', () => {
    // Floors 40k + 40k = 80k > R 60k → proportional trim to 30k each, shortfall 20k.
    const r = optimizeBudget(base({
      budgetTotal: 60000,
      conceptRanges: { VENUE: { min: 40000, max: 90000 }, CATERING: { min: 40000, max: 90000 } },
    }));
    expect(r.feedback.type).toBe('over_budget');
    if (r.feedback.type === 'over_budget') {
      expect(r.feedback.shortfall).toBe(20000);
      expect(r.feedback.underfunded.sort()).toEqual(['CATERING', 'VENUE']);
    }
    expect(alloc(r, 'VENUE').recommended).toBe(30000);
    expect(alloc(r, 'CATERING').recommended).toBe(30000);
  });

  it('reports committed_overrun when committed alone exceeds the budget', () => {
    const r = optimizeBudget(base({ budgetTotal: 40000, committed: { VENUE: 30000, CATERING: 20000 } }));
    expect(r.feedback).toEqual({ type: 'committed_overrun', overrun: 10000 });
    // Never produces a negative allocation — each category sits at its committed floor.
    expect(alloc(r, 'VENUE').recommended).toBe(30000);
    expect(alloc(r, 'CATERING').recommended).toBe(20000);
  });

  it('water-fills the open remainder above committed floors using priority-boosted weights', () => {
    // VENUE has 20k committed. R = 100k − 20k = 80k. Weights VENUE=50, CATERING=50*1.5=75 (total 125)
    // → open VENUE 32k, CATERING 48k. recommended VENUE 52k, CATERING 48k, summing to the full budget.
    const r = optimizeBudget(base({ priorities: ['FOOD'], committed: { VENUE: 20000 } }));
    expect(alloc(r, 'VENUE').recommended).toBe(52000);
    expect(alloc(r, 'CATERING').recommended).toBe(48000);
    expect(r.perCategory.reduce((s, p) => s + p.recommended, 0)).toBe(100000);
    expect(r.feedback).toEqual({ type: 'ok' });
  });

  it('always sums the category recommendations to the budget when feasible (rounding case)', () => {
    // 3-way split of 100000 by equal weight → 33334/33333/33333.
    const r = optimizeBudget(base({
      budgetTotal: 100000,
      baseline: { VENUE: 1, CATERING: 1, MUSIC: 1 },
    }));
    const sum = r.perCategory.reduce((s, p) => s + p.recommended, 0);
    expect(sum).toBe(100000);
  });
});
