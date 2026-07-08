import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/wedding/queries', () => ({ getCurrentWedding: vi.fn() }));
vi.mock('@/lib/db', () => ({
  prisma: {
    concept: { findUnique: vi.fn() },
    conceptElement: { findUnique: vi.fn() },
    conceptFavorite: { findUnique: vi.fn(), create: vi.fn(), delete: vi.fn() },
    wedding: { update: vi.fn() },
    task: { findFirst: vi.fn(), aggregate: vi.fn(), create: vi.fn() },
  },
}));

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getCurrentWedding } from '@/lib/wedding/queries';
import {
  chooseConcept,
  clearSelectedConcept,
  toggleFavorite,
  addElementToChecklist,
} from './concepts';

const authed = { user: { id: 'u1' } };

beforeEach(() => {
  vi.clearAllMocks();
  (auth as unknown as Mock).mockResolvedValue(authed);
  (getCurrentWedding as unknown as Mock).mockResolvedValue({ id: 'wed1', weddingDate: null, premiumUnlockedAt: new Date() });
});

describe('chooseConcept', () => {
  it('rejects when unauthenticated', async () => {
    (auth as unknown as Mock).mockResolvedValue(null);
    expect(await chooseConcept('c1')).toEqual({ ok: false, error: 'UNAUTHENTICATED' });
    expect(prisma.wedding.update).not.toHaveBeenCalled();
  });

  it('returns NOT_FOUND when the caller has no wedding', async () => {
    (getCurrentWedding as unknown as Mock).mockResolvedValue(null);
    expect(await chooseConcept('c1')).toEqual({ ok: false, error: 'NOT_FOUND' });
    expect(prisma.wedding.update).not.toHaveBeenCalled();
  });

  it('sets the selected concept for an active concept', async () => {
    (prisma.concept.findUnique as unknown as Mock).mockResolvedValue({ id: 'c1', active: true });
    expect(await chooseConcept('c1')).toEqual({ ok: true });
    expect(prisma.wedding.update).toHaveBeenCalledWith({
      where: { id: 'wed1' }, data: { selectedConceptId: 'c1' },
    });
  });

  it('rejects an inactive concept', async () => {
    (prisma.concept.findUnique as unknown as Mock).mockResolvedValue({ id: 'c1', active: false });
    expect(await chooseConcept('c1')).toEqual({ ok: false, error: 'NOT_FOUND' });
    expect(prisma.wedding.update).not.toHaveBeenCalled();
  });

  it('rejects a missing concept', async () => {
    (prisma.concept.findUnique as unknown as Mock).mockResolvedValue(null);
    expect(await chooseConcept('c1')).toEqual({ ok: false, error: 'NOT_FOUND' });
    expect(prisma.wedding.update).not.toHaveBeenCalled();
  });
});

describe('clearSelectedConcept', () => {
  it('rejects when unauthenticated', async () => {
    (auth as unknown as Mock).mockResolvedValue(null);
    expect(await clearSelectedConcept()).toEqual({ ok: false, error: 'UNAUTHENTICATED' });
    expect(prisma.wedding.update).not.toHaveBeenCalled();
  });

  it('nulls the selected concept on the resolved wedding', async () => {
    expect(await clearSelectedConcept()).toEqual({ ok: true });
    expect(prisma.wedding.update).toHaveBeenCalledWith({
      where: { id: 'wed1' }, data: { selectedConceptId: null },
    });
  });
});

