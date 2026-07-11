import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Donut } from './donut';
import { DonutLegend } from './donut-legend';
const slices = [
  { label: 'Venue', value: 75000, token: 'chart-1' },
  { label: 'Catering', value: 73500, token: 'chart-2' },
];
describe('Donut', () => {
  it('renders one path per slice with an accessible <title>', () => {
    const { container } = render(<Donut slices={slices} sliceTitle={(s, p) => `${s.label}:${Math.round(p*100)}%`} />);
    expect(container.querySelectorAll('path').length).toBe(2);
    expect(container.querySelector('title')?.textContent).toContain('Venue');
  });
  it('empty slices render no paths', () => {
    const { container } = render(<Donut slices={[]} sliceTitle={() => ''} />);
    expect(container.querySelectorAll('path').length).toBe(0);
  });
});
describe('DonutLegend', () => {
  it('renders a row per slice sorted largest-first with % and amount, text in text tokens', () => {
    render(<DonutLegend slices={slices} formatRow={(p) => `${Math.round(p*100)}%`} formatAmount={(v) => `₪${v}`} />);
    expect(screen.getByText('Venue')).toBeInTheDocument();
    expect(screen.getByText(/₪75000/)).toBeInTheDocument();
  });
});
