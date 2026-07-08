import { getStripe } from './client';
import { prisma } from '@/lib/db';

/** Create a one-time Checkout Session for a wedding and record a PENDING Payment. */
export async function createCheckoutSessionForWedding(weddingId: string): Promise<{ url: string }> {
  const priceId = process.env.STRIPE_PRICE_ID;
  const appUrl = process.env.APP_URL;
  if (!priceId || !appUrl) throw new Error('Stripe price or APP_URL not configured');

  const session = await getStripe().checkout.sessions.create({
    mode: 'payment',
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: { weddingId },
    success_url: `${appUrl}/dashboard?upgraded=1`,
    cancel_url: `${appUrl}/dashboard`,
  });

  await prisma.payment.create({
    data: { weddingId, stripeCheckoutSessionId: session.id, status: 'PENDING' },
  });

  if (!session.url) throw new Error('Stripe session has no URL');
  return { url: session.url };
}
