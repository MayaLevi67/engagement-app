import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Hero } from './hero';
describe('Hero', () => {
  it('renders monogram, couple name, and children (countdown slot)', () => {
    render(<Hero coupleName="Maya & Asaf" partner1Name="Maya" partner2Name="Asaf"><span>40 days</span></Hero>);
    expect(screen.getByText('M & A')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Maya & Asaf' })).toBeInTheDocument();
    expect(screen.getByText('40 days')).toBeInTheDocument();
  });
  it('omits the heading when no couple name', () => {
    render(<Hero coupleName={null} partner1Name={null} partner2Name={null} />);
    expect(screen.queryByRole('heading')).toBeNull();
  });
});
