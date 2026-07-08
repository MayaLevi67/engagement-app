import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';
import type { SerializedTask } from './checklist-view';

const { refresh, setTaskStatus, addCustomTask } = vi.hoisted(() => ({
  refresh: vi.fn(),
  setTaskStatus: vi.fn(async () => ({ ok: true })),
  addCustomTask: vi.fn(async () => ({ ok: true })),
}));

vi.mock('@/lib/i18n/navigation', () => ({
  useRouter: () => ({ refresh }),
}));

vi.mock('@/lib/actions/checklist', () => ({
  setTaskStatus,
  editTask: vi.fn(async () => ({ ok: true })),
  softDeleteTask: vi.fn(async () => ({ ok: true })),
  restoreTask: vi.fn(async () => ({ ok: true })),
  permanentlyDeleteTask: vi.fn(async () => ({ ok: true })),
  addCustomTask,
  setTaskReminder: vi.fn(async () => ({ ok: true })),
}));

vi.mock('@/lib/actions/premium', () => ({
  startCheckout: vi.fn(async () => ({ ok: true, url: 'https://checkout.stripe.com/session' })),
}));

import { ChecklistView } from './checklist-view';

const tasks: SerializedTask[] = [
  {
    id: 'task-1',
    title_en: 'Book venue',
    title_he: '',
    titleLocale: 'AUTO',
    category: 'VENUE',
    priority: 'HIGH',
    dueDate: null,
    status: 'OPEN',
    completedAt: null,
    isCustom: false,
    reminderEnabled: false,
    remindAt: null,
    notes: null,
    estimatedCost: null,
    amountPaid: null,
    deletedAt: null,
  },
  {
    id: 'task-2',
    title_en: 'Book photographer',
    title_he: '',
    titleLocale: 'AUTO',
    category: 'PHOTOGRAPHY',
    priority: 'MEDIUM',
    dueDate: null,
    status: 'DONE',
    completedAt: '2026-01-01T00:00:00.000Z',
    isCustom: false,
    reminderEnabled: false,
    remindAt: null,
    notes: null,
    estimatedCost: null,
    amountPaid: null,
    deletedAt: null,
  },
];

function renderView(overrides: Partial<Parameters<typeof ChecklistView>[0]> = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <ChecklistView
        locale="en"
        tasks={tasks}
        trashedTasks={[]}
        counts={{ done: 1, total: 2 }}
        {...overrides}
      />
    </NextIntlClientProvider>,
  );
}

describe('ChecklistView', () => {
  beforeEach(() => {
    refresh.mockClear();
    setTaskStatus.mockClear();
    addCustomTask.mockClear();
  });

  it('renders both tasks with the correct progress', () => {
    renderView();

    expect(screen.getByText('Book venue')).toBeInTheDocument();
    expect(screen.getByText('Book photographer')).toBeInTheDocument();
    expect(
      screen.getByText(en.Checklist.progress.replace('{done}', '1').replace('{total}', '2')),
    ).toBeInTheDocument();
  });

  it('opens the paid-amount prompt and calls setTaskStatus when skipped', async () => {
    renderView();

    const checkbox = screen.getByRole('checkbox', { name: 'Book venue' });
    fireEvent.click(checkbox);

    const skipButton = screen.getByRole('button', { name: en.Checklist.paidSkip });
    fireEvent.click(skipButton);

    await waitFor(() => {
      expect(setTaskStatus).toHaveBeenCalledWith('task-1', true, null);
    });
  });

  it('re-opening a done task toggles directly without the prompt', async () => {
    renderView();

    const checkbox = screen.getByRole('checkbox', { name: 'Book photographer' });
    fireEvent.click(checkbox);

    await waitFor(() => {
      expect(setTaskStatus).toHaveBeenCalledWith('task-2', false);
    });
  });

  it('calls addCustomTask when adding a custom task', async () => {
    renderView();

    fireEvent.click(screen.getByRole('button', { name: en.Checklist.addCustom }));

    const titleInput = screen.getByLabelText(en.Checklist.titleLabel);
    fireEvent.change(titleInput, { target: { value: 'Order the cake' } });

    fireEvent.click(screen.getByRole('button', { name: en.Checklist.save }));

    await waitFor(() => {
      expect(addCustomTask).toHaveBeenCalledWith(
        expect.objectContaining({ title_en: 'Order the cake', title_he: '' }),
      );
    });
  });
});
