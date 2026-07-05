import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/db', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    concept: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn(), delete: vi.fn() },
    conceptElement: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn(), delete: vi.fn(), findMany: vi.fn() },
    conceptImage: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn(), delete: vi.fn() },
    task: { updateMany: vi.fn() },
    $transaction: vi.fn(async (ops) => (typeof ops === 'function' ? ops() : Promise.all(ops))),
  },
}));

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { createConcept, updateConcept, deleteConcept } from './admin-concepts';

function asAdmin(isAdmin: boolean) {
  (auth as unknown as Mock).mockResolvedValue(isAdmin ? { user: { id: 'a1' } } : null);
  (prisma.user.findUnique as unknown as Mock).mockResolvedValue(isAdmin ? { role: 'ADMIN' } : { role: 'USER' });
}

beforeEach(() => vi.clearAllMocks());

describe('createConcept', () => {
  it('rejects a non-admin', async () => {
    asAdmin(false);
    expect(await createConcept({ title_en: 'X', title_he: 'י' })).toEqual({ ok: false, error: 'FORBIDDEN' });
  });

  it('creates for an admin and returns the id', async () => {
    asAdmin(true);
    (prisma.concept.create as unknown as Mock).mockResolvedValue({ id: 'c-new' });
    const r = await createConcept({ title_en: 'Old Money', title_he: 'אלגנטיות', palette: ['#C9A227'] });
    expect(r).toEqual({ ok: true, id: 'c-new' });
  });

  it('rejects invalid input', async () => {
    asAdmin(true);
    expect(await createConcept({ title_en: '', title_he: '' })).toEqual({ ok: false, error: 'INVALID' });
  });
});

describe('deleteConcept', () => {
  it('nulls pushed-task provenance then deletes', async () => {
    asAdmin(true);
    (prisma.concept.findUnique as unknown as Mock).mockResolvedValue({ id: 'c1' });
    (prisma.conceptElement.findMany as unknown as Mock).mockResolvedValue([{ id: 'el1' }, { id: 'el2' }]);
    const r = await deleteConcept('c1');
    expect(r).toEqual({ ok: true, id: 'c1' });
    expect(prisma.task.updateMany).toHaveBeenCalledWith({
      where: { sourceConceptElementId: { in: ['el1', 'el2'] } },
      data: { sourceConceptElementId: null },
    });
    expect(prisma.concept.delete).toHaveBeenCalledWith({ where: { id: 'c1' } });
  });
});

describe('updateConcept', () => {
  it('returns NOT_FOUND for a missing concept', async () => {
    asAdmin(true);
    (prisma.concept.findUnique as unknown as Mock).mockResolvedValue(null);
    expect(await updateConcept('cX', { title_en: 'A', title_he: 'ב' })).toEqual({ ok: false, error: 'NOT_FOUND' });
  });
});
