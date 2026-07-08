import Stripe from 'stripe';

let cached: Stripe | null = null;

/** Lazily-initialized server-only Stripe client. Throws if the secret is unset. */
export function getStripe(): Stripe {
  if (cached) return cached;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set');
  cached = new Stripe(key);
  return cached;
}
