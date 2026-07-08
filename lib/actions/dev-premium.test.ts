import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/wedding/queries', () => ({ getCurrentWedding: vi.fn() }));
vi.mock('@/lib/db', () => ({
  prisma: { user: { findUnique: vi.fn() }, wedding: { update: vi.fn() } },
}));

import { auth } from '@/lib/auth';
import { getCurrentWedding } from '@/lib/wedding/queries';
import { prisma } from '@/lib/db';
import { devSetPremium } from './dev-premium';

const set = (m: unknown, v: unknown) =>
  (m as unknown as { mockResolvedValue: (x: unknown) => void }).mockResolvedValue(v);

beforeEach(() => {
  vi.clearAllMocks();
  set(auth, { user: { id: 'u1' } });
  set(prisma.user.findUnique, { role: 'ADMIN' });
  set(getCurrentWedding, { id: 'w1', premiumUnlockedAt: null });
});

describe('devSetPremium', () => {
  it('grants premium for an admin (sets premiumUnlockedAt to a Date)', async () => {
    expect(await devSetPremium(true)).toEqual({ ok: true });
    expect(prisma.wedding.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'w1' },
        data: expect.objectContaining({ premiumUnlockedAt: expect.any(Date) }),
      }),
    );
  });

  it('revokes premium (sets premiumUnlockedAt to null)', async () => {
    expect(await devSetPremium(false)).toEqual({ ok: true });
    expect(prisma.wedding.update).toHaveBeenCalledWith({
      where: { id: 'w1' },
      data: { premiumUnlockedAt: null },
    });
  });

  it('forbids a non-admin and writes nothing', async () => {
    set(prisma.user.findUnique, { role: 'USER' });
    expect(await devSetPremium(true)).toEqual({ ok: false, error: 'FORBIDDEN' });
    expect(prisma.wedding.update).not.toHaveBeenCalled();
  });

  it('forbids an unauthenticated caller', async () => {
    set(auth, null);
    expect(await devSetPremium(true)).toEqual({ ok: false, error: 'FORBIDDEN' });
    expect(prisma.wedding.update).not.toHaveBeenCalled();
  });

  it('returns NOT_FOUND when the admin has no wedding', async () => {
    set(getCurrentWedding, null);
    expect(await devSetPremium(true)).toEqual({ ok: false, error: 'NOT_FOUND' });
    expect(prisma.wedding.update).not.toHaveBeenCalled();
  });
});
