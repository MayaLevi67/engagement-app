import { describe, it, expect } from 'vitest';
import type { TaskCategory, TaskStatus, TitleLocale } from '@prisma/client';
import {
  daysUntilWedding, checklistProgress, budgetSummary, vendorCounts, nextUpTasks,
} from './aggregate';

const D = (s: string) => new Date(s);
const NOW = D('2026-07-07T09:00:00Z');

type TaskFields = {
  id: string; title_en: string; title_he: string; titleLocale: TitleLocale;
  category: TaskCategory; status: TaskStatus;
  dueDate: Date | null; amountPaid: number | null;
  estimatedCost: number | null; deletedAt: Date | null;
};

describe('daysUntilWedding', () => {
  it('returns whole days to a future date', () => {
    expect(daysUntilWedding(D('2026-07-17T00:00:00Z'), NOW)).toBe(10);
  });
  it('returns 0 for today and negative for the past', () => {
    expect(daysUntilWedding(D('2026-07-07T23:00:00Z'), NOW)).toBe(0);
    expect(daysUntilWedding(D('2026-07-05T00:00:00Z'), NOW)).toBe(-2);
  });
  it('returns null when there is no date', () => {
    expect(daysUntilWedding(null, NOW)).toBeNull();
  });
});

const task = (over: Partial<TaskFields>): TaskFields => ({
  id: 'x', title_en: 'T', title_he: 'ט', titleLocale: 'AUTO',
  category: 'MUSIC', status: 'OPEN',
  dueDate: null, amountPaid: null,
  estimatedCost: null, deletedAt: null, ...over,
});

describe('checklistProgress', () => {
  it('counts done/total/pct and overdue (open + past due)', () => {
    const r = checklistProgress([
      task({ status: 'DONE' }),
      task({ status: 'OPEN', dueDate: D('2026-07-01T00:00:00Z') }), // overdue
      task({ status: 'OPEN', dueDate: D('2026-08-01T00:00:00Z') }), // future
    ], NOW);
    expect(r).toEqual({ done: 1, total: 3, pct: 33, overdue: 1 });
  });
  it('excludes soft-deleted tasks and handles empty', () => {
    expect(checklistProgress([task({ status: 'DONE', deletedAt: D('2026-01-01') })], NOW))
      .toEqual({ done: 0, total: 0, pct: 0, overdue: 0 });
  });
});

describe('budgetSummary', () => {
  it('is null when no budget is set', () => {
    expect(budgetSummary(null, [])).toBeNull();
  });
  it('sums committed (paid on DONE) and computes remaining/pct', () => {
    const r = budgetSummary(100000, [
      task({ status: 'DONE', amountPaid: 20000 }),
      task({ status: 'OPEN', amountPaid: 9999 }), // not committed (not DONE)
    ]);
    expect(r).toEqual({ total: 100000, committed: 20000, remaining: 80000, pct: 20 });
  });
});

describe('vendorCounts', () => {
  it('counts all quotes as shortlisted and BOOKED as booked', () => {
    expect(vendorCounts([{ status: 'CONSIDERING' }, { status: 'BOOKED' }, { status: 'QUOTED' }]))
      .toEqual({ shortlisted: 3, booked: 1 });
  });
});

describe('nextUpTasks', () => {
  it('returns soonest OPEN tasks, nulls last, overdue flagged, limited', () => {
    const r = nextUpTasks([
      task({ id: 'done', status: 'DONE', dueDate: D('2026-07-08') }),
      task({ id: 'nodate', status: 'OPEN', dueDate: null }),
      task({ id: 'overdue', status: 'OPEN', dueDate: D('2026-07-01') }),
      task({ id: 'soon', status: 'OPEN', dueDate: D('2026-07-10') }),
    ], NOW, 2);
    expect(r.map((t) => t.id)).toEqual(['overdue', 'soon']);
    expect(r[0].overdue).toBe(true);
    expect(r[1].overdue).toBe(false);
  });
});
