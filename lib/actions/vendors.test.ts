import {
  describe, it, expect, vi, beforeEach, type Mock,
} from 'vitest';

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/wedding/queries', () => ({ getCurrentWedding: vi.fn() }));
vi.mock('@/lib/actions/budget', () => ({ setTaskEstimatedCost: vi.fn() }));
vi.mock('@/lib/actions/checklist', () => ({ setTaskStatus: vi.fn() }));
vi.mock('@/lib/db', () => ({
  prisma: {
    vendor: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    vendorQuote: { findUnique: vi.fn(), upsert: vi.fn(), delete: vi.fn(), update: vi.fn() },
    task: { findFirst: vi.fn() },
  },
}));

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getCurrentWedding } from '@/lib/wedding/queries';
import { setTaskEstimatedCost } from '@/lib/actions/budget';
import { setTaskStatus } from '@/lib/actions/checklist';
import {
  toggleShortlist, setQuoteStatus, setQuoteAmount, setQuoteNotes, linkQuoteToTask, pushQuoteToBudget,
  addPrivateVendor, editPrivateVendor, deletePrivateVendor,
} from './vendors';

beforeEach(() => {
  vi.clearAllMocks();
  (auth as unknown as Mock).mockResolvedValue({ user: { id: 'u1' } });
  (getCurrentWedding as unknown as Mock).mockResolvedValue({ id: 'wed1', premiumUnlockedAt: new Date() });
});

describe('toggleShortlist', () => {
  it('creates a CONSIDERING quote for a visible vendor when none exists', async () => {
    (prisma.vendor.findFirst as Mock).mockResolvedValue({ id: 'v1' });
    (prisma.vendorQuote.findUnique as Mock).mockResolvedValue(null);
    expect(await toggleShortlist('v1')).toEqual({ ok: true });
    expect(prisma.vendorQuote.upsert).toHaveBeenCalled();
  });
  it('removes a bare shortlist quote when one exists', async () => {
    (prisma.vendor.findFirst as Mock).mockResolvedValue({ id: 'v1' });
    (prisma.vendorQuote.findUnique as Mock).mockResolvedValue({
      id: 'q1', status: 'CONSIDERING', amount: null, notes: null, taskId: null,
    });
    expect(await toggleShortlist('v1')).toEqual({ ok: true });
    expect(prisma.vendorQuote.delete).toHaveBeenCalledWith({ where: { id: 'q1' } });
  });
  it('preserves a quote that carries data instead of deleting it', async () => {
    (prisma.vendor.findFirst as Mock).mockResolvedValue({ id: 'v1' });
    (prisma.vendorQuote.findUnique as Mock).mockResolvedValue({
      id: 'q1', status: 'BOOKED', amount: 9000, notes: null, taskId: 't1',
    });
    expect(await toggleShortlist('v1')).toEqual({ ok: true });
    expect(prisma.vendorQuote.delete).not.toHaveBeenCalled();
  });
  it('rejects a vendor the couple cannot see', async () => {
    (prisma.vendor.findFirst as Mock).mockResolvedValue(null);
    expect(await toggleShortlist('vX')).toEqual({ ok: false, error: 'NOT_FOUND' });
  });
});

describe('setQuoteAmount', () => {
  it('rejects a negative amount', async () => {
    expect(await setQuoteAmount('v1', -5)).toEqual({ ok: false, error: 'INVALID' });
  });
});

describe('linkQuoteToTask', () => {
  it('rejects a task the couple does not own', async () => {
    (prisma.task.findFirst as Mock).mockResolvedValue(null);
    expect(await linkQuoteToTask('v1', 'tX')).toEqual({ ok: false, error: 'NOT_FOUND' });
  });
});

describe('pushQuoteToBudget', () => {
  it('writes the estimate (planned) when not paid', async () => {
    (prisma.vendorQuote.findUnique as Mock).mockResolvedValue({ id: 'q1', amount: 8000, taskId: 't1' });
    (setTaskEstimatedCost as Mock).mockResolvedValue({ ok: true });
    expect(await pushQuoteToBudget('v1', { paid: false })).toEqual({ ok: true });
    expect(setTaskEstimatedCost).toHaveBeenCalledWith('t1', 8000);
    expect(setTaskStatus).not.toHaveBeenCalled();
  });
  it('marks the task done with the amount when paid', async () => {
    (prisma.vendorQuote.findUnique as Mock).mockResolvedValue({ id: 'q1', amount: 8000, taskId: 't1' });
    (setTaskStatus as Mock).mockResolvedValue({ ok: true });
    expect(await pushQuoteToBudget('v1', { paid: true })).toEqual({ ok: true });
    expect(setTaskStatus).toHaveBeenCalledWith('t1', true, 8000);
  });
  it('rejects when there is no linked task or no amount', async () => {
    (prisma.vendorQuote.findUnique as Mock).mockResolvedValue({ id: 'q1', amount: null, taskId: 't1' });
    expect(await pushQuoteToBudget('v1', { paid: false })).toEqual({ ok: false, error: 'INVALID' });
    (prisma.vendorQuote.findUnique as Mock).mockResolvedValue({ id: 'q1', amount: 8000, taskId: null });
    expect(await pushQuoteToBudget('v1', { paid: false })).toEqual({ ok: false, error: 'INVALID' });
  });
});

