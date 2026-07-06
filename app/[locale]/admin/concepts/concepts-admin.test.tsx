import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('next-intl', () => ({ useTranslations: () => (k: string) => k }));

const refreshMock = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: refreshMock }) }));

const addImageMock = vi.fn().mockResolvedValue({ ok: true });
vi.mock('@/lib/actions/admin-concepts', () => ({
  createConcept: vi.fn(),
  updateConcept: vi.fn(),
  deleteConcept: vi.fn(),
  createElement: vi.fn(),
  deleteElement: vi.fn(),
  addImage: (...args: unknown[]) => addImageMock(...args),
  deleteImage: vi.fn(),
}));

import { ConceptsAdmin } from './concepts-admin';

const baseConcept = {
  id: 'c1',
  title_en: 'Old Money',
  title_he: 'אלגנטיות',
  titleLocale: 'AUTO' as const,
  tagline_en: null,
  tagline_he: null,
  description_en: null,
  description_he: null,
  palette: [],
  isPremium: true,
  active: true,
  sortOrder: 0,
  images: [],
  elements: [],
};

describe('ConceptsAdmin', () => {
  it('lists concepts and opens the create form', () => {
    render(<ConceptsAdmin concepts={[baseConcept]} />);
    expect(screen.getByText(/Old Money/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('new'));
    expect(screen.getByText('save')).toBeInTheDocument();
  });

  it('keeps the edit form open after a nested image add', async () => {
    render(<ConceptsAdmin concepts={[baseConcept]} />);

    fireEvent.click(screen.getByText('edit'));
    expect(screen.getByText('save')).toBeInTheDocument();

    const urlInput = screen.getByPlaceholderText('imageUrl');
    fireEvent.change(urlInput, { target: { value: 'https://example.com/pic.jpg' } });
    fireEvent.click(screen.getByText('addImage'));

    await vi.waitFor(() => {
      expect(addImageMock).toHaveBeenCalled();
    });

    // The form-only Save button must still be present: adding a nested row
    // must not collapse the editor back to the list view.
    expect(screen.getByText('save')).toBeInTheDocument();
  });
});
