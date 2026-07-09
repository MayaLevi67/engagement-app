'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { PayerRole } from '@prisma/client';
import { useRouter } from '@/lib/i18n/navigation';
import { recordTaskPayment, editTaskPayment } from '@/lib/actions/payments';
import { payerOptions, type PayerLabels } from '@/lib/payments/payer';

export interface EditingPayment {
  paymentId: string;
  amount: number;
  payer: PayerRole;
  payerLabel: string | null;
  paidOn: string | null; // ISO date, or null
  note: string | null;
}

interface PaymentFormProps {
  taskId: string;
  partner1Name: string | null;
  partner2Name: string | null;
  initialCost: number | null;
  editing?: EditingPayment;
  onCancel: () => void;
  onSaved?: () => void;
}

function toDateInputValue(iso: string | null): string {
  return iso ? iso.slice(0, 10) : '';
}

export function PaymentForm({
  taskId,
  partner1Name,
  partner2Name,
  initialCost,
  editing,
  onCancel,
  onSaved,
}: PaymentFormProps) {
  const t = useTranslations('Payments');
  const tPayer = useTranslations('Payer');
  const router = useRouter();

  const labels: PayerLabels = {
    partner1: tPayer('partner1'),
    partner2: tPayer('partner2'),
    both: tPayer('both'),
    partner1Family: tPayer('partner1Family'),
    partner2Family: tPayer('partner2Family'),
    family: (name: string) => tPayer('family', { name }),
    other: tPayer('other'),
  };
  const options = payerOptions({ partner1Name, partner2Name }, labels);

  const [cost, setCost] = useState(initialCost != null ? String(initialCost) : '');
  const [amount, setAmount] = useState(editing ? String(editing.amount) : '');
  const [payer, setPayer] = useState<PayerRole>(editing?.payer ?? 'BOTH');
  const [payerLabel, setPayerLabel] = useState(editing?.payerLabel ?? '');
  const [date, setDate] = useState(toDateInputValue(editing?.paidOn ?? null));
  const [note, setNote] = useState(editing?.note ?? '');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsedAmount = amount.trim() === '' ? NaN : Math.trunc(Number(amount));
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError(true);
      return;
    }

    setError(false);
    setPending(true);

    const basePayload = {
      amount: parsedAmount,
      payer,
      payerLabel: payer === 'OTHER' ? payerLabel.trim() || null : null,
      paidOn: date ? new Date(date) : null,
      note: note.trim() || null,
    };

    const result = editing
      ? await editTaskPayment(editing.paymentId, basePayload)
      : await recordTaskPayment(taskId, {
          ...basePayload,
          cost: cost.trim() === '' ? null : Math.trunc(Number(cost)),
        });

    setPending(false);
    if (!result.ok) {
      setError(true);
      return;
    }
    router.refresh();
    onSaved?.();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-card bg-background p-4"
    >
      {editing ? null : (
        <label className="flex flex-col gap-1 text-xs text-muted" htmlFor={`payment-cost-${taskId}`}>
          {t('cost')}
          <input
            id={`payment-cost-${taskId}`}
            type="number"
            min="0"
            dir="ltr"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            className="rounded-card border border-muted/30 bg-surface px-3 py-2 text-sm text-text"
          />
        </label>
      )}

      <label className="flex flex-col gap-1 text-xs text-muted" htmlFor={`payment-amount-${taskId}`}>
        {t('amount')}
        <input
          id={`payment-amount-${taskId}`}
          type="number"
          min="0"
          required
          dir="ltr"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="rounded-card border border-muted/30 bg-surface px-3 py-2 text-sm text-text"
        />
      </label>

      <label className="flex flex-col gap-1 text-xs text-muted" htmlFor={`payment-payer-${taskId}`}>
        {t('payer')}
        <select
          id={`payment-payer-${taskId}`}
          value={payer}
          onChange={(e) => setPayer(e.target.value as PayerRole)}
          className="rounded-card border border-muted/30 bg-surface px-2 py-1.5 text-sm text-text"
        >
          {options.map((option) => (
            <option key={option.role} value={option.role}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      {payer === 'OTHER' ? (
        <label className="flex flex-col gap-1 text-xs text-muted" htmlFor={`payment-payer-label-${taskId}`}>
          {t('payerLabelOther')}
          <input
            id={`payment-payer-label-${taskId}`}
            type="text"
            value={payerLabel}
            onChange={(e) => setPayerLabel(e.target.value)}
            className="rounded-card border border-muted/30 bg-surface px-3 py-2 text-sm text-text"
          />
        </label>
      ) : null}

      <label className="flex flex-col gap-1 text-xs text-muted" htmlFor={`payment-date-${taskId}`}>
        {t('date')}
        <input
          id={`payment-date-${taskId}`}
          type="date"
          dir="ltr"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-card border border-muted/30 bg-surface px-2 py-1.5 text-sm text-text"
        />
      </label>

      <label className="flex flex-col gap-1 text-xs text-muted" htmlFor={`payment-note-${taskId}`}>
        {t('note')}
        <textarea
          id={`payment-note-${taskId}`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          className="rounded-card border border-muted/30 bg-surface px-3 py-2 text-sm text-text"
        />
      </label>

      {error ? <p className="text-sm text-red-600">{t('error')}</p> : null}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-card bg-primary px-3 py-1.5 text-sm font-medium text-background disabled:opacity-60"
        >
          {t('save')}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onCancel}
          className="rounded-card border border-muted/30 px-3 py-1.5 text-sm text-text"
        >
          {t('cancel')}
        </button>
      </div>
    </form>
  );
}
