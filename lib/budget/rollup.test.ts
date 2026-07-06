import { describe, it, expect } from 'vitest';
import { rollupTasks, sumConceptRanges } from './rollup';

const task = (over: Partial<Parameters<typeof rollupTasks>[0][number]>) => ({
  category: 'MUSIC' as const, status: 'OPEN' as const,
  amountPaid: null as number | null, estimatedCost: null as number | null,
  deletedAt: null as Date | null, ...over,
});

describe('rollupTasks', () => {
  it('sums amountPaid of DONE tasks into committed', () => {
    const { committed } = rollupTasks([
      task({ status: 'DONE', amountPaid: 10000 }),
      task({ status: 'DONE', amountPaid: 2000, category: 'CATERING' }),
    ]);
    expect(committed).toEqual({ MUSIC: 10000, CATERING: 2000 });
  });

  it('ignores amountPaid on OPEN tasks (not yet committed)', () => {
    const { committed } = rollupTasks([task({ status: 'OPEN', amountPaid: 9999 })]);
    expect(committed.MUSIC ?? 0).toBe(0);
  });

  it('sums estimatedCost of OPEN tasks into planned', () => {
    const { planned } = rollupTasks([task({ status: 'OPEN', estimatedCost: 5000 })]);
    expect(planned).toEqual({ MUSIC: 5000 });
  });

  it('excludes soft-deleted tasks from both rollups', () => {
    const { committed, planned } = rollupTasks([
      task({ status: 'DONE', amountPaid: 10000, deletedAt: new Date() }),
      task({ status: 'OPEN', estimatedCost: 5000, deletedAt: new Date() }),
    ]);
    expect(committed).toEqual({});
    expect(planned).toEqual({});
  });
});

describe('sumConceptRanges', () => {
  it('sums min/max per category over active elements, treating null as 0', () => {
    const ranges = sumConceptRanges([
      { category: 'MUSIC', estCostMin: 6000, estCostMax: 14000, active: true },
      { category: 'MUSIC', estCostMin: 4000, estCostMax: 9000, active: true },
      { category: 'DESIGN', estCostMin: null, estCostMax: 5000, active: true },
      { category: 'MUSIC', estCostMin: 1000, estCostMax: 2000, active: false },
    ]);
    expect(ranges).toEqual({
      MUSIC: { min: 10000, max: 23000 },
      DESIGN: { min: 0, max: 5000 },
    });
  });
});
