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

  it('respects the limit and is deterministic', () => {
    const r = recommendVendors([v({ id: 'a' }), v({ id: 'b' }), v({ id: 'c' })], {}, 2);
    expect(r).toHaveLength(2);
    expect(recommendVendors([v({ id: 'a' }), v({ id: 'b' }), v({ id: 'c' })], {}, 2)).toEqual(r);
  });
});
