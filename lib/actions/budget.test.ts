import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/wedding/queries', () => ({ getCurrentWedding: vi.fn() }));
vi.mock('@/lib/db', () => ({
  prisma: {
    wedding: { update: vi.fn() },
    budgetAllocation: { upsert: vi.fn(), deleteMany: vi.fn() },
    task: { findFirst: vi.fn(), update: vi.fn() },
  },
}));

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getCurrentWedding } from '@/lib/wedding/queries';
import {
  setBudgetTotal, setAvgGiftPerGuest, setCategoryAllocation, clearCategoryAllocation,
  setTaskAmountPaid, setTaskEstimatedCost,
} from './budget';

beforeEach(() => {
  vi.clearAllMocks();
  (auth as unknown as Mock).mockResolvedValue({ user: { id: 'u1' } });
  (getCurrentWedding as unknown as Mock).mockResolvedValue({ id: 'wed1' });
});

describe('setBudgetTotal', () => {
  it('rejects when unauthenticated', async () => {
    (auth as unknown as Mock).mockResolvedValue(null);
    expect(await setBudgetTotal(150000)).toEqual({ ok: false, error: 'UNAUTHENTICATED' });
  });

  it('updates the wedding budget', async () => {
    expect(await setBudgetTotal(150000)).toEqual({ ok: true });
    expect(prisma.wedding.update).toHaveBeenCalledWith({ where: { id: 'wed1' }, data: { budgetTotal: 150000 } });
  });

  it('rejects a negative amount', async () => {
    expect(await setBudgetTotal(-5)).toEqual({ ok: false, error: 'INVALID' });
    expect(prisma.wedding.update).not.toHaveBeenCalled();
  });

  it('accepts null to clear', async () => {
    expect(await setBudgetTotal(null)).toEqual({ ok: true });
    expect(prisma.wedding.update).toHaveBeenCalledWith({ where: { id: 'wed1' }, data: { budgetTotal: null } });
  });
});

describe('setAvgGiftPerGuest', () => {
  it('updates the gift average', async () => {
    expect(await setAvgGiftPerGuest(500)).toEqual({ ok: true });
    expect(prisma.wedding.update).toHaveBeenCalledWith({ where: { id: 'wed1' }, data: { avgGiftPerGuest: 500 } });
  });
});

describe('category allocation (pin)', () => {
  it('upserts a pin', async () => {
    expect(await setCategoryAllocation('MUSIC', 8000)).toEqual({ ok: true });
    expect(prisma.budgetAllocation.upsert).toHaveBeenCalledWith({
      where: { weddingId_category: { weddingId: 'wed1', category: 'MUSIC' } },
      create: { weddingId: 'wed1', category: 'MUSIC', amount: 8000 },
      update: { amount: 8000 },
    });
  });

  it('rejects an unknown category', async () => {
    expect(await setCategoryAllocation('NOPE' as never, 8000)).toEqual({ ok: false, error: 'INVALID' });
  });

  it('clears a pin', async () => {
    expect(await clearCategoryAllocation('MUSIC')).toEqual({ ok: true });
    expect(prisma.budgetAllocation.deleteMany).toHaveBeenCalledWith({ where: { weddingId: 'wed1', category: 'MUSIC' } });
  });
});

describe('setTaskAmountPaid', () => {
  it('updates paid amount on an owned task', async () => {
    (prisma.task.findFirst as unknown as Mock).mockResolvedValue({ id: 't1' });
    expect(await setTaskAmountPaid('t1', 10000)).toEqual({ ok: true });
    expect(prisma.task.update).toHaveBeenCalledWith({ where: { id: 't1' }, data: { amountPaid: 10000 } });
  });

  it('rejects a task the couple does not own', async () => {
    (prisma.task.findFirst as unknown as Mock).mockResolvedValue(null);
    expect(await setTaskAmountPaid('tX', 10000)).toEqual({ ok: false, error: 'NOT_FOUND' });
    expect(prisma.task.update).not.toHaveBeenCalled();
  });
});

describe('setTaskEstimatedCost', () => {
  it('updates estimated cost on an owned task', async () => {
    (prisma.task.findFirst as unknown as Mock).mockResolvedValue({ id: 't1' });
    expect(await setTaskEstimatedCost('t1', 5000)).toEqual({ ok: true });
    expect(prisma.task.update).toHaveBeenCalledWith({ where: { id: 't1' }, data: { estimatedCost: 5000 } });
  });

  it('rejects ownership mismatch', async () => {
    (prisma.task.findFirst as unknown as Mock).mockResolvedValue(null);
    expect(await setTaskEstimatedCost('tX', 5000)).toEqual({ ok: false, error: 'NOT_FOUND' });
    expect(prisma.task.update).not.toHaveBeenCalled();
  });
});
