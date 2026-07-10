'use server';

import type { VendorQuoteStatus } from '@prisma/client';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getCurrentWedding } from '@/lib/wedding/queries';
import { privateVendorSchema, quoteInput } from '@/lib/vendors/schema';
import { setTaskEstimatedCost } from '@/lib/actions/budget';
import { setTaskStatus } from '@/lib/actions/checklist';
import { recordTaskPayment } from '@/lib/actions/payments';
import { requireWedding, requirePremiumWedding } from '@/lib/premium/gate';
import { isPremium } from '@/lib/premium/entitlement';

export type VendorActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: 'UNAUTHENTICATED' | 'INVALID' | 'NOT_FOUND' | 'PREMIUM_REQUIRED' };

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
    select: { id: true, isPremium: true },
  });
}

export async function toggleShortlist(vendorId: string): Promise<VendorActionResult> {
  const g = await requireWedding();
  if (!g.ok) return g;
  const vendor = await visibleVendor(g.wedding.id, vendorId);
  if (!vendor) return { ok: false, error: 'NOT_FOUND' };
  if (vendor.isPremium && !isPremium(g.wedding)) return { ok: false, error: 'PREMIUM_REQUIRED' };
  const existing = await prisma.vendorQuote.findUnique({
    where: { weddingId_vendorId: { weddingId: g.wedding.id, vendorId } },
  });
  if (existing) {
    const isBare =
      existing.status === 'CONSIDERING' &&
      existing.amount == null &&
      (existing.notes == null || existing.notes === '') &&
      existing.taskId == null;
    if (isBare) {
      // Only a bare shortlist entry is safe to remove on a one-click card toggle.
      // A quote that carries data (amount/notes/BOOKED/linked task) is preserved —
      // removing it is a deliberate detail-page action, not an accidental toggle.
      await prisma.vendorQuote.delete({ where: { id: existing.id } });
    }
  } else {
    await prisma.vendorQuote.upsert({
      where: { weddingId_vendorId: { weddingId: g.wedding.id, vendorId } },
      create: { weddingId: g.wedding.id, vendorId, status: 'CONSIDERING' },
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
  const g = await requireWedding();
  if (!g.ok) return g;
  const parsed = quoteInput.pick({ status: true }).safeParse({ status });
  if (!parsed.success) return { ok: false, error: 'INVALID' };
  const vendor = await visibleVendor(g.wedding.id, vendorId);
  if (!vendor) return { ok: false, error: 'NOT_FOUND' };
  if (vendor.isPremium && !isPremium(g.wedding)) return { ok: false, error: 'PREMIUM_REQUIRED' };
  await upsertQuote(g.wedding.id, vendorId, { status: parsed.data.status });
  return { ok: true };
}

export async function setQuoteAmount(vendorId: string, amount: number | null): Promise<VendorActionResult> {
  const g = await requireWedding();
  if (!g.ok) return g;
  const parsed = quoteInput.pick({ amount: true }).safeParse({ amount });
  if (!parsed.success) return { ok: false, error: 'INVALID' };
  const vendor = await visibleVendor(g.wedding.id, vendorId);
  if (!vendor) return { ok: false, error: 'NOT_FOUND' };
  if (vendor.isPremium && !isPremium(g.wedding)) return { ok: false, error: 'PREMIUM_REQUIRED' };
  await upsertQuote(g.wedding.id, vendorId, { amount: parsed.data.amount ?? null });
  return { ok: true };
}

export async function setQuoteNotes(vendorId: string, notes: string | null): Promise<VendorActionResult> {
  const g = await requireWedding();
  if (!g.ok) return g;
  const parsed = quoteInput.pick({ notes: true }).safeParse({ notes });
  if (!parsed.success) return { ok: false, error: 'INVALID' };
  const vendor = await visibleVendor(g.wedding.id, vendorId);
  if (!vendor) return { ok: false, error: 'NOT_FOUND' };
  if (vendor.isPremium && !isPremium(g.wedding)) return { ok: false, error: 'PREMIUM_REQUIRED' };
  await upsertQuote(g.wedding.id, vendorId, { notes: parsed.data.notes ?? null });
  return { ok: true };
}

export async function linkQuoteToTask(vendorId: string, taskId: string | null): Promise<VendorActionResult> {
  const g = await requireWedding();
  if (!g.ok) return g;
  const vendor = await visibleVendor(g.wedding.id, vendorId);
  if (!vendor) return { ok: false, error: 'NOT_FOUND' };
  if (vendor.isPremium && !isPremium(g.wedding)) return { ok: false, error: 'PREMIUM_REQUIRED' };
  if (taskId) {
    const task = await prisma.task.findFirst({ where: { id: taskId, weddingId: g.wedding.id }, select: { id: true } });
    if (!task) return { ok: false, error: 'NOT_FOUND' };
  }
  await upsertQuote(g.wedding.id, vendorId, { taskId });
  return { ok: true };
}

export async function pushQuoteToBudget(vendorId: string, opts: { paid: boolean }): Promise<VendorActionResult> {
  const g = await requirePremiumWedding();
  if (!g.ok) return g;
  const quote = await prisma.vendorQuote.findUnique({
    where: { weddingId_vendorId: { weddingId: g.wedding.id, vendorId } },
    select: { amount: true, taskId: true },
  });
  if (!quote) return { ok: false, error: 'NOT_FOUND' };
  // Paid must have a positive amount (recordTaskPayment's ledger entry requires it) — otherwise
  // the task would be marked DONE with no payment recorded. The planned (non-paid) path keeps
  // accepting 0, matching setTaskEstimatedCost's own validation (taskAmountInput allows 0).
  if (quote.taskId == null || quote.amount == null || (opts.paid && quote.amount <= 0)) {
    return { ok: false, error: 'INVALID' };
  }
  // Reuse the Phase 5/6 task actions (each re-checks ownership of the task).
  if (opts.paid) {
    // Paid now means: complete the task and record a BOTH payment in the ledger.
    const doneRes = await setTaskStatus(quote.taskId, true);
    if (!doneRes.ok) return { ok: false, error: doneRes.error === 'INVALID' ? 'INVALID' : 'NOT_FOUND' };
    const payRes = await recordTaskPayment(quote.taskId, {
      amount: quote.amount, payer: 'BOTH', cost: quote.amount,
    });
    if (!payRes.ok) {
      return {
        ok: false,
        error: payRes.error === 'INVALID' ? 'INVALID'
          : payRes.error === 'PREMIUM_REQUIRED' ? 'PREMIUM_REQUIRED'
          : 'NOT_FOUND',
      };
    }
    return { ok: true };
  }
  const result = await setTaskEstimatedCost(quote.taskId, quote.amount);
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
