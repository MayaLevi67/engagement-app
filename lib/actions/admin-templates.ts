'use server';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { templateSchema } from '@/lib/checklist/schema';

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
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (user?.role !== 'ADMIN') return null;
  return userId;
}

export async function createTemplate(input: unknown): Promise<AdminResult> {
  const adminId = await requireAdmin();
  if (!adminId) return { ok: false, error: 'FORBIDDEN' };
  const parsed = templateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'INVALID' };
  const created = await prisma.checklistTemplate.create({ data: parsed.data });
  return { ok: true, id: created.id };
}

export async function updateTemplate(id: string, input: unknown): Promise<AdminResult> {
  const adminId = await requireAdmin();
  if (!adminId) return { ok: false, error: 'FORBIDDEN' };
  const parsed = templateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'INVALID' };
  const existing = await prisma.checklistTemplate.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return { ok: false, error: 'NOT_FOUND' };
  await prisma.checklistTemplate.update({ where: { id }, data: parsed.data });
  return { ok: true, id };
}

export async function deleteTemplate(id: string): Promise<AdminResult> {
  const adminId = await requireAdmin();
  if (!adminId) return { ok: false, error: 'FORBIDDEN' };
  const existing = await prisma.checklistTemplate.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return { ok: false, error: 'NOT_FOUND' };
  // sourceTemplateId is provenance-only (a plain nullable String, not an FK), so
  // null it out on existing tasks explicitly before deleting so those couples'
  // tasks keep working — just without the template link.
  await prisma.$transaction([
    prisma.task.updateMany({ where: { sourceTemplateId: id }, data: { sourceTemplateId: null } }),
    prisma.checklistTemplate.delete({ where: { id } }),
  ]);
  return { ok: true, id };
}

export async function reorderTemplate(id: string, sortOrder: number): Promise<AdminResult> {
  const adminId = await requireAdmin();
  if (!adminId) return { ok: false, error: 'FORBIDDEN' };
  if (!Number.isInteger(sortOrder)) return { ok: false, error: 'INVALID' };
  const existing = await prisma.checklistTemplate.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return { ok: false, error: 'NOT_FOUND' };
  await prisma.checklistTemplate.update({ where: { id }, data: { sortOrder } });
  return { ok: true, id };
}

export async function setTemplateActive(id: string, active: boolean): Promise<AdminResult> {
  const adminId = await requireAdmin();
  if (!adminId) return { ok: false, error: 'FORBIDDEN' };
  const existing = await prisma.checklistTemplate.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return { ok: false, error: 'NOT_FOUND' };
  await prisma.checklistTemplate.update({ where: { id }, data: { active } });
  return { ok: true, id };
}
