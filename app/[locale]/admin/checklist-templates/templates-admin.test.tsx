import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';
import type { SerializedTemplate } from './templates-admin';

const { refresh, createTemplate, updateTemplate, deleteTemplate, setTemplateActive, reorderTemplate } =
  vi.hoisted(() => ({
    refresh: vi.fn(),
    createTemplate: vi.fn(async () => ({ ok: true, id: 'new-id' })),
    updateTemplate: vi.fn(async () => ({ ok: true, id: 'template-1' })),
    deleteTemplate: vi.fn(async () => ({ ok: true, id: 'template-1' })),
    setTemplateActive: vi.fn(async () => ({ ok: true, id: 'template-1' })),
    reorderTemplate: vi.fn(async () => ({ ok: true, id: 'template-1' })),
  }));

vi.mock('@/lib/i18n/navigation', () => ({
  useRouter: () => ({ refresh }),
}));

vi.mock('@/lib/actions/admin-templates', () => ({
  createTemplate,
  updateTemplate,
  deleteTemplate,
  setTemplateActive,
  reorderTemplate,
}));

import { TemplatesAdmin } from './templates-admin';

const templates: SerializedTemplate[] = [
  {
    id: 'template-1',
    title_en: 'Book venue',
    title_he: 'הזמנת אולם',
    titleLocale: 'AUTO',
    category: 'VENUE',
    priority: 'HIGH',
    dueOffsetDays: 300,
    active: true,
    sortOrder: 0,
  },
  {
    id: 'template-2',
    title_en: 'Book photographer',
    title_he: 'הזמנת צלם',
    titleLocale: 'AUTO',
    category: 'PHOTOGRAPHY',
    priority: 'MEDIUM',
    dueOffsetDays: 200,
    active: true,
    sortOrder: 1,
  },
];

function renderAdmin(overrides: Partial<Parameters<typeof TemplatesAdmin>[0]> = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <TemplatesAdmin templates={templates} {...overrides} />
    </NextIntlClientProvider>,
  );
}

describe('TemplatesAdmin', () => {
  beforeEach(() => {
    refresh.mockClear();
    createTemplate.mockClear();
    updateTemplate.mockClear();
    deleteTemplate.mockClear();
    setTemplateActive.mockClear();
    reorderTemplate.mockClear();
  });

  it('renders all templates with their titles, category and priority', () => {
    renderAdmin();

    expect(screen.getByText('Book venue')).toBeInTheDocument();
    expect(screen.getByText('הזמנת אולם')).toBeInTheDocument();
    expect(screen.getByText('Book photographer')).toBeInTheDocument();
    expect(screen.getAllByText(en.TaskCategory.VENUE).length).toBeGreaterThan(0);
    expect(screen.getAllByText(en.TaskPriority.HIGH).length).toBeGreaterThan(0);
  });

  it('calls createTemplate with the entered values when submitting the new-template form', async () => {
    renderAdmin();

    fireEvent.click(screen.getByRole('button', { name: en.AdminTemplates.new }));

    fireEvent.change(screen.getByLabelText(en.AdminTemplates.titleEnLabel), {
      target: { value: 'Book florist' },
    });
    fireEvent.change(screen.getByLabelText(en.AdminTemplates.titleHeLabel), {
      target: { value: 'הזמנת פרחים' },
    });

    fireEvent.click(screen.getByRole('button', { name: en.AdminTemplates.save }));

    await waitFor(() => {
      expect(createTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          title_en: 'Book florist',
          title_he: 'הזמנת פרחים',
          titleLocale: 'AUTO',
          category: 'VENUE',
          priority: 'MEDIUM',
          active: true,
          sortOrder: 0,
        }),
      );
    });
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it('blocks submission and shows an error when the Hebrew title is left empty', async () => {
    renderAdmin();

    fireEvent.click(screen.getByRole('button', { name: en.AdminTemplates.new }));

    fireEvent.change(screen.getByLabelText(en.AdminTemplates.titleEnLabel), {
      target: { value: 'Book florist' },
    });
    // title_he intentionally left blank; templateSchema requires both titles.

    fireEvent.click(screen.getByRole('button', { name: en.AdminTemplates.save }));

    await waitFor(() => {
      expect(screen.getByText(en.AdminTemplates.error)).toBeInTheDocument();
    });
    expect(createTemplate).not.toHaveBeenCalled();
  });

  it('calls setTemplateActive when toggling deactivate', async () => {
    renderAdmin();

    fireEvent.click(screen.getAllByRole('button', { name: en.AdminTemplates.deactivate })[0]);

    await waitFor(() => {
      expect(setTemplateActive).toHaveBeenCalledWith('template-1', false);
    });
  });

  it('swaps sortOrder for both templates when moving one down', async () => {
    renderAdmin();

    fireEvent.click(screen.getAllByRole('button', { name: en.AdminTemplates.moveDown })[0]);

    await waitFor(() => {
      expect(reorderTemplate).toHaveBeenCalledWith('template-1', 1);
      expect(reorderTemplate).toHaveBeenCalledWith('template-2', 0);
    });
  });

  it('requires a confirm click before calling deleteTemplate', async () => {
    renderAdmin();

    const deleteButtons = screen.getAllByRole('button', { name: en.AdminTemplates.delete });
    fireEvent.click(deleteButtons[0]);

    expect(screen.getByText(en.AdminTemplates.confirmDelete)).toBeInTheDocument();
    expect(deleteTemplate).not.toHaveBeenCalled();

    const confirmedDeleteButtons = screen.getAllByRole('button', { name: en.AdminTemplates.delete });
    fireEvent.click(confirmedDeleteButtons[0]);

    await waitFor(() => {
      expect(deleteTemplate).toHaveBeenCalledWith('template-1');
    });
  });
});
