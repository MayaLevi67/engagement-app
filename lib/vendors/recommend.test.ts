import { describe, it, expect } from 'vitest';
import { recommendVendors, type RecommendCandidate } from './recommend';

const v = (over: Partial<RecommendCandidate>): RecommendCandidate => ({
  id: 'x', category: 'PHOTOGRAPHY', city: 'Tel Aviv', priceMin: 5000, priceMax: 10000,
  verified: false, isPremium: false, sortOrder: 0, ...over,
});

describe('recommendVendors', () => {
  it('filters to the requested category', () => {
    const r = recommendVendors(
      [v({ id: 'a', category: 'PHOTOGRAPHY' }), v({ id: 'b', category: 'MUSIC' })],
      { category: 'PHOTOGRAPHY' }, 10,
    );
    expect(r.map((x) => x.id)).toEqual(['a']);
  });

  it('ranks a city match above a non-match', () => {
    const r = recommendVendors(
      [v({ id: 'far', city: 'Eilat' }), v({ id: 'near', city: 'Tel Aviv' })],
      { city: 'Tel Aviv' }, 10,
    );
    expect(r[0].id).toBe('near');
  });

  it('boosts a price-fit overlap', () => {
    const r = recommendVendors(
      [v({ id: 'over', priceMin: 50000, priceMax: 80000 }), v({ id: 'fits', priceMin: 5000, priceMax: 9000 })],
      { budgetFit: { min: 4000, max: 12000 } }, 10,
    );
    expect(r[0].id).toBe('fits');
  });

  it('uses verified then premium then sortOrder as tiebreaks', () => {
    const r = recommendVendors(
      [v({ id: 'plain', sortOrder: 5 }), v({ id: 'verif', verified: true }), v({ id: 'prem', isPremium: true })],
      {}, 10,
    );
    expect(r.map((x) => x.id)).toEqual(['verif', 'prem', 'plain']);
  });

  it('scores an open (null) price bound against a null-topped budget fit', () => {
    // Production shape: vendorBudgetFit yields { min: null, max: budget }.
    const r = recommendVendors(
      [
        v({ id: 'expensive', priceMin: 50000, priceMax: 80000 }),
        v({ id: 'open', priceMin: null, priceMax: 8000 }),
      ],
      { budgetFit: { min: null, max: 12000 } }, 10,
    );
    expect(r[0].id).toBe('open');
    expect(r[0].score).toBe(50); // price-fit overlap only
    expect(r[1].score).toBe(0); // 50000 floor is above the 12000 ceiling — no overlap
  });

  it('locks the numeric scoring constants (city+budget+verified+premium = 180)', () => {
    const r = recommendVendors(
      [v({ id: 'top', city: 'Tel Aviv', priceMin: 5000, priceMax: 10000, verified: true, isPremium: true })],
      { city: 'Tel Aviv', budgetFit: { min: 4000, max: 12000 } }, 10,
    );
    expect(r[0].score).toBe(180); // 100 city + 50 budget + 20 verified + 10 premium
  });

  it('respects the limit and is deterministic', () => {
    const r = recommendVendors([v({ id: 'a' }), v({ id: 'b' }), v({ id: 'c' })], {}, 2);
    expect(r).toHaveLength(2);
    expect(recommendVendors([v({ id: 'a' }), v({ id: 'b' }), v({ id: 'c' })], {}, 2)).toEqual(r);
  });
});
