import { prisma } from '@/lib/db';
import type { Wedding } from '@prisma/client';

/** Resolves the caller's wedding via the DB (never the stale JWT claim). */
export async function getCurrentWedding(userId: string): Promise<Wedding | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { wedding: true },
  });
  return user?.wedding ?? null;
}
