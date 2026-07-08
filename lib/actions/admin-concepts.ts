'use server';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { conceptSchema, conceptElementSchema, conceptImageSchema } from '@/lib/concepts/schema';

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

// ---- Concept ----
export async function createConcept(input: unknown): Promise<AdminResult> {
  if (!(await requireAdmin())) return { ok: false, error: 'FORBIDDEN' };
  const parsed = conceptSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'INVALID' };
  const created = await prisma.concept.create({ data: parsed.data });
  return { ok: true, id: created.id };
}

export async function updateConcept(id: string, input: unknown): Promise<AdminResult> {
  if (!(await requireAdmin())) return { ok: false, error: 'FORBIDDEN' };
  const parsed = conceptSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'INVALID' };
  const existing = await prisma.concept.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return { ok: false, error: 'NOT_FOUND' };
  // isPremium/active/sortOrder are owned by setConceptActive/setConceptPremium/reorderConcept.
  // Write only content fields so a partial edit can't reset them via schema defaults.
  const d = parsed.data;
  await prisma.concept.update({
    where: { id },
    data: {
      title_en: d.title_en,
      title_he: d.title_he,
      titleLocale: d.titleLocale,
      tagline_en: d.tagline_en,
      tagline_he: d.tagline_he,
      description_en: d.description_en,
      description_he: d.description_he,
      palette: d.palette,
    },
  });
  return { ok: true, id };
}

export async function deleteConcept(id: string): Promise<AdminResult> {
  if (!(await requireAdmin())) return { ok: false, error: 'FORBIDDEN' };
  const existing = await prisma.concept.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return { ok: false, error: 'NOT_FOUND' };
  // Elements cascade-delete with the concept, but pushed tasks keep a dangling
  // provenance id; null it first so those tasks stay clean.
  const elements = await prisma.conceptElement.findMany({ where: { conceptId: id }, select: { id: true } });
  await prisma.$transaction([
    prisma.task.updateMany({
      where: { sourceConceptElementId: { in: elements.map((e) => e.id) } },
      data: { sourceConceptElementId: null },
    }),
    prisma.concept.delete({ where: { id } }),
  ]);
  return { ok: true, id };
}

export async function setConceptActive(id: string, active: boolean): Promise<AdminResult> {
  if (!(await requireAdmin())) return { ok: false, error: 'FORBIDDEN' };
  const existing = await prisma.concept.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return { ok: false, error: 'NOT_FOUND' };
  await prisma.concept.update({ where: { id }, data: { active } });
  return { ok: true, id };
}

export async function setConceptPremium(id: string, isPremium: boolean): Promise<AdminResult> {
  if (!(await requireAdmin())) return { ok: false, error: 'FORBIDDEN' };
  const existing = await prisma.concept.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return { ok: false, error: 'NOT_FOUND' };
  await prisma.concept.update({ where: { id }, data: { isPremium } });
  return { ok: true, id };
}

export async function reorderConcept(id: string, sortOrder: number): Promise<AdminResult> {
  if (!(await requireAdmin())) return { ok: false, error: 'FORBIDDEN' };
  if (!Number.isInteger(sortOrder)) return { ok: false, error: 'INVALID' };
  const existing = await prisma.concept.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return { ok: false, error: 'NOT_FOUND' };
  await prisma.concept.update({ where: { id }, data: { sortOrder } });
  return { ok: true, id };
}

// ---- Element ----
export async function createElement(conceptId: string, input: unknown): Promise<AdminResult> {
  if (!(await requireAdmin())) return { ok: false, error: 'FORBIDDEN' };
  const parsed = conceptElementSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'INVALID' };
  const concept = await prisma.concept.findUnique({ where: { id: conceptId }, select: { id: true } });
  if (!concept) return { ok: false, error: 'NOT_FOUND' };
  const created = await prisma.conceptElement.create({ data: { conceptId, ...parsed.data } });
  return { ok: true, id: created.id };
}

export async function updateElement(id: string, input: unknown): Promise<AdminResult> {
  if (!(await requireAdmin())) return { ok: false, error: 'FORBIDDEN' };
  const parsed = conceptElementSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'INVALID' };
  const existing = await prisma.conceptElement.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return { ok: false, error: 'NOT_FOUND' };
  await prisma.conceptElement.update({ where: { id }, data: parsed.data });
  return { ok: true, id };
}

export async function deleteElement(id: string): Promise<AdminResult> {
  if (!(await requireAdmin())) return { ok: false, error: 'FORBIDDEN' };
  const existing = await prisma.conceptElement.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return { ok: false, error: 'NOT_FOUND' };
  await prisma.$transaction([
    prisma.task.updateMany({ where: { sourceConceptElementId: id }, data: { sourceConceptElementId: null } }),
    prisma.conceptElement.delete({ where: { id } }),
  ]);
  return { ok: true, id };
}

export async function reorderElement(id: string, sortOrder: number): Promise<AdminResult> {
  if (!(await requireAdmin())) return { ok: false, error: 'FORBIDDEN' };
  if (!Number.isInteger(sortOrder)) return { ok: false, error: 'INVALID' };
  const existing = await prisma.conceptElement.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return { ok: false, error: 'NOT_FOUND' };
  await prisma.conceptElement.update({ where: { id }, data: { sortOrder } });
  return { ok: true, id };
}

// ---- Image ----
export async function addImage(conceptId: string, input: unknown): Promise<AdminResult> {
  if (!(await requireAdmin())) return { ok: false, error: 'FORBIDDEN' };
  const parsed = conceptImageSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'INVALID' };
  const concept = await prisma.concept.findUnique({ where: { id: conceptId }, select: { id: true } });
  if (!concept) return { ok: false, error: 'NOT_FOUND' };
  const created = await prisma.conceptImage.create({ data: { conceptId, ...parsed.data } });
  return { ok: true, id: created.id };
}

export async function updateImage(id: string, input: unknown): Promise<AdminResult> {
  if (!(await requireAdmin())) return { ok: false, error: 'FORBIDDEN' };
  const parsed = conceptImageSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'INVALID' };
  const existing = await prisma.conceptImage.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return { ok: false, error: 'NOT_FOUND' };
  await prisma.conceptImage.update({ where: { id }, data: parsed.data });
  return { ok: true, id };
}

export async function deleteImage(id: string): Promise<AdminResult> {
  if (!(await requireAdmin())) return { ok: false, error: 'FORBIDDEN' };
  const existing = await prisma.conceptImage.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return { ok: false, error: 'NOT_FOUND' };
  await prisma.conceptImage.delete({ where: { id } });
  return { ok: true, id };
}

export async function reorderImage(id: string, sortOrder: number): Promise<AdminResult> {
  if (!(await requireAdmin())) return { ok: false, error: 'FORBIDDEN' };
  if (!Number.isInteger(sortOrder)) return { ok: false, error: 'INVALID' };
  const existing = await prisma.conceptImage.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return { ok: false, error: 'NOT_FOUND' };
  await prisma.conceptImage.update({ where: { id }, data: { sortOrder } });
  return { ok: true, id };
}
