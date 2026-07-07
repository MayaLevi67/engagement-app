import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';

// `VendorsAdmin` calls `useRouter` (next/navigation) to refresh after
// mutations, and imports the 'use server' admin-vendors actions module, which
// transitively pulls in NextAuth (`@/lib/auth` -> next-auth -> next/server).
// Neither resolves in this Vite/vitest environment unmocked; mock both the
// same way the sibling admin tests do (concepts-admin.test.tsx mocks
// next/navigation, admin-vendors.test.ts's peers mock the actions module).
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@/lib/actions/admin-vendors', () => ({
  createVendor: vi.fn(async () => ({ ok: true, id: 'new' })),
  updateVendor: vi.fn(async () => ({ ok: true })),
  deleteVendor: vi.fn(async () => ({ ok: true })),
  setVendorActive: vi.fn(async () => ({ ok: true })),
  setVendorVerified: vi.fn(async () => ({ ok: true })),
  setVendorPremium: vi.fn(async () => ({ ok: true })),
  addVendorImage: vi.fn(async () => ({ ok: true, id: 'img1' })),
  updateVendorImage: vi.fn(async () => ({ ok: true })),
  deleteVendorImage: vi.fn(async () => ({ ok: true })),
  reorderVendor: vi.fn(async () => ({ ok: true })),
  reorderVendorImage: vi.fn(async () => ({ ok: true })),
}));

import { VendorsAdmin } from './vendors-admin';

describe('VendorsAdmin', () => {
  it('renders vendor rows and the add control', () => {
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <VendorsAdmin vendors={[{
          id: 'v1', name_en: 'Lumière', name_he: 'לומייר', titleLocale: 'AUTO',
          category: 'PHOTOGRAPHY', city: 'Tel Aviv', priceMin: 8000, priceMax: 18000,
          email: null, phone: null, website: null, description_en: null, description_he: null,
          verified: true, isPremium: false, active: true, sortOrder: 10, images: [],
        }]} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText('Lumière')).toBeTruthy();
    expect(screen.getByText(/add vendor/i)).toBeTruthy();
  });
});
