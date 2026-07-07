import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';

vi.mock('@/lib/i18n/navigation', () => ({
  Link: (p: { href: string; children?: React.ReactNode }) => <a href={p.href}>{p.children}</a>,
}));

import { CountdownHero } from './countdown-hero';
import { OverviewCards } from './overview-cards';

function wrap(ui: React.ReactNode) {
  return render(<NextIntlClientProvider locale="en" messages={en}>{ui}</NextIntlClientProvider>);
}

describe('CountdownHero', () => {
  it('shows days to go for a future date', () => {
    wrap(<CountdownHero locale="en" partner1Name="Maya" partner2Name="Alex" countdownDays={10} dateIsApproximate={false} weddingDate="2026-07-17T00:00:00.000Z" />);
    expect(screen.getByText(/10 days to go/i)).toBeTruthy();
    expect(screen.getByText(/Maya & Alex/i)).toBeTruthy();
  });
  it('shows the set-date state when there is no date', () => {
    wrap(<CountdownHero locale="en" partner1Name="Maya" partner2Name={null} countdownDays={null} dateIsApproximate={false} weddingDate={null} />);
    expect(screen.getByText(/set your wedding date/i)).toBeTruthy();
  });
});

describe('OverviewCards (dual-mode)', () => {
  const base = {
    locale: 'en',
    checklist: { done: 2, total: 5, pct: 40, overdue: 1 },
    vendors: { shortlisted: 3, booked: 1 },
  };
  it('shows the budget summary when a budget exists', () => {
    wrap(<OverviewCards {...base} budget={{ total: 100000, committed: 20000, remaining: 80000, pct: 20 }} concept={null} />);
    expect(screen.getByText(/committed of/i)).toBeTruthy();
  });
  it('shows the budget nudge when no budget is set', () => {
    wrap(<OverviewCards {...base} budget={null} concept={null} />);
    expect(screen.getByText(/plan your budget/i)).toBeTruthy();
  });
});
