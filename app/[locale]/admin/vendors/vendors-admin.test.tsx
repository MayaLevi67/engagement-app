import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';
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
