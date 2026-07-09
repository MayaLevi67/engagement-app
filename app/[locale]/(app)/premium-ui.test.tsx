import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';
import type { SerializedTask } from './checklist/checklist-view';

const { startCheckout } = vi.hoisted(() => ({
  startCheckout: vi.fn(async () => ({ ok: true as const, url: 'https://checkout.stripe.com/session' })),
}));

vi.mock('@/lib/actions/premium', () => ({ startCheckout }));

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock('@/lib/i18n/navigation', () => ({
  useRouter: () => ({ refresh }),
}));

vi.mock('@/lib/actions/checklist', () => ({
  setTaskStatus: vi.fn(async () => ({ ok: true })),
  editTask: vi.fn(async () => ({ ok: true })),
  softDeleteTask: vi.fn(async () => ({ ok: true })),
  restoreTask: vi.fn(async () => ({ ok: true })),
  permanentlyDeleteTask: vi.fn(async () => ({ ok: true })),
  addCustomTask: vi.fn(async () => ({ ok: true })),
  setTaskReminder: vi.fn(async () => ({ ok: true })),
}));

vi.mock('@/lib/actions/payments', () => ({
  recordTaskPayment: vi.fn(async () => ({ ok: true })),
  editTaskPayment: vi.fn(async () => ({ ok: true })),
  deleteTaskPayment: vi.fn(async () => ({ ok: true })),
}));

import { UpgradeButton } from './upgrade-button';
import { Paywall } from './budget/paywall';
import { ChecklistView } from './checklist/checklist-view';

function withIntl(ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      {ui}
    </NextIntlClientProvider>,
  );
}

const task: SerializedTask = {
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
  payments: [],
};

describe('UpgradeButton', () => {
  beforeEach(() => {
    startCheckout.mockClear();
  });

  it('calls startCheckout on click', async () => {
    withIntl(<UpgradeButton />);
    fireEvent.click(screen.getByRole('button', { name: en.Premium.unlockCta }));
    await waitFor(() => {
      expect(startCheckout).toHaveBeenCalledTimes(1);
    });
  });
});

describe('Budget Paywall', () => {
  it('renders the paywall title and an Unlock button', () => {
    withIntl(<Paywall />);
    expect(screen.getByText(en.Premium.budgetPaywallTitle)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: en.Premium.unlockCta })).toBeInTheDocument();
  });
});

describe('Checklist teaser', () => {
  it('shows a "+N more" teaser and an UpgradeButton when hiddenCount > 0', () => {
    withIntl(
      <ChecklistView
        locale="en"
        tasks={[task]}
        trashedTasks={[]}
        counts={{ done: 0, total: 11 }}
        hiddenCount={5}
      />,
    );
    expect(
      screen.getByText(en.Premium.checklistMore.replace('{count}', '5')),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: en.Premium.unlockCta })).toBeInTheDocument();
  });

  it('does not show a teaser when hiddenCount is 0', () => {
    withIntl(
      <ChecklistView locale="en" tasks={[task]} trashedTasks={[]} counts={{ done: 0, total: 1 }} />,
    );
    expect(screen.queryByRole('button', { name: en.Premium.unlockCta })).not.toBeInTheDocument();
  });
});
