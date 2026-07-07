'use server';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { vendorSchema, vendorImageSchema } from '@/lib/vendors/schema';

export type AdminResult =
  | { ok: true; id?: string }
  | { ok: false; error: 'FORBIDDEN' | 'INVALID' | 'NOT_FOUND' };

async function requireAdmin(): Promise<string | null> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (user?.role !== 'ADMIN') return null;
  return userId;
}

/** Admin actions operate ONLY on global vendors (weddingId: null). */
async function globalVendor(id: string) {
  return prisma.vendor.findFirst({ where: { id, weddingId: null }, select: { id: true } });
}

export async function createVendor(input: unknown): Promise<AdminResult> {
  if (!(await requireAdmin())) return { ok: false, error: 'FORBIDDEN' };
  const parsed = vendorSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'INVALID' };
  const created = await prisma.vendor.create({ data: { ...parsed.data, weddingId: null } });
  return { ok: true, id: created.id };
}

export async function updateVendor(id: string, input: unknown): Promise<AdminResult> {
  if (!(await requireAdmin())) return { ok: false, error: 'FORBIDDEN' };
  const parsed = vendorSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'INVALID' };
  if (!(await globalVendor(id))) return { ok: false, error: 'NOT_FOUND' };
  await prisma.vendor.update({ where: { id }, data: parsed.data });
  return { ok: true, id };
}

export async function deleteVendor(id: string): Promise<AdminResult> {
  if (!(await requireAdmin())) return { ok: false, error: 'FORBIDDEN' };
  if (!(await globalVendor(id))) return { ok: false, error: 'NOT_FOUND' };
  await prisma.vendor.delete({ where: { id } });
  return { ok: true, id };
}

async function setVendorFlag(id: string, data: Record<string, unknown>): Promise<AdminResult> {
  if (!(await requireAdmin())) return { ok: false, error: 'FORBIDDEN' };
  if (!(await globalVendor(id))) return { ok: false, error: 'NOT_FOUND' };
  await prisma.vendor.update({ where: { id }, data });
  return { ok: true, id };
}

// NOTE: every export in a 'use server' file MUST be `async function` — Next.js 16
// rejects a non-async export at build time (the Phase 5 lesson). Do NOT write
// `export function setVendorActive(...) { return setVendorFlag(...) }`.
export async function setVendorActive(id: string, active: boolean): Promise<AdminResult> {
  return setVendorFlag(id, { active });
}
export async function setVendorVerified(id: string, verified: boolean): Promise<AdminResult> {
  return setVendorFlag(id, { verified });
}
export async function setVendorPremium(id: string, isPremium: boolean): Promise<AdminResult> {
  return setVendorFlag(id, { isPremium });
}

export async function reorderVendor(id: string, sortOrder: number): Promise<AdminResult> {
  if (!(await requireAdmin())) return { ok: false, error: 'FORBIDDEN' };
  if (!Number.isInteger(sortOrder)) return { ok: false, error: 'INVALID' };
  if (!(await globalVendor(id))) return { ok: false, error: 'NOT_FOUND' };
  await prisma.vendor.update({ where: { id }, data: { sortOrder } });
  return { ok: true, id };
}

// ---- Images (parent must be a global vendor) ----
export async function addVendorImage(vendorId: string, input: unknown): Promise<AdminResult> {
  if (!(await requireAdmin())) return { ok: false, error: 'FORBIDDEN' };
  const parsed = vendorImageSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'INVALID' };
  if (!(await globalVendor(vendorId))) return { ok: false, error: 'NOT_FOUND' };
  const created = await prisma.vendorImage.create({ data: { vendorId, ...parsed.data } });
  return { ok: true, id: created.id };
}

export async function updateVendorImage(id: string, input: unknown): Promise<AdminResult> {
  if (!(await requireAdmin())) return { ok: false, error: 'FORBIDDEN' };
  const parsed = vendorImageSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'INVALID' };
  const existing = await prisma.vendorImage.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return { ok: false, error: 'NOT_FOUND' };
  await prisma.vendorImage.update({ where: { id }, data: parsed.data });
  return { ok: true, id };
}

export async function deleteVendorImage(id: string): Promise<AdminResult> {
  if (!(await requireAdmin())) return { ok: false, error: 'FORBIDDEN' };
  const existing = await prisma.vendorImage.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return { ok: false, error: 'NOT_FOUND' };
  await prisma.vendorImage.delete({ where: { id } });
  return { ok: true, id };
}

export async function reorderVendorImage(id: string, sortOrder: number): Promise<AdminResult> {
  if (!(await requireAdmin())) return { ok: false, error: 'FORBIDDEN' };
  if (!Number.isInteger(sortOrder)) return { ok: false, error: 'INVALID' };
  const existing = await prisma.vendorImage.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return { ok: false, error: 'NOT_FOUND' };
  await prisma.vendorImage.update({ where: { id }, data: { sortOrder } });
  return { ok: true, id };
}
