'use server';

import type { VendorQuoteStatus } from '@prisma/client';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getCurrentWedding } from '@/lib/wedding/queries';
import { privateVendorSchema, quoteInput } from '@/lib/vendors/schema';
import { setTaskEstimatedCost } from '@/lib/actions/budget';
import { setTaskStatus } from '@/lib/actions/checklist';

export type VendorActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: 'UNAUTHENTICATED' | 'INVALID' | 'NOT_FOUND' };

async function resolveWedding(): Promise<
  { ok: true; weddingId: string } | { ok: false; error: 'UNAUTHENTICATED' | 'NOT_FOUND' }
> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: 'UNAUTHENTICATED' };
  const wedding = await getCurrentWedding(session.user.id);
  if (!wedding) return { ok: false, error: 'NOT_FOUND' };
  return { ok: true, weddingId: wedding.id };
}

/** A vendor the caller may act on: global, or their own private one. */
async function visibleVendor(weddingId: string, vendorId: string) {
  return prisma.vendor.findFirst({
    where: { id: vendorId, OR: [{ weddingId: null }, { weddingId }] },
    select: { id: true },
  });
}

export async function toggleShortlist(vendorId: string): Promise<VendorActionResult> {
  const w = await resolveWedding();
  if (!w.ok) return w;
  if (!(await visibleVendor(w.weddingId, vendorId))) return { ok: false, error: 'NOT_FOUND' };
  const existing = await prisma.vendorQuote.findUnique({
    where: { weddingId_vendorId: { weddingId: w.weddingId, vendorId } },
  });
  if (existing) {
    await prisma.vendorQuote.delete({ where: { id: existing.id } });
  } else {
    await prisma.vendorQuote.upsert({
      where: { weddingId_vendorId: { weddingId: w.weddingId, vendorId } },
      create: { weddingId: w.weddingId, vendorId, status: 'CONSIDERING' },
      update: {},
    });
  }
  return { ok: true };
}

async function upsertQuote(weddingId: string, vendorId: string, data: Record<string, unknown>) {
  return prisma.vendorQuote.upsert({
    where: { weddingId_vendorId: { weddingId, vendorId } },
    create: { weddingId, vendorId, status: 'CONSIDERING', ...data },
    update: data,
  });
}

export async function setQuoteStatus(vendorId: string, status: VendorQuoteStatus): Promise<VendorActionResult> {
  const w = await resolveWedding();
  if (!w.ok) return w;
  const parsed = quoteInput.pick({ status: true }).safeParse({ status });
  if (!parsed.success) return { ok: false, error: 'INVALID' };
  if (!(await visibleVendor(w.weddingId, vendorId))) return { ok: false, error: 'NOT_FOUND' };
  await upsertQuote(w.weddingId, vendorId, { status: parsed.data.status });
  return { ok: true };
}

export async function setQuoteAmount(vendorId: string, amount: number | null): Promise<VendorActionResult> {
  const w = await resolveWedding();
  if (!w.ok) return w;
  const parsed = quoteInput.pick({ amount: true }).safeParse({ amount });
  if (!parsed.success) return { ok: false, error: 'INVALID' };
  if (!(await visibleVendor(w.weddingId, vendorId))) return { ok: false, error: 'NOT_FOUND' };
  await upsertQuote(w.weddingId, vendorId, { amount: parsed.data.amount ?? null });
  return { ok: true };
}

export async function setQuoteNotes(vendorId: string, notes: string | null): Promise<VendorActionResult> {
  const w = await resolveWedding();
  if (!w.ok) return w;
  if (!(await visibleVendor(w.weddingId, vendorId))) return { ok: false, error: 'NOT_FOUND' };
  await upsertQuote(w.weddingId, vendorId, { notes: notes?.trim() || null });
  return { ok: true };
}

export async function linkQuoteToTask(vendorId: string, taskId: string | null): Promise<VendorActionResult> {
  const w = await resolveWedding();
  if (!w.ok) return w;
  if (!(await visibleVendor(w.weddingId, vendorId))) return { ok: false, error: 'NOT_FOUND' };
  if (taskId) {
    const task = await prisma.task.findFirst({ where: { id: taskId, weddingId: w.weddingId }, select: { id: true } });
    if (!task) return { ok: false, error: 'NOT_FOUND' };
  }
  await upsertQuote(w.weddingId, vendorId, { taskId });
  return { ok: true };
}

export async function pushQuoteToBudget(vendorId: string, opts: { paid: boolean }): Promise<VendorActionResult> {
  const w = await resolveWedding();
  if (!w.ok) return w;
  const quote = await prisma.vendorQuote.findUnique({
    where: { weddingId_vendorId: { weddingId: w.weddingId, vendorId } },
    select: { amount: true, taskId: true },
  });
  if (!quote) return { ok: false, error: 'NOT_FOUND' };
  if (quote.taskId == null || quote.amount == null) return { ok: false, error: 'INVALID' };
  // Reuse the Phase 5 task actions (each re-checks ownership of the task).
  const result = opts.paid
    ? await setTaskStatus(quote.taskId, true, quote.amount)
    : await setTaskEstimatedCost(quote.taskId, quote.amount);
  if (!result.ok) return { ok: false, error: result.error === 'INVALID' ? 'INVALID' : 'NOT_FOUND' };
  return { ok: true };
}

export async function addPrivateVendor(input: unknown): Promise<VendorActionResult> {
  const w = await resolveWedding();
  if (!w.ok) return w;
  const parsed = privateVendorSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'INVALID' };
  const { notes, ...fields } = parsed.data;
  const vendor = await prisma.vendor.create({
    data: { ...fields, weddingId: w.weddingId, verified: false, isPremium: false, active: true },
  });
  // A private vendor is on the couple's list immediately.
  await prisma.vendorQuote.upsert({
    where: { weddingId_vendorId: { weddingId: w.weddingId, vendorId: vendor.id } },
    create: { weddingId: w.weddingId, vendorId: vendor.id, status: 'CONSIDERING', notes: notes ?? null },
    update: {},
  });
  return { ok: true, id: vendor.id };
}

async function ownedPrivateVendor(weddingId: string, vendorId: string) {
  return prisma.vendor.findFirst({ where: { id: vendorId, weddingId }, select: { id: true } });
}

export async function editPrivateVendor(vendorId: string, input: unknown): Promise<VendorActionResult> {
  const w = await resolveWedding();
  if (!w.ok) return w;
  const parsed = privateVendorSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'INVALID' };
  if (!(await ownedPrivateVendor(w.weddingId, vendorId))) return { ok: false, error: 'NOT_FOUND' };
  const { notes, ...fields } = parsed.data;
  await prisma.vendor.update({ where: { id: vendorId }, data: fields });
  await upsertQuote(w.weddingId, vendorId, { notes: notes ?? null });
  return { ok: true, id: vendorId };
}

export async function deletePrivateVendor(vendorId: string): Promise<VendorActionResult> {
  const w = await resolveWedding();
  if (!w.ok) return w;
  if (!(await ownedPrivateVendor(w.weddingId, vendorId))) return { ok: false, error: 'NOT_FOUND' };
  await prisma.vendor.delete({ where: { id: vendorId } });
  return { ok: true, id: vendorId };
}