describe('toggleFavorite', () => {
  it('rejects when unauthenticated', async () => {
    (auth as unknown as Mock).mockResolvedValue(null);
    expect(await toggleFavorite('c1')).toEqual({ ok: false, error: 'UNAUTHENTICATED' });
    expect(prisma.conceptFavorite.create).not.toHaveBeenCalled();
    expect(prisma.conceptFavorite.delete).not.toHaveBeenCalled();
  });

  it('rejects an inactive/missing concept', async () => {
    (prisma.concept.findUnique as unknown as Mock).mockResolvedValue(null);
    expect(await toggleFavorite('c1')).toEqual({ ok: false, error: 'NOT_FOUND' });
    expect(prisma.conceptFavorite.create).not.toHaveBeenCalled();
  });

  it('creates a favorite scoped to the resolved wedding when none exists', async () => {
    (prisma.concept.findUnique as unknown as Mock).mockResolvedValue({ id: 'c1', active: true });
    (prisma.conceptFavorite.findUnique as unknown as Mock).mockResolvedValue(null);
    expect(await toggleFavorite('c1')).toEqual({ ok: true });
    // Idempotency + ownership both hinge on the compound-unique selector.
    expect(prisma.conceptFavorite.findUnique).toHaveBeenCalledWith({
      where: { weddingId_conceptId: { weddingId: 'wed1', conceptId: 'c1' } },
    });
    expect(prisma.conceptFavorite.create).toHaveBeenCalledWith({
      data: { weddingId: 'wed1', conceptId: 'c1' },
    });
  });

  it('removes a favorite when one exists', async () => {
    (prisma.concept.findUnique as unknown as Mock).mockResolvedValue({ id: 'c1', active: true });
    (prisma.conceptFavorite.findUnique as unknown as Mock).mockResolvedValue({ id: 'f1' });
    expect(await toggleFavorite('c1')).toEqual({ ok: true });
    expect(prisma.conceptFavorite.delete).toHaveBeenCalledWith({ where: { id: 'f1' } });
    expect(prisma.conceptFavorite.create).not.toHaveBeenCalled();
  });
});

describe('addElementToChecklist', () => {
  const element = { id: 'el1', conceptId: 'c1', title_en: 'Two DJs', title_he: 'שני תקליטנים', titleLocale: 'AUTO', category: 'MUSIC', concept: { isPremium: false } };

  it('rejects when unauthenticated', async () => {
    (auth as unknown as Mock).mockResolvedValue(null);
    expect(await addElementToChecklist('el1')).toEqual({ ok: false, error: 'UNAUTHENTICATED' });
    expect(prisma.task.create).not.toHaveBeenCalled();
  });

  it('creates a snapshot task scoped to the resolved wedding when none is live', async () => {
    (prisma.conceptElement.findUnique as unknown as Mock).mockResolvedValue(element);
    (prisma.task.findFirst as unknown as Mock).mockResolvedValue(null);
    (prisma.task.aggregate as unknown as Mock).mockResolvedValue({ _max: { sortOrder: 5 } });
    expect(await addElementToChecklist('el1')).toEqual({ ok: true });
    // The live-duplicate probe is scoped to the caller's own wedding.
    expect(prisma.task.findFirst).toHaveBeenCalledWith({
      where: { weddingId: 'wed1', deletedAt: null, sourceConceptElementId: 'el1' },
      select: { id: true },
    });
    expect(prisma.task.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ weddingId: 'wed1', sourceConceptElementId: 'el1', isCustom: true, category: 'MUSIC', sortOrder: 6 }),
    });
  });

  it('starts sortOrder at 0 when the wedding has no tasks', async () => {
    (prisma.conceptElement.findUnique as unknown as Mock).mockResolvedValue(element);
    (prisma.task.findFirst as unknown as Mock).mockResolvedValue(null);
    (prisma.task.aggregate as unknown as Mock).mockResolvedValue({ _max: { sortOrder: null } });
    expect(await addElementToChecklist('el1')).toEqual({ ok: true });
    expect(prisma.task.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ sortOrder: 0 }),
    });
  });

  it('is a no-op when a live copy already exists', async () => {
    (prisma.conceptElement.findUnique as unknown as Mock).mockResolvedValue(element);
    (prisma.task.findFirst as unknown as Mock).mockResolvedValue({ id: 't-existing' });
    expect(await addElementToChecklist('el1')).toEqual({ ok: true });
    expect(prisma.task.aggregate).not.toHaveBeenCalled();
    expect(prisma.task.create).not.toHaveBeenCalled();
  });

  it('rejects a missing element', async () => {
    (prisma.conceptElement.findUnique as unknown as Mock).mockResolvedValue(null);
    expect(await addElementToChecklist('elX')).toEqual({ ok: false, error: 'NOT_FOUND' });
    expect(prisma.task.create).not.toHaveBeenCalled();
  });

  it('returns NOT_FOUND when the caller has no wedding', async () => {
    (getCurrentWedding as unknown as Mock).mockResolvedValue(null);
    expect(await addElementToChecklist('el1')).toEqual({ ok: false, error: 'NOT_FOUND' });
    expect(prisma.conceptElement.findUnique).not.toHaveBeenCalled();
    expect(prisma.task.create).not.toHaveBeenCalled();
  });
});

