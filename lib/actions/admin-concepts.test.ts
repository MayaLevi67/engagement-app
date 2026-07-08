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
import * as adminConcepts from './admin-concepts';
import {
  createConcept,
  updateConcept,
  deleteConcept,
  setConceptActive,
  setConceptPremium,
  reorderConcept,
  createElement,
  updateElement,
  deleteElement,
  reorderElement,
  addImage,
  updateImage,
  deleteImage,
  reorderImage,
} from './admin-concepts';

function asAdmin(isAdmin: boolean) {
  (auth as unknown as Mock).mockResolvedValue(isAdmin ? { user: { id: 'a1' } } : null);
  (prisma.user.findUnique as unknown as Mock).mockResolvedValue(isAdmin ? { role: 'ADMIN' } : { role: 'USER' });
}

beforeEach(() => vi.clearAllMocks());

const ADMIN_ACTIONS: [string, () => Promise<unknown>][] = [
  ['createConcept', () => createConcept({})],
  ['updateConcept', () => updateConcept('id', {})],
  ['deleteConcept', () => deleteConcept('id')],
  ['setConceptActive', () => setConceptActive('id', true)],
  ['setConceptPremium', () => setConceptPremium('id', true)],
  ['reorderConcept', () => reorderConcept('id', 0)],
  ['createElement', () => createElement('cid', {})],
  ['updateElement', () => updateElement('id', {})],
  ['deleteElement', () => deleteElement('id')],
  ['reorderElement', () => reorderElement('id', 0)],
  ['addImage', () => addImage('cid', {})],
  ['updateImage', () => updateImage('id', {})],
  ['deleteImage', () => deleteImage('id')],
  ['reorderImage', () => reorderImage('id', 0)],
];

describe('admin gate', () => {
  it.each(ADMIN_ACTIONS)('%s rejects a non-admin with FORBIDDEN', async (_name, action) => {
    asAdmin(false);
    expect(await action()).toEqual({ ok: false, error: 'FORBIDDEN' });
  });
});

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

describe('updateConcept does not reset independently-managed flags', () => {
  it('omits isPremium/active/sortOrder from the update when the payload omits them', async () => {
    asAdmin(true);
    (prisma.concept.findUnique as unknown as Mock).mockResolvedValue({ id: 'c1' });
    await updateConcept('c1', { title_en: 'X', title_he: 'י', palette: ['#C9A227'] });
    expect(prisma.concept.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({
          isPremium: expect.anything(),
          active: expect.anything(),
          sortOrder: expect.anything(),
        }),
      }),
    );
  });
});

describe('export parity', () => {
  it('every admin-concepts export is an admin-gated action (export parity)', () => {
    expect(Object.keys(adminConcepts).sort()).toEqual(
      [
        'createConcept', 'updateConcept', 'deleteConcept', 'setConceptActive',
        'setConceptPremium', 'reorderConcept', 'createElement', 'updateElement',
        'deleteElement', 'reorderElement', 'addImage', 'updateImage', 'deleteImage',
        'reorderImage',
      ].sort(),
    );
  });
});
