import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';

// The real `Link` from '@/lib/i18n/navigation' pulls in next-intl's
// createNavigation, which imports 'next/navigation' without an extension —
// that fails to resolve under Vitest's ESM resolver (a pre-existing
// environment quirk, unrelated to this component). Mirror the mocking idiom
// already used by concepts-view.test.tsx / budget-view.test.tsx.
vi.mock('@/lib/i18n/navigation', () => ({
  Link: (p: { href: string; children?: React.ReactNode; className?: string }) => (
    <a href={p.href} className={p.className}>{p.children}</a>
  ),
}));
vi.mock('@/lib/actions/vendors', () => ({
  toggleShortlist: vi.fn(async () => ({ ok: true })),
}));

import { VendorCard } from './vendor-card';

function renderCard(props: Parameters<typeof VendorCard>[0]) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <VendorCard {...props} />
    </NextIntlClientProvider>,
  );
}
const base = {
  locale: 'en',
  vendor: {
    id: 'v1', name_en: 'Lumière', name_he: 'לומייר', titleLocale: 'AUTO' as const,
    category: 'PHOTOGRAPHY' as const, city: 'Tel Aviv', priceMin: 8000, priceMax: 18000,
    verified: true, isPremium: false, isPrivate: false, coverUrl: null,
  },
  shortlisted: false,
  onChanged: () => {},
};

describe('VendorCard', () => {
  it('shows the Verified badge for a verified vendor', () => {
    renderCard(base);
    expect(screen.getByText('Verified')).toBeTruthy();
  });
  it('hides the Verified badge for an unverified vendor', () => {
    renderCard({ ...base, vendor: { ...base.vendor, verified: false } });
    expect(screen.queryByText('Verified')).toBeNull();
  });
});
