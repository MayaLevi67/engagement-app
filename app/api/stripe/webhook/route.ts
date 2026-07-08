import { getStripe } from '@/lib/stripe/client';
import { handleStripeEvent } from '@/lib/stripe/webhook';

// Stripe signature verification uses Node crypto; must not run on the edge.
export const runtime = 'nodejs';

export async function POST(req: Request): Promise<Response> {
  const sig = req.headers.get('stripe-signature');
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) return new Response('Bad request', { status: 400 });

  const body = await req.text(); // raw body required for signature verification

  let event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, secret);
  } catch {
    return new Response('Invalid signature', { status: 400 });
  }

  try {
    await handleStripeEvent(event);
  } catch (err) {
    console.error('[stripe webhook] handler error', err);
    return new Response('Handler error', { status: 500 }); // Stripe will retry
  }

  return new Response('ok', { status: 200 });
}
