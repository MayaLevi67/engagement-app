import { describe, it, expect } from 'vitest';
import { isPremium, FREE_CHECKLIST_LIMIT, capChecklist } from './entitlement';

describe('isPremium', () => {
  it('is false when premiumUnlockedAt is null, true when set', () => {
    expect(isPremium({ premiumUnlockedAt: null })).toBe(false);
    expect(isPremium({ premiumUnlockedAt: new Date('2026-01-01') })).toBe(true);
  });
});

describe('capChecklist', () => {
  const tasks = Array.from({ length: 25 }, (_, i) => ({ id: `t${i}` }));
  it('returns all tasks with 0 hidden for premium', () => {
    expect(capChecklist(tasks, true)).toEqual({ tasks, hiddenCount: 0 });
  });
  it('returns the first FREE_CHECKLIST_LIMIT + the hidden count for free', () => {
    const r = capChecklist(tasks, false);
    expect(r.tasks).toHaveLength(FREE_CHECKLIST_LIMIT);
    expect(r.tasks[0].id).toBe('t0');
    expect(r.hiddenCount).toBe(25 - FREE_CHECKLIST_LIMIT);
  });
  it('reports 0 hidden when a free couple has <= the limit', () => {
    const few = tasks.slice(0, 5);
    expect(capChecklist(few, false)).toEqual({ tasks: few, hiddenCount: 0 });
  });
});
