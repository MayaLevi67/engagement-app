import type { Wedding } from '@prisma/client';
import { auth } from '@/lib/auth';
import { getCurrentWedding } from '@/lib/wedding/queries';
import { isPremium } from './entitlement';

export type WeddingGate =
  | { ok: true; wedding: Wedding }
  | { ok: false; error: 'UNAUTHENTICATED' | 'NOT_FOUND' };

export async function requireWedding(): Promise<WeddingGate> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: 'UNAUTHENTICATED' };
  const wedding = await getCurrentWedding(session.user.id);
  if (!wedding) return { ok: false, error: 'NOT_FOUND' };
  return { ok: true, wedding };
}

export type PremiumGate =
  | { ok: true; wedding: Wedding }
  | { ok: false; error: 'UNAUTHENTICATED' | 'NOT_FOUND' | 'PREMIUM_REQUIRED' };

export async function requirePremiumWedding(): Promise<PremiumGate> {
  const g = await requireWedding();
  if (!g.ok) return g;
  if (!isPremium(g.wedding)) return { ok: false, error: 'PREMIUM_REQUIRED' };
  return { ok: true, wedding: g.wedding };
}
