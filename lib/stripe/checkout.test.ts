import { describe, it, expect, vi, beforeEach } from 'vitest';

const createSession = vi.fn();
vi.mock('./client', () => ({ getStripe: () => ({ checkout: { sessions: { create: createSession } } }) }));
vi.mock('@/lib/db', () => ({ prisma: { payment: { create: vi.fn() }, wedding: { findUnique: vi.fn() } } }));

import { prisma } from '@/lib/db';
import { createCheckoutSessionForWedding } from './checkout';

beforeEach(() => {
  vi.clearAllMocks();
  process.env.STRIPE_PRICE_ID = 'price_test';
  process.env.APP_URL = 'https://app.test';
});

describe('createCheckoutSessionForWedding', () => {
  it('creates a session with weddingId metadata + records a PENDING payment', async () => {
    (prisma.wedding.findUnique as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({ premiumUnlockedAt: null });
    createSession.mockResolvedValue({ id: 'cs_123', url: 'https://stripe.test/cs_123' });
    const r = await createCheckoutSessionForWedding('wed1');
    expect(r).toEqual({ url: 'https://stripe.test/cs_123' });
    expect(createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'payment',
        metadata: { weddingId: 'wed1' },
        line_items: [{ price: 'price_test', quantity: 1 }],
        success_url: 'https://app.test/dashboard?upgraded=1',
        cancel_url: 'https://app.test/dashboard',
      }),
    );
    expect(prisma.payment.create).toHaveBeenCalledWith({
      data: { weddingId: 'wed1', stripeCheckoutSessionId: 'cs_123', status: 'PENDING' },
    });
  });

  it('throws CONFIG when the price/app url is missing', async () => {
    delete process.env.STRIPE_PRICE_ID;
    await expect(createCheckoutSessionForWedding('wed1')).rejects.toThrow();
  });

  it('short-circuits when the wedding is already premium (no session, no PENDING payment)', async () => {
    (prisma.wedding.findUnique as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({ premiumUnlockedAt: new Date() });
    await expect(createCheckoutSessionForWedding('wed1')).rejects.toThrow(/already premium/i);
    expect(createSession).not.toHaveBeenCalled();
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });
});
