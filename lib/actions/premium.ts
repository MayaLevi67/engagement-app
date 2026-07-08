'use server';

import { auth } from '@/lib/auth';
import { getCurrentWedding } from '@/lib/wedding/queries';
import { isPremium } from '@/lib/premium/entitlement';
import { createCheckoutSessionForWedding } from '@/lib/stripe/checkout';

export type StartCheckoutResult =
  | { ok: true; url: string }
  | { ok: false; error: 'UNAUTHENTICATED' | 'NOT_FOUND' | 'ALREADY_PREMIUM' | 'CONFIG' };

export async function startCheckout(): Promise<StartCheckoutResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: 'UNAUTHENTICATED' };
  const wedding = await getCurrentWedding(session.user.id);
  if (!wedding) return { ok: false, error: 'NOT_FOUND' };
  if (isPremium(wedding)) return { ok: false, error: 'ALREADY_PREMIUM' };
  try {
    const { url } = await createCheckoutSessionForWedding(wedding.id);
    return { ok: true, url };
  } catch {
    return { ok: false, error: 'CONFIG' };
  }
}
