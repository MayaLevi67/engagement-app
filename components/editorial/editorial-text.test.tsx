import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SectionHeader } from './section-header';
import { Card } from './card';
import { FeatureCard } from './feature-card';
import { Pill } from './pill';

describe('editorial text kit', () => {
  it('SectionHeader renders title, optional numeral + kicker', () => {
    render(<SectionHeader title="אולם" numeral="01" kicker="הבא בתור" />);
    expect(screen.getByRole('heading', { name: 'אולם' })).toBeInTheDocument();
    expect(screen.getByText('01')).toBeInTheDocument();
    expect(screen.getByText('הבא בתור')).toBeInTheDocument();
  });
  it('Card wine accent uses the logical inline-start border', () => {
    const { container } = render(<Card accent="wine">x</Card>);
    expect(container.firstChild).toHaveClass('border-wine');
    expect(container.firstChild).toHaveClass('border-s-[3px]');
  });
  it('Pill emphasis tone uses wine', () => {
    const { container } = render(<Pill tone="emphasis">₪7,000</Pill>);
    expect(container.firstChild).toHaveClass('bg-wine');
  });
  it('FeatureCard shows kicker + title', () => {
    render(<FeatureCard kicker="הבא בתור" title="סגירת אולם" meta={<span>נותרו ₪7,000</span>} />);
    expect(screen.getByText('סגירת אולם')).toBeInTheDocument();
    expect(screen.getByText('נותרו ₪7,000')).toBeInTheDocument();
  });
});
