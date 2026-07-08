import type Stripe from 'stripe';
import { prisma } from '@/lib/db';

/**
 * Apply an already-verified Stripe event. The ONLY place premium is granted.
 * Idempotent: upsert by the unique session id + a `premiumUnlockedAt: null` guarded
 * write, so replays/duplicates are no-ops.
 */
export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  if (event.type !== 'checkout.session.completed') return;
  const session = event.data.object as Stripe.Checkout.Session;

  // Defensive on a money-grant path: `checkout.session.completed` can fire with
  // `payment_status: 'unpaid'` for delayed/async payment methods. Only grant on
  // a settled payment.
  if (session.payment_status !== 'paid') return;

  const metaWeddingId = session.metadata?.weddingId ?? null;
  const weddingId =
    metaWeddingId ??
    (await prisma.payment.findUnique({
      where: { stripeCheckoutSessionId: session.id },
      select: { weddingId: true },
    }))?.weddingId ??
    null;
  if (!weddingId) return;

  const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : null;
  const paid = {
    status: 'PAID' as const,
    stripePaymentIntentId: paymentIntentId,
    amount: session.amount_total ?? null,
    currency: session.currency ?? null,
  };

  await prisma.payment.upsert({
    where: { stripeCheckoutSessionId: session.id },
    create: { weddingId, stripeCheckoutSessionId: session.id, ...paid },
    update: paid,
  });

  // Grant once: only flips a wedding that is still free.
  await prisma.wedding.updateMany({
    where: { id: weddingId, premiumUnlockedAt: null },
    data: { premiumUnlockedAt: new Date() },
  });
}
