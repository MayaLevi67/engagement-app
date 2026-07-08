import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/wedding/queries', () => ({ getCurrentWedding: vi.fn() }));

import { auth } from '@/lib/auth';
import { getCurrentWedding } from '@/lib/wedding/queries';
import { requireWedding, requirePremiumWedding } from './gate';

const set = (m: unknown, v: unknown) => (m as unknown as { mockResolvedValue: (x: unknown) => void }).mockResolvedValue(v);
beforeEach(() => vi.clearAllMocks());

describe('requireWedding', () => {
  it('UNAUTHENTICATED with no session', async () => { set(auth, null); expect(await requireWedding()).toEqual({ ok: false, error: 'UNAUTHENTICATED' }); });
  it('NOT_FOUND with no wedding', async () => { set(auth, { user: { id: 'u1' } }); set(getCurrentWedding, null); expect(await requireWedding()).toEqual({ ok: false, error: 'NOT_FOUND' }); });
  it('returns the wedding', async () => { set(auth, { user: { id: 'u1' } }); set(getCurrentWedding, { id: 'w1', premiumUnlockedAt: null }); expect(await requireWedding()).toEqual({ ok: true, wedding: { id: 'w1', premiumUnlockedAt: null } }); });
});

describe('requirePremiumWedding', () => {
  it('PREMIUM_REQUIRED for a free wedding', async () => { set(auth, { user: { id: 'u1' } }); set(getCurrentWedding, { id: 'w1', premiumUnlockedAt: null }); expect(await requirePremiumWedding()).toEqual({ ok: false, error: 'PREMIUM_REQUIRED' }); });
  it('passes a premium wedding', async () => { set(auth, { user: { id: 'u1' } }); const w = { id: 'w1', premiumUnlockedAt: new Date() }; set(getCurrentWedding, w); expect(await requirePremiumWedding()).toEqual({ ok: true, wedding: w }); });
});
