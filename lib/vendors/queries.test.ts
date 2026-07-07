import { describe, it, expect } from 'vitest';
import { vendorBudgetFit } from './queries';

describe('vendorBudgetFit', () => {
  it('returns null when there is no budget', () => {
    expect(vendorBudgetFit({ budgetTotal: null })).toBeNull();
  });
  it('maps a budget to an open-topped fit range', () => {
    expect(vendorBudgetFit({ budgetTotal: 150000 })).toEqual({ min: null, max: 150000 });
  });
});
