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
  it("does not invert a tiny slice's arc when the fixed inter-slice gap would exceed its span", () => {
    // Venue is ~99.98% of the ring; Cousin's slice spans only ~0.072deg, far
    // less than the 1.2deg gap inset at each end. With a fixed 1.2deg gap the
    // inset start ends up PAST the inset end, so arcPath draws the arc
    // backwards: instead of a near-invisible sliver, its outer-arc endpoints
    // land ~3.4px apart (a visibly wrong, oversized/misplaced sliver). A
    // correctly clamped gap collapses the outer-arc endpoints to the same
    // point (distance ~0), since gap = min(1.2, span / 2) fully consumes the
    // tiny span.
    const tinySlices = [
      { label: 'Venue', value: 50000, token: 'chart-1' },
      { label: 'Cousin', value: 10, token: 'chart-2' },
    ];
    const { container } = render(<Donut slices={tinySlices} sliceTitle={(s, p) => `${s.label}:${Math.round(p * 100)}%`} />);
    const paths = container.querySelectorAll('path');
    expect(paths.length).toBe(2);
    const d = paths[1].getAttribute('d') ?? '';
    // d = "M ox1 oy1 A rOuter rOuter 0 large sweep ox2 oy2 L ix2 iy2 A ..."
    const nums = (d.match(/-?\d+\.?\d*/g) ?? []).map(Number);
    const [ox1, oy1] = [nums[0], nums[1]];
    const [ox2, oy2] = [nums[7], nums[8]];
    const outerArcSpan = Math.hypot(ox2 - ox1, oy2 - oy1);
    expect(outerArcSpan).toBeLessThan(0.1);
  });
});
describe('DonutLegend', () => {
  it('renders a row per slice sorted largest-first with % and amount, text in text tokens', () => {
    render(<DonutLegend slices={slices} formatRow={(p) => `${Math.round(p*100)}%`} formatAmount={(v) => `₪${v}`} />);
    expect(screen.getByText('Venue')).toBeInTheDocument();
    expect(screen.getByText(/₪75000/)).toBeInTheDocument();
  });
});
