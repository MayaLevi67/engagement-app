import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';
import type { SerializedTask } from './checklist/checklist-view';

const { recordTaskPayment, editTaskPayment, deleteTaskPayment } = vi.hoisted(() => ({
  recordTaskPayment: vi.fn(async () => ({ ok: true as const })),
  editTaskPayment: vi.fn(async () => ({ ok: true as const })),
  deleteTaskPayment: vi.fn(async () => ({ ok: true as const })),
}));

vi.mock('@/lib/actions/payments', () => ({ recordTaskPayment, editTaskPayment, deleteTaskPayment }));

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

import { PaymentForm } from './payment-form';
import { TaskRow } from './checklist/task-row';

function withIntl(ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      {ui}
    </NextIntlClientProvider>,
  );
}

const baseTask: SerializedTask = {
  id: 'task-1',
  title_en: 'Book DJ',
  title_he: '',
  titleLocale: 'AUTO',
  category: 'MUSIC',
  priority: 'MEDIUM',
  dueDate: null,
  status: 'OPEN',
  completedAt: null,
  isCustom: false,
  reminderEnabled: false,
  remindAt: null,
  notes: null,
  estimatedCost: 10000,
  amountPaid: 3000,
  deletedAt: null,
  payments: [
    {
      id: 'payment-1',
      amount: 3000,
      payer: 'BOTH',
      payerLabel: null,
      paidOn: null,
      note: null,
    },
  ],
};

describe('PaymentForm', () => {
  beforeEach(() => {
    recordTaskPayment.mockClear();
    editTaskPayment.mockClear();
  });

  it('renders payer options built from the couple\'s names', () => {
    withIntl(
      <PaymentForm
        taskId="task-1"
        partner1Name="Maya"
        partner2Name="Asaf"
        initialCost={10000}
        onCancel={() => {}}
      />,
    );

    const select = screen.getByLabelText(en.Payments.payer) as HTMLSelectElement;
    const optionLabels = Array.from(select.options).map((o) => o.textContent);
    expect(optionLabels).toEqual(
      expect.arrayContaining(['Maya', 'Asaf', en.Payer.both, en.Payer.other]),
    );
  });

  it('submits recordTaskPayment with the entered amount and payer', async () => {
    withIntl(
      <PaymentForm
        taskId="task-1"
        partner1Name="Maya"
        partner2Name="Asaf"
        initialCost={10000}
        onCancel={() => {}}
      />,
    );

    fireEvent.change(screen.getByLabelText(en.Payments.amount), { target: { value: '3000' } });
    fireEvent.change(screen.getByLabelText(en.Payments.payer), { target: { value: 'PARTNER_2' } });
    fireEvent.click(screen.getByRole('button', { name: en.Payments.save }));

    await waitFor(() => {
      expect(recordTaskPayment).toHaveBeenCalledWith(
        'task-1',
        expect.objectContaining({ amount: 3000, payer: 'PARTNER_2', cost: 10000 }),
      );
    });
  });

  it('shows the free-text label input only when payer is Other, and sends it', async () => {
    withIntl(
      <PaymentForm
        taskId="task-1"
        partner1Name={null}
        partner2Name={null}
        initialCost={null}
        onCancel={() => {}}
      />,
    );

    expect(screen.queryByLabelText(en.Payments.payerLabelOther)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(en.Payments.payer), { target: { value: 'OTHER' } });
    fireEvent.change(screen.getByLabelText(en.Payments.payerLabelOther), {
      target: { value: 'Grandma' },
    });
    fireEvent.change(screen.getByLabelText(en.Payments.amount), { target: { value: '500' } });
    fireEvent.click(screen.getByRole('button', { name: en.Payments.save }));

    await waitFor(() => {
      expect(recordTaskPayment).toHaveBeenCalledWith(
        'task-1',
        expect.objectContaining({ amount: 500, payer: 'OTHER', payerLabel: 'Grandma' }),
      );
    });
  });
});

describe('TaskRow payment summary', () => {
  it('shows paid / remaining for a premium couple', () => {
    withIntl(
      <TaskRow
        task={baseTask}
        locale="en"
        onChanged={() => {}}
        premium
        partner1Name="Maya"
        partner2Name="Asaf"
      />,
    );

    expect(
      screen.getByText(
        en.Payments.paidOfCost.replace('{paid}', '₪3,000').replace('{cost}', '₪10,000'),
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(en.Payments.remaining.replace('{amount}', '₪7,000')),
    ).toBeInTheDocument();
  });

  it('does not show a payment affordance for a free couple', () => {
    withIntl(<TaskRow task={baseTask} locale="en" onChanged={() => {}} />);

    expect(screen.queryByText(en.Payments.recordCta)).not.toBeInTheDocument();
  });
});
