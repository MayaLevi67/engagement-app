import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/db', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    vendor: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), delete: vi.fn() },
    vendorImage: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn(), delete: vi.fn() },
  },
}));

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import * as adminVendors from './admin-vendors';
import { createVendor, updateVendor, deleteVendor, addVendorImage } from './admin-vendors';

function asAdmin(isAdmin: boolean) {
  (auth as unknown as Mock).mockResolvedValue(isAdmin ? { user: { id: 'a1' } } : null);
  (prisma.user.findUnique as unknown as Mock).mockResolvedValue(isAdmin ? { role: 'ADMIN' } : { role: 'USER' });
}
beforeEach(() => vi.clearAllMocks());

const gatedCalls: Record<string, () => Promise<unknown>> = {
  createVendor: () => createVendor({ name_en: 'X', name_he: 'י', category: 'MUSIC' }),
  updateVendor: () => updateVendor('v1', { name_en: 'X', name_he: 'י', category: 'MUSIC' }),
  deleteVendor: () => deleteVendor('v1'),
  setVendorActive: () => adminVendors.setVendorActive('v1', true),
  setVendorVerified: () => adminVendors.setVendorVerified('v1', true),
  setVendorPremium: () => adminVendors.setVendorPremium('v1', true),
  reorderVendor: () => adminVendors.reorderVendor('v1', 5),
  addVendorImage: () => addVendorImage('v1', { url: 'https://x.test/a.jpg' }),
  updateVendorImage: () => adminVendors.updateVendorImage('i1', { url: 'https://x.test/a.jpg' }),
  deleteVendorImage: () => adminVendors.deleteVendorImage('i1'),
  reorderVendorImage: () => adminVendors.reorderVendorImage('i1', 5),
};

describe('admin gate', () => {
  it('every export is covered by the gated-calls map', () => {
    expect(Object.keys(adminVendors).sort()).toEqual(Object.keys(gatedCalls).sort());
  });
  it.each(Object.entries(gatedCalls))('%s rejects a non-admin', async (_n, call) => {
    asAdmin(false);
    expect(await call()).toEqual({ ok: false, error: 'FORBIDDEN' });
  });
});

describe('createVendor', () => {
  it('creates a GLOBAL vendor (weddingId null) and returns id', async () => {
    asAdmin(true);
    (prisma.vendor.create as unknown as Mock).mockResolvedValue({ id: 'v-new' });
    const r = await createVendor({ name_en: 'Lumière', name_he: 'לומייר', category: 'PHOTOGRAPHY' });
    expect(r).toEqual({ ok: true, id: 'v-new' });
    expect(prisma.vendor.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ weddingId: null }) }),
    );
  });
  it('rejects invalid input', async () => {
    asAdmin(true);
    expect(await createVendor({ name_en: '', name_he: '', category: 'MUSIC' })).toEqual({ ok: false, error: 'INVALID' });
  });
});

describe('updateVendor refuses a private vendor', () => {
  it('returns NOT_FOUND when the target is couple-private', async () => {
    asAdmin(true);
    (prisma.vendor.findFirst as unknown as Mock).mockResolvedValue(null); // scoped to weddingId:null → not found
    expect(await updateVendor('pv1', { name_en: 'X', name_he: 'י', category: 'MUSIC' })).toEqual({ ok: false, error: 'NOT_FOUND' });
  });
});
