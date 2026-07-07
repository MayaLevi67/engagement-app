'use server';

import type { TaskCategory } from '@prisma/client';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { budgetTemplateInput } from '@/lib/budget/schema';

export type AdminResult =
  | { ok: true; id?: string }
  | { ok: false; error: 'FORBIDDEN' | 'INVALID' | 'NOT_FOUND' };

/**
 * Confirm the caller is an authenticated ADMIN.
 *
 * The role is resolved from the DB (not the JWT/session claim): the JWT role is
 * stamped at login and can be stale, so for admin mutations we re-check the
 * live `User.role`. Returns the user id on success, or null if unauthenticated
 * / not an admin — callers translate null into FORBIDDEN.
 */
async function requireAdmin(): Promise<string | null> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (user?.role !== 'ADMIN') return null;
  return userId;
}

export async function updateBudgetTemplate(category: TaskCategory, input: unknown): Promise<AdminResult> {
  if (!(await requireAdmin())) return { ok: false, error: 'FORBIDDEN' };
  const parsed = budgetTemplateInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'INVALID' };
  const existing = await prisma.budgetTemplate.findUnique({ where: { category }, select: { id: true } });
  if (!existing) return { ok: false, error: 'NOT_FOUND' };
  await prisma.budgetTemplate.update({ where: { category }, data: parsed.data });
  return { ok: true };
}

export async function setBudgetTemplateActive(category: TaskCategory, active: boolean): Promise<AdminResult> {
  if (!(await requireAdmin())) return { ok: false, error: 'FORBIDDEN' };
  const existing = await prisma.budgetTemplate.findUnique({ where: { category }, select: { id: true } });
  if (!existing) return { ok: false, error: 'NOT_FOUND' };
  await prisma.budgetTemplate.update({ where: { category }, data: { active } });
  return { ok: true };
}

export async function reorderBudgetTemplate(category: TaskCategory, sortOrder: number): Promise<AdminResult> {
  if (!(await requireAdmin())) return { ok: false, error: 'FORBIDDEN' };
  if (!Number.isInteger(sortOrder)) return { ok: false, error: 'INVALID' };
  const existing = await prisma.budgetTemplate.findUnique({ where: { category }, select: { id: true } });
  if (!existing) return { ok: false, error: 'NOT_FOUND' };
  await prisma.budgetTemplate.update({ where: { category }, data: { sortOrder } });
  return { ok: true };
}
