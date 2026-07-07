import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';

// `@/lib/i18n/navigation` re-exports next-intl's `createNavigation`, which
// pulls in `next/navigation` at import time; this test env can't resolve that
// bare specifier, so mock the router the same way the sibling
// checklist-templates admin test does.
vi.mock('@/lib/i18n/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock('@/lib/actions/admin-budget', () => ({
  updateBudgetTemplate: vi.fn(async () => ({ ok: true })),
}));

import { BudgetTemplatesAdmin } from './budget-templates-admin';

function renderAdmin(rows: Parameters<typeof BudgetTemplatesAdmin>[0]['rows']) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <BudgetTemplatesAdmin rows={rows} />
    </NextIntlClientProvider>,
  );
}

describe('BudgetTemplatesAdmin', () => {
  it('shows the ok message when active percentages total 100', () => {
    renderAdmin([
      { category: 'VENUE', defaultPercent: 60, active: true, sortOrder: 10 },
      { category: 'CATERING', defaultPercent: 40, active: true, sortOrder: 20 },
    ]);
    expect(screen.getByText(/total 100%/i)).toBeTruthy();
  });

  it('warns when active percentages do not total 100', () => {
    renderAdmin([
      { category: 'VENUE', defaultPercent: 60, active: true, sortOrder: 10 },
      { category: 'CATERING', defaultPercent: 30, active: true, sortOrder: 20 },
    ]);
    expect(screen.getByText(/should be 100/i)).toBeTruthy();
  });
});
