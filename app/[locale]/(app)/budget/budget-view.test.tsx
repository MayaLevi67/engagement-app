import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock('@/lib/i18n/navigation', () => ({
  useRouter: () => ({ refresh }),
}));

vi.mock('@/lib/actions/budget', () => ({
  setBudgetTotal: vi.fn(async () => ({ ok: true })),
  setAvgGiftPerGuest: vi.fn(async () => ({ ok: true })),
  setCategoryAllocation: vi.fn(async () => ({ ok: true })),
  clearCategoryAllocation: vi.fn(async () => ({ ok: true })),
}));

import { BudgetView } from './budget-view';

function renderView(props: Parameters<typeof BudgetView>[0]) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <BudgetView {...props} />
    </NextIntlClientProvider>,
  );
}

const baseProps = {
  locale: 'en',
  budgetTotal: 100000,
  avgGiftPerGuest: 500,
  guestCount: 200,
  categories: [
    { category: 'VENUE' as const, recommended: 50000, committed: 0, open: 50000, ceiling: null, pinned: false },
    { category: 'CATERING' as const, recommended: 50000, committed: 20000, open: 30000, ceiling: null, pinned: false },
  ],
  feedback: { type: 'ok' as const },
  gift: { estimatedGifts: 100000, delta: 0 },
};

describe('BudgetView', () => {
  it('renders category rows with committed amounts', () => {
    renderView(baseProps);
    // "Venue" also appears in the allocation donut's own legend, so scope
    // the query to the category breakdown container (the fallback list)
    // itself. This still tolerates the donut's duplicate text, but fails
    // if the breakdown fallback is ever removed from the page.
    const breakdown = within(screen.getByTestId('category-breakdown'));
    expect(breakdown.getAllByText(/venue/i).length).toBeGreaterThan(0);
    expect(breakdown.getAllByText(/committed/i).length).toBeGreaterThan(0);
  });

  it('shows an over-budget banner', () => {
    renderView({ ...baseProps, feedback: { type: 'over_budget', shortfall: 20000, underfunded: ['VENUE'] } });
    expect(screen.getByText(/over budget/i)).toBeTruthy();
  });

  it('labels a shortfall when gifts are below budget', () => {
    renderView({ ...baseProps, gift: { estimatedGifts: 80000, delta: -20000 } });
    expect(screen.getByText(/shortfall/i)).toBeTruthy();
  });
});
