import { describe, it, expect } from 'vitest';
import {
  namesSchema,
  prioritiesSchema,
  sizeBudgetSchema,
  fullProfileSchema,
  ONBOARDING_STEPS,
} from './profile-fields';

describe('profile field schemas', () => {
  it('requires partner1Name in the names step', () => {
    expect(namesSchema.safeParse({ partner1Name: '', partner2Name: 'A' }).success).toBe(false);
    expect(namesSchema.safeParse({ partner1Name: 'Maya', partner2Name: 'Asaf' }).success).toBe(true);
  });

  it('allows an empty priorities list but rejects more than 3', () => {
    expect(prioritiesSchema.safeParse({ priorities: [] }).success).toBe(true);
    expect(
      prioritiesSchema.safeParse({ priorities: ['FOOD', 'PARTY', 'DESIGN'] }).success,
    ).toBe(true);
    expect(
      prioritiesSchema.safeParse({
        priorities: ['FOOD', 'PARTY', 'DESIGN', 'FASHION'],
      }).success,
    ).toBe(false);
  });

  it('rejects duplicate priorities', () => {
    expect(
      prioritiesSchema.safeParse({ priorities: ['FOOD', 'FOOD'] }).success,
    ).toBe(false);
  });

  it('rejects a negative guest count and budget', () => {
    expect(sizeBudgetSchema.safeParse({ guestCount: -1 }).success).toBe(false);
    expect(sizeBudgetSchema.safeParse({ budgetTotal: -5 }).success).toBe(false);
    expect(
      sizeBudgetSchema.safeParse({ guestCount: 300, budgetTotal: 180000 }).success,
    ).toBe(true);
  });

  it('exposes six ordered onboarding steps', () => {
    expect(ONBOARDING_STEPS.map((s) => s.id)).toEqual([
      'names', 'date', 'sizeBudget', 'style', 'priorities', 'done',
    ]);
  });

  it('full schema accepts a completely empty profile except names', () => {
    expect(fullProfileSchema.safeParse({ partner1Name: 'Maya' }).success).toBe(true);
  });
});
