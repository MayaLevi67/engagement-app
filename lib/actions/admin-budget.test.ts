import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/db', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    budgetTemplate: { findUnique: vi.fn(), update: vi.fn() },
  },
}));

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import * as adminBudget from './admin-budget';
import { updateBudgetTemplate, setBudgetTemplateActive, reorderBudgetTemplate } from './admin-budget';

function asAdmin(isAdmin: boolean) {
  (auth as unknown as Mock).mockResolvedValue(isAdmin ? { user: { id: 'a1' } } : null);
  (prisma.user.findUnique as unknown as Mock).mockResolvedValue(isAdmin ? { role: 'ADMIN' } : { role: 'USER' });
}

beforeEach(() => vi.clearAllMocks());

describe('admin gate', () => {
  const calls: Record<string, () => Promise<unknown>> = {
    updateBudgetTemplate: () => updateBudgetTemplate('MUSIC', { defaultPercent: 10, active: true, sortOrder: 10 }),
    setBudgetTemplateActive: () => setBudgetTemplateActive('MUSIC', false),
    reorderBudgetTemplate: () => reorderBudgetTemplate('MUSIC', 5),
  };

  it('exports exactly the gated actions covered here', () => {
    expect(Object.keys(adminBudget).sort()).toEqual(Object.keys(calls).sort());
  });

  it.each(Object.entries(calls))('%s rejects a non-admin', async (_name, call) => {
    asAdmin(false);
    expect(await call()).toEqual({ ok: false, error: 'FORBIDDEN' });
  });
});

describe('updateBudgetTemplate', () => {
  it('updates for an admin', async () => {
    asAdmin(true);
    (prisma.budgetTemplate.findUnique as unknown as Mock).mockResolvedValue({ id: 'bt1' });
    const r = await updateBudgetTemplate('MUSIC', { defaultPercent: 12, active: true, sortOrder: 40 });
    expect(r).toEqual({ ok: true });
    expect(prisma.budgetTemplate.update).toHaveBeenCalledWith({
      where: { category: 'MUSIC' }, data: { defaultPercent: 12, active: true, sortOrder: 40 },
    });
  });

  it('rejects invalid input', async () => {
    asAdmin(true);
    expect(await updateBudgetTemplate('MUSIC', { defaultPercent: 200, active: true, sortOrder: 40 }))
      .toEqual({ ok: false, error: 'INVALID' });
  });

  it('returns NOT_FOUND for an unseeded category row', async () => {
    asAdmin(true);
    (prisma.budgetTemplate.findUnique as unknown as Mock).mockResolvedValue(null);
    expect(await updateBudgetTemplate('MUSIC', { defaultPercent: 12, active: true, sortOrder: 40 }))
      .toEqual({ ok: false, error: 'NOT_FOUND' });
  });
});

describe('setBudgetTemplateActive', () => {
  it('toggles active for an admin', async () => {
    asAdmin(true);
    (prisma.budgetTemplate.findUnique as unknown as Mock).mockResolvedValue({ id: 'bt1' });
    const r = await setBudgetTemplateActive('MUSIC', false);
    expect(r).toEqual({ ok: true });
    expect(prisma.budgetTemplate.update).toHaveBeenCalledWith({
      where: { category: 'MUSIC' }, data: { active: false },
    });
  });

  it('returns NOT_FOUND for an unseeded category row', async () => {
    asAdmin(true);
    (prisma.budgetTemplate.findUnique as unknown as Mock).mockResolvedValue(null);
    expect(await setBudgetTemplateActive('MUSIC', false)).toEqual({ ok: false, error: 'NOT_FOUND' });
  });
});

describe('reorderBudgetTemplate', () => {
  it('reorders for an admin', async () => {
    asAdmin(true);
    (prisma.budgetTemplate.findUnique as unknown as Mock).mockResolvedValue({ id: 'bt1' });
    const r = await reorderBudgetTemplate('MUSIC', 5);
    expect(r).toEqual({ ok: true });
    expect(prisma.budgetTemplate.update).toHaveBeenCalledWith({
      where: { category: 'MUSIC' }, data: { sortOrder: 5 },
    });
  });

  it('rejects a non-integer sortOrder', async () => {
    asAdmin(true);
    expect(await reorderBudgetTemplate('MUSIC', 5.5)).toEqual({ ok: false, error: 'INVALID' });
  });

  it('returns NOT_FOUND for an unseeded category row', async () => {
    asAdmin(true);
    (prisma.budgetTemplate.findUnique as unknown as Mock).mockResolvedValue(null);
    expect(await reorderBudgetTemplate('MUSIC', 5)).toEqual({ ok: false, error: 'NOT_FOUND' });
  });
});
