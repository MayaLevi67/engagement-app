import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', () => ({
  prisma: {
    payment: { findUnique: vi.fn(), upsert: vi.fn() },
    wedding: { updateMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { prisma } from '@/lib/db';
import { handleStripeEvent } from './webhook';

function completedEvent(over: Record<string, unknown> = {}) {
  return {
    type: 'checkout.session.completed',
    data: { object: { id: 'cs_1', payment_status: 'paid', payment_intent: 'pi_1', amount_total: 4900, currency: 'ils', metadata: { weddingId: 'wed1' }, ...over } },
  } as never;
}

beforeEach(() => vi.clearAllMocks());

describe('handleStripeEvent', () => {
  it('ignores non-completed events', async () => {
    await handleStripeEvent({ type: 'payment_intent.created', data: { object: {} } } as never);
    expect(prisma.payment.upsert).not.toHaveBeenCalled();
    expect(prisma.wedding.updateMany).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('marks the payment PAID and grants premium only if not already', async () => {
    await handleStripeEvent(completedEvent());
    expect(prisma.payment.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { stripeCheckoutSessionId: 'cs_1' },
      update: expect.objectContaining({ status: 'PAID', stripePaymentIntentId: 'pi_1', amount: 4900, currency: 'ils' }),
      create: expect.objectContaining({ weddingId: 'wed1', stripeCheckoutSessionId: 'cs_1', status: 'PAID' }),
    }));
    // Conditional set-once: updateMany with premiumUnlockedAt: null guard.
    expect(prisma.wedding.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'wed1', premiumUnlockedAt: null },
    }));
    // Both writes are applied atomically in a single transaction.
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('does not mark PAID or grant when payment_status is not paid', async () => {
    await handleStripeEvent(completedEvent({ payment_status: 'unpaid' }));
    expect(prisma.payment.upsert).not.toHaveBeenCalled();
    expect(prisma.wedding.updateMany).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('resolves the wedding from an existing payment when metadata is absent', async () => {
    (prisma.payment.findUnique as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({ weddingId: 'wedX' });
    await handleStripeEvent(completedEvent({ metadata: {} }));
    expect(prisma.wedding.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'wedX', premiumUnlockedAt: null } }));
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('is a no-op when no wedding can be resolved', async () => {
    (prisma.payment.findUnique as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue(null);
    await handleStripeEvent(completedEvent({ metadata: {} }));
    expect(prisma.payment.upsert).not.toHaveBeenCalled();
    expect(prisma.wedding.updateMany).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