describe('premium-concept gating', () => {
  // Premium concepts/elements are paywalled for a free couple; free ones stay open.
  it('chooseConcept rejects a premium concept for a free wedding', async () => {
    (getCurrentWedding as unknown as Mock).mockResolvedValue({ id: 'wed1', premiumUnlockedAt: null });
    (prisma.concept.findUnique as unknown as Mock).mockResolvedValue({ id: 'c1', active: true, isPremium: true });
    expect(await chooseConcept('c1')).toEqual({ ok: false, error: 'PREMIUM_REQUIRED' });
    expect(prisma.wedding.update).not.toHaveBeenCalled();
  });

  it('chooseConcept allows a non-premium concept for a free wedding', async () => {
    (getCurrentWedding as unknown as Mock).mockResolvedValue({ id: 'wed1', premiumUnlockedAt: null });
    (prisma.concept.findUnique as unknown as Mock).mockResolvedValue({ id: 'c1', active: true, isPremium: false });
    expect(await chooseConcept('c1')).toEqual({ ok: true });
    expect(prisma.wedding.update).toHaveBeenCalled();
  });

  it('chooseConcept allows a premium concept for a premium wedding', async () => {
    (prisma.concept.findUnique as unknown as Mock).mockResolvedValue({ id: 'c1', active: true, isPremium: true });
    expect(await chooseConcept('c1')).toEqual({ ok: true });
    expect(prisma.wedding.update).toHaveBeenCalled();
  });

  it('addElementToChecklist rejects a premium concept element for a free wedding', async () => {
    (getCurrentWedding as unknown as Mock).mockResolvedValue({ id: 'wed1', premiumUnlockedAt: null });
    (prisma.conceptElement.findUnique as unknown as Mock).mockResolvedValue({
      id: 'el1', conceptId: 'c1', title_en: 'x', title_he: 'x', titleLocale: 'AUTO', category: 'MUSIC',
      concept: { isPremium: true },
    });
    expect(await addElementToChecklist('el1')).toEqual({ ok: false, error: 'PREMIUM_REQUIRED' });
    expect(prisma.task.create).not.toHaveBeenCalled();
  });

  it('addElementToChecklist allows a non-premium concept element for a free wedding', async () => {
    (getCurrentWedding as unknown as Mock).mockResolvedValue({ id: 'wed1', premiumUnlockedAt: null });
    (prisma.conceptElement.findUnique as unknown as Mock).mockResolvedValue({
      id: 'el1', conceptId: 'c1', title_en: 'x', title_he: 'x', titleLocale: 'AUTO', category: 'MUSIC',
      concept: { isPremium: false },
    });
    (prisma.task.findFirst as unknown as Mock).mockResolvedValue(null);
    (prisma.task.aggregate as unknown as Mock).mockResolvedValue({ _max: { sortOrder: null } });
    expect(await addElementToChecklist('el1')).toEqual({ ok: true });
    expect(prisma.task.create).toHaveBeenCalled();
  });
});