describe('addPrivateVendor', () => {
  it('creates a wedding-scoped vendor + a CONSIDERING quote', async () => {
    (prisma.vendor.create as Mock).mockResolvedValue({ id: 'pv1' });
    const r = await addPrivateVendor({ name_en: 'Cousin Dan', name_he: 'דן', category: 'MUSIC' });
    expect(r).toEqual({ ok: true, id: 'pv1' });
    expect(prisma.vendor.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ weddingId: 'wed1', category: 'MUSIC' }) }),
    );
    expect(prisma.vendorQuote.upsert).toHaveBeenCalled();
  });
  it('rejects invalid input', async () => {
    expect(await addPrivateVendor({ name_en: '', name_he: '', category: 'MUSIC' })).toEqual({ ok: false, error: 'INVALID' });
  });
});

describe('setQuoteNotes', () => {
  it('rejects an over-length note', async () => {
    expect(await setQuoteNotes('v1', 'x'.repeat(2001))).toEqual({ ok: false, error: 'INVALID' });
    expect(prisma.vendorQuote.upsert).not.toHaveBeenCalled();
  });
});

describe('editPrivateVendor', () => {
  it('rejects a vendor that is not the couple\'s own', async () => {
    (prisma.vendor.findFirst as Mock).mockResolvedValue(null);
    expect(await editPrivateVendor('vX', { name_en: 'A', name_he: 'א', category: 'MUSIC' })).toEqual({ ok: false, error: 'NOT_FOUND' });
    expect(prisma.vendor.update).not.toHaveBeenCalled();
  });
  it('propagates notes to the quote on success', async () => {
    (prisma.vendor.findFirst as Mock).mockResolvedValue({ id: 'pv1' });
    expect(
      await editPrivateVendor('pv1', { name_en: 'A', name_he: 'א', category: 'MUSIC', notes: 'call back' }),
    ).toEqual({ ok: true, id: 'pv1' });
    expect(prisma.vendor.update).toHaveBeenCalled();
    expect(prisma.vendorQuote.upsert).toHaveBeenCalled();
  });
});

describe('deletePrivateVendor', () => {
  it('rejects a vendor that is not the couple\'s own', async () => {
    (prisma.vendor.findFirst as Mock).mockResolvedValue(null);
    expect(await deletePrivateVendor('vX')).toEqual({ ok: false, error: 'NOT_FOUND' });
    expect(prisma.vendor.delete).not.toHaveBeenCalled();
  });
});

describe('premium-vendor gating', () => {
  // Each of these acts on a single loaded vendor; a premium vendor is paywalled
  // for a free couple, but a non-premium vendor stays free.
  const gated: Array<[string, () => Promise<unknown>]> = [
    ['toggleShortlist', () => toggleShortlist('v1')],
    ['setQuoteStatus', () => setQuoteStatus('v1', 'CONSIDERING')],
    ['setQuoteAmount', () => setQuoteAmount('v1', 8000)],
    ['setQuoteNotes', () => setQuoteNotes('v1', 'hi')],
    ['linkQuoteToTask', () => linkQuoteToTask('v1', null)],
  ];

  it.each(gated)('%s rejects a premium vendor for a free wedding', async (_name, run) => {
    (getCurrentWedding as unknown as Mock).mockResolvedValue({ id: 'wed1', premiumUnlockedAt: null });
    (prisma.vendor.findFirst as Mock).mockResolvedValue({ id: 'v1', isPremium: true });
    (prisma.vendorQuote.findUnique as Mock).mockResolvedValue(null);
    expect(await run()).toEqual({ ok: false, error: 'PREMIUM_REQUIRED' });
    expect(prisma.vendorQuote.upsert).not.toHaveBeenCalled();
    expect(prisma.vendorQuote.delete).not.toHaveBeenCalled();
  });

  it.each(gated)('%s still works on a non-premium vendor for a free wedding', async (_name, run) => {
    (getCurrentWedding as unknown as Mock).mockResolvedValue({ id: 'wed1', premiumUnlockedAt: null });
    (prisma.vendor.findFirst as Mock).mockResolvedValue({ id: 'v1', isPremium: false });
    (prisma.vendorQuote.findUnique as Mock).mockResolvedValue(null);
    expect(await run()).toEqual({ ok: true });
  });

  it('pushQuoteToBudget rejects a free wedding (it writes budget)', async () => {
    (getCurrentWedding as unknown as Mock).mockResolvedValue({ id: 'wed1', premiumUnlockedAt: null });
    expect(await pushQuoteToBudget('v1', { paid: false })).toEqual({ ok: false, error: 'PREMIUM_REQUIRED' });
    expect(prisma.vendorQuote.findUnique).not.toHaveBeenCalled();
  });
});
