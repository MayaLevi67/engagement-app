import type { UserRole } from '@prisma/client';

/**
 * The admin-access decision for the /admin layout. Consults ONLY the live-DB role
 * (never the JWT claim), so a stale-JWT demoted admin is correctly bounced.
 */
export function adminGateDecision(
  userId: string | undefined,
  dbRole: UserRole | null | undefined,
): 'login' | 'dashboard' | 'allow' {
  if (!userId) return 'login';
  if (dbRole !== 'ADMIN') return 'dashboard';
  return 'allow';
}
