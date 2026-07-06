import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('next-intl', () => ({ useTranslations: () => (k: string) => k }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@/lib/actions/admin-concepts', () => ({
  createConcept: vi.fn(),
  updateConcept: vi.fn(),
  deleteConcept: vi.fn(),
  createElement: vi.fn(),
  deleteElement: vi.fn(),
  addImage: vi.fn(),
  deleteImage: vi.fn(),
}));

import { ConceptsAdmin } from './concepts-admin';

describe('ConceptsAdmin', () => {
  it('lists concepts and opens the create form', () => {
    render(
      <ConceptsAdmin
        concepts={[
          {
            id: 'c1',
            title_en: 'Old Money',
            title_he: 'אלגנטיות',
            titleLocale: 'AUTO',
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
          },
        ]}
      />,
    );
    expect(screen.getByText(/Old Money/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('new'));
    expect(screen.getByText('save')).toBeInTheDocument();
  });
});
