import { describe, it, expect } from 'vitest';
import { budgetTotalInput, categoryAllocationInput, taskAmountInput, budgetTemplateInput } from './schema';

describe('budget schemas', () => {
  it('accepts a non-negative integer budget and null to clear', () => {
    expect(budgetTotalInput.safeParse({ amount: 150000 }).success).toBe(true);
    expect(budgetTotalInput.safeParse({ amount: null }).success).toBe(true);
  });

  it('rejects a negative or fractional amount', () => {
    expect(budgetTotalInput.safeParse({ amount: -1 }).success).toBe(false);
    expect(taskAmountInput.safeParse({ amount: 10.5 }).success).toBe(false);
  });

  it('validates a category allocation', () => {
    expect(categoryAllocationInput.safeParse({ category: 'MUSIC', amount: 5000 }).success).toBe(true);
    expect(categoryAllocationInput.safeParse({ category: 'NOPE', amount: 5000 }).success).toBe(false);
  });

  it('bounds a template percent to 0..100', () => {
    expect(budgetTemplateInput.safeParse({ defaultPercent: 25, active: true, sortOrder: 10 }).success).toBe(true);
    expect(budgetTemplateInput.safeParse({ defaultPercent: 101, active: true, sortOrder: 10 }).success).toBe(false);
  });
});
