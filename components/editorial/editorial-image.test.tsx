import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ImageBlock } from './image-block';
import { ImageRail } from './image-rail';

describe('editorial image kit', () => {
  it('ImageBlock renders an img when src is given', () => {
    render(<ImageBlock src="/x.jpg" alt="Wedding photo" />);
    const img = screen.getByRole('img', { name: 'Wedding photo' });
    expect(img).toHaveAttribute('loading', 'lazy');
  });
  it('ImageBlock renders a labeled placeholder (no img) when src is empty', () => {
    render(<ImageBlock src={null} alt="Wedding photo" placeholderLabel="Photo" />);
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('Photo')).toBeInTheDocument();
  });
  it('ImageRail renders content and an image column', () => {
    render(<ImageRail src="/x.jpg" alt="Wedding photo"><span>content</span></ImageRail>);
    expect(screen.getByText('content')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Wedding photo' })).toBeInTheDocument();
  });
});
