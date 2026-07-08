import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next-intl', () => ({ useTranslations: () => (k: string) => k }));
vi.mock('@/lib/i18n/navigation', () => ({
  Link: (p: { href: string; children?: React.ReactNode }) => <a href={p.href}>{p.children}</a>,
}));
vi.mock('@/lib/actions/concepts', () => ({
  toggleFavorite: vi.fn(), chooseConcept: vi.fn(), clearSelectedConcept: vi.fn(), addElementToChecklist: vi.fn(),
}));
vi.mock('@/lib/actions/premium', () => ({
  startCheckout: vi.fn(async () => ({ ok: true, url: 'https://checkout.stripe.com/session' })),
}));

import { ConceptCard } from './concept-card';
import { ConceptDetail } from './[conceptId]/concept-detail';

describe('ConceptCard', () => {
  it('shows the title and premium badge', () => {
    render(<ConceptCard concept={{
      id: 'c1', title: 'Old Money', tagline: 'Timeless', palette: ['#C9A227'],
      isPremium: true, coverUrl: null, coverAlt: '', isFavorite: false, isSelected: false,
    }} />);
    expect(screen.getByText('Old Money')).toBeInTheDocument();
    expect(screen.getByText('premium')).toBeInTheDocument();
  });
});

describe('ConceptDetail', () => {
  it('renders ideas and reflects an already-added idea', () => {
    render(<ConceptDetail concept={{
      id: 'c1', title: 'Party Time', tagline: '', description: 'Desc', palette: [], isPremium: false, isSelected: false,
      images: [], elements: [
        { id: 'el1', title: 'Two DJs', description: '', category: 'MUSIC', estCostMin: 6000, estCostMax: 14000, isAdded: true },
      ],
    }} />);
    expect(screen.getByText('Two DJs')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /added/i })).toBeDisabled();
  });

  it('locks a premium concept for a free wedding and shows Unlock instead of Select/Add', () => {
    render(<ConceptDetail
      premium={false}
      concept={{
        id: 'c1', title: 'Old Money', tagline: '', description: 'Desc', palette: [], isPremium: true, isSelected: false,
        images: [], elements: [
          { id: 'el1', title: 'Two DJs', description: '', category: 'MUSIC', estCostMin: 6000, estCostMax: 14000, isAdded: false },
        ],
      }}
    />);
    expect(screen.getByText('lockedConcept')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'select' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'addToChecklist' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'unlockCta' }).length).toBeGreaterThan(0);
  });
});
