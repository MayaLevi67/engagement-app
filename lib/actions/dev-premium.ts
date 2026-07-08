'use server';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getCurrentWedding } from '@/lib/wedding/queries';

export type DevPremiumResult = { ok: true } | { ok: false; error: 'FORBIDDEN' | 'NOT_FOUND' };

/**
 * DEV-ONLY testing aid: flip the current admin's own wedding in/out of Premium
 * without a real payment, so the premium UX can be exercised locally.
 *
 * Hard-disabled in production (returns FORBIDDEN) so it can NEVER act as a
 * paywall bypass, and additionally requires an ADMIN user (checked against the
 * live DB, not the JWT). This never grants premium the way the real webhook
 * does in production — it exists purely for local development.
 */
export async function devSetPremium(grant: boolean): Promise<DevPremiumResult> {
  if (process.env.NODE_ENV === 'production') return { ok: false, error: 'FORBIDDEN' };

  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: 'FORBIDDEN' };

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (user?.role !== 'ADMIN') return { ok: false, error: 'FORBIDDEN' };

  const wedding = await getCurrentWedding(session.user.id);
  if (!wedding) return { ok: false, error: 'NOT_FOUND' };

  await prisma.wedding.update({
    where: { id: wedding.id },
    data: { premiumUnlockedAt: grant ? new Date() : null },
  });
  return { ok: true };
}
