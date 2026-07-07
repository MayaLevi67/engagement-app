import { describe, it, expect } from 'vitest';
import { estimateGifts } from './gifts';

describe('estimateGifts', () => {
  it('multiplies average by guest count', () => {
    expect(estimateGifts({ avgGiftPerGuest: 500, guestCount: 200, budgetTotal: 150000 }))
      .toEqual({ estimatedGifts: 100000, delta: -50000 });
  });

  it('reports a surplus as a positive delta', () => {
    expect(estimateGifts({ avgGiftPerGuest: 800, guestCount: 200, budgetTotal: 120000 }))
      .toEqual({ estimatedGifts: 160000, delta: 40000 });
  });

  it('returns a null delta when no budget is set', () => {
    expect(estimateGifts({ avgGiftPerGuest: 500, guestCount: 100, budgetTotal: null }))
      .toEqual({ estimatedGifts: 50000, delta: null });
  });

  it('treats missing inputs as zero', () => {
    expect(estimateGifts({ avgGiftPerGuest: null, guestCount: 200, budgetTotal: 100000 }))
      .toEqual({ estimatedGifts: 0, delta: -100000 });
  });
});
