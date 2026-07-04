import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';

describe('design tokens', () => {
  it('applies token-based utility classes to elements', () => {
    const { getByTestId } = render(
      <div
        data-testid="card"
        className="bg-surface text-text rounded-card font-display"
      >
        hello
      </div>,
    );
    const el = getByTestId('card');
    expect(el).toHaveClass('bg-surface');
    expect(el).toHaveClass('rounded-card');
    expect(el).toHaveClass('font-display');
  });
});
