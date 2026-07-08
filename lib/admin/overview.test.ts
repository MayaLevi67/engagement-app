import { describe, it, expect } from 'vitest';
import { budgetBaselineStatus } from './overview';

describe('budgetBaselineStatus', () => {
  it('sums only active rows and flags balanced at exactly 100', () => {
    expect(budgetBaselineStatus([
      { defaultPercent: 60, active: true },
      { defaultPercent: 40, active: true },
      { defaultPercent: 99, active: false },
    ])).toEqual({ sum: 100, balanced: true });
  });
  it('flags imbalance when the active sum is not 100', () => {
    expect(budgetBaselineStatus([{ defaultPercent: 60, active: true }])).toEqual({ sum: 60, balanced: false });
  });
});
