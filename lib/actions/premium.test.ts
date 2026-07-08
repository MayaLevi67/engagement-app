import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/wedding/queries', () => ({ getCurrentWedding: vi.fn() }));
vi.mock('@/lib/stripe/checkout', () => ({ createCheckoutSessionForWedding: vi.fn() }));

import { auth } from '@/lib/auth';
import { getCurrentWedding } from '@/lib/wedding/queries';
import { createCheckoutSessionForWedding } from '@/lib/stripe/checkout';
import { startCheckout } from './premium';

beforeEach(() => {
  vi.clearAllMocks();
  (auth as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({ user: { id: 'u1' } });
  (getCurrentWedding as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({ id: 'wed1', premiumUnlockedAt: null });
});

describe('startCheckout', () => {
  it('returns the checkout url for a free wedding', async () => {
    (createCheckoutSessionForWedding as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({ url: 'https://stripe.test/x' });
    expect(await startCheckout()).toEqual({ ok: true, url: 'https://stripe.test/x' });
  });
  it('rejects when unauthenticated', async () => {
    (auth as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue(null);
    expect(await startCheckout()).toEqual({ ok: false, error: 'UNAUTHENTICATED' });
  });
  it('rejects when already premium', async () => {
    (getCurrentWedding as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({ id: 'wed1', premiumUnlockedAt: new Date() });
    expect(await startCheckout()).toEqual({ ok: false, error: 'ALREADY_PREMIUM' });
  });
  it('maps a Stripe/config failure to CONFIG', async () => {
    (createCheckoutSessionForWedding as unknown as { mockRejectedValue: (v: unknown) => void }).mockRejectedValue(new Error('boom'));
    expect(await startCheckout()).toEqual({ ok: false, error: 'CONFIG' });
  });
});
