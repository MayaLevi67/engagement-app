import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';

vi.mock('@/lib/actions/vendors', () => ({
  setQuoteStatus: vi.fn(async () => ({ ok: true })),
  setQuoteAmount: vi.fn(async () => ({ ok: true })),
  setQuoteNotes: vi.fn(async () => ({ ok: true })),
  linkQuoteToTask: vi.fn(async () => ({ ok: true })),
  pushQuoteToBudget: vi.fn(async () => ({ ok: true })),
}));

import { QuotePanel, type SerializedQuote, type QuoteTask } from './quote-panel';

function withIntl(ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      {ui}
    </NextIntlClientProvider>,
  );
}

const quote: SerializedQuote = {
  status: 'QUOTED',
  amount: 5000,
  notes: null,
  taskId: 'task-1',
};

// A "paid" push appends a new TaskPayment on every click (quote-panel.tsx's
// pushQuoteToBudget), so re-offering the button once the linked task already
// has a payment would double-charge paid on re-click (see quote-panel.tsx ~176).
describe('QuotePanel double-charge guard', () => {
  it('hides "Add to budget (paid)" once the linked task already has a payment', () => {
    const tasks: QuoteTask[] = [{ id: 'task-1', title: 'Book venue', hasPayments: true }];
    withIntl(<QuotePanel vendorId="vendor-1" quote={quote} tasks={tasks} onChanged={() => {}} />);

    expect(
      screen.queryByRole('button', { name: en.Vendors.addToBudgetPaid }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(en.Vendors.addToBudgetPaidDone)).toBeInTheDocument();
    // The unaffected planned action stays available either way.
    expect(screen.getByRole('button', { name: en.Vendors.addToBudgetPlanned })).toBeInTheDocument();
  });

  it('shows "Add to budget (paid)" when the linked task has no payments yet', () => {
    const tasks: QuoteTask[] = [{ id: 'task-1', title: 'Book venue', hasPayments: false }];
    withIntl(<QuotePanel vendorId="vendor-1" quote={quote} tasks={tasks} onChanged={() => {}} />);

    expect(screen.getByRole('button', { name: en.Vendors.addToBudgetPaid })).toBeInTheDocument();
    expect(screen.queryByText(en.Vendors.addToBudgetPaidDone)).not.toBeInTheDocument();
  });
});
