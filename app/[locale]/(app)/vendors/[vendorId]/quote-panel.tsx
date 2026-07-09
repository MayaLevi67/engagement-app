'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { VendorQuoteStatus } from '@prisma/client';
import { VENDOR_STATUS_OPTIONS } from '@/lib/vendors/schema';
import { setQuoteStatus, setQuoteAmount, setQuoteNotes, linkQuoteToTask, pushQuoteToBudget } from '@/lib/actions/vendors';

export interface SerializedQuote {
  status: VendorQuoteStatus;
  amount: number | null;
  notes: string | null;
  taskId: string | null;
}

export interface QuoteTask {
  id: string;
  title: string;
  hasPayments: boolean;
}

interface QuotePanelProps {
  vendorId: string;
  quote: SerializedQuote | null;
  tasks: QuoteTask[];
  onChanged: () => void;
}

export function QuotePanel({ vendorId, quote, tasks, onChanged }: QuotePanelProps) {
  const t = useTranslations('Vendors');

  const [status, setStatus] = useState<VendorQuoteStatus>(quote?.status ?? 'CONSIDERING');
  const [amount, setAmount] = useState(quote?.amount != null ? String(quote.amount) : '');
  const [notes, setNotes] = useState(quote?.notes ?? '');
  const [taskId, setTaskId] = useState(quote?.taskId ?? '');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const [budgetMessage, setBudgetMessage] = useState(false);

  async function handleStatusChange(next: VendorQuoteStatus) {
    setStatus(next);
    setError(false);
    setBudgetMessage(false);
    setPending(true);
    const r = await setQuoteStatus(vendorId, next);
    setPending(false);
    if (!r.ok) { setError(true); return; }
    onChanged();
  }

  async function handleAmountBlur() {
    setError(false);
    setBudgetMessage(false);
    setPending(true);
    const value = amount.trim() === '' ? null : Math.trunc(Number(amount));
    const r = await setQuoteAmount(vendorId, value);
    setPending(false);
    if (!r.ok) { setError(true); return; }
    onChanged();
  }

  async function handleNotesBlur() {
    setError(false);
    setBudgetMessage(false);
    setPending(true);
    const r = await setQuoteNotes(vendorId, notes.trim() || null);
    setPending(false);
    if (!r.ok) { setError(true); return; }
    onChanged();
  }

  async function handleTaskChange(next: string) {
    setTaskId(next);
    setError(false);
    setBudgetMessage(false);
    setPending(true);
    const r = await linkQuoteToTask(vendorId, next || null);
    setPending(false);
    if (!r.ok) { setError(true); return; }
    onChanged();
  }

  async function handlePushToBudget(paid: boolean) {
    setError(false);
    setBudgetMessage(false);
    setPending(true);
    const r = await pushQuoteToBudget(vendorId, { paid });
    setPending(false);
    if (!r.ok) { setError(true); return; }
    setBudgetMessage(true);
    onChanged();
  }

  const canPushToBudget = amount.trim() !== '' && taskId !== '';
  // A "paid" push records a new TaskPayment every click — once the linked task
  // already has a payment on its ledger, re-offering this button would double-charge
  // paid on re-click, so it becomes a one-time action (edit/delete on the ledger after).
  const linkedTaskHasPayments = tasks.find((task) => task.id === taskId)?.hasPayments ?? false;

  return (
    <section className="flex flex-col gap-3 rounded-card bg-surface p-4 shadow-sm">
      <h2 className="font-display text-lg text-text">{t('quoteTitle')}</h2>

      <label className="flex flex-col gap-1 text-xs text-muted" htmlFor="quote-status">
        {t('statusLabel')}
        <select
          id="quote-status"
          value={status}
          disabled={pending}
          onChange={(e) => handleStatusChange(e.target.value as VendorQuoteStatus)}
          className="rounded-card border border-muted/30 bg-background px-2 py-1.5 text-sm text-text"
        >
          {VENDOR_STATUS_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {t(`status${option}`)}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-xs text-muted" htmlFor="quote-amount">
        {t('amountLabel')}
        <input
          id="quote-amount"
          type="number"
          min="0"
          dir="ltr"
          value={amount}
          disabled={pending}
          onChange={(e) => setAmount(e.target.value)}
          onBlur={handleAmountBlur}
          className="rounded-card border border-muted/30 bg-background px-2 py-1.5 text-sm text-text"
        />
      </label>

      <label className="flex flex-col gap-1 text-xs text-muted" htmlFor="quote-notes">
        {t('notesLabel')}
        <textarea
          id="quote-notes"
          value={notes}
          disabled={pending}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={handleNotesBlur}
          rows={3}
          className="rounded-card border border-muted/30 bg-background px-3 py-2 text-sm text-text"
        />
      </label>

      <label className="flex flex-col gap-1 text-xs text-muted" htmlFor="quote-task">
        {t('linkTask')}
        <select
          id="quote-task"
          value={taskId}
          disabled={pending}
          onChange={(e) => handleTaskChange(e.target.value)}
          className="rounded-card border border-muted/30 bg-background px-2 py-1.5 text-sm text-text"
        >
          <option value="">{t('noTask')}</option>
          {tasks.map((task) => (
            <option key={task.id} value={task.id}>
              {task.title}
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending || !canPushToBudget}
          onClick={() => handlePushToBudget(false)}
          className="rounded-card border border-muted/30 px-3 py-1.5 text-sm text-text disabled:opacity-60"
        >
          {t('addToBudgetPlanned')}
        </button>
        {linkedTaskHasPayments ? null : (
          <button
            type="button"
            disabled={pending || !canPushToBudget}
            onClick={() => handlePushToBudget(true)}
            className="rounded-card bg-primary px-3 py-1.5 text-sm font-medium text-background disabled:opacity-60"
          >
            {t('addToBudgetPaid')}
          </button>
        )}
      </div>

      {linkedTaskHasPayments ? <p className="text-xs text-muted">{t('addToBudgetPaidDone')}</p> : null}
      {budgetMessage ? <p className="text-xs text-primary">{t('addedToBudget')}</p> : null}
      {error ? <p className="text-sm text-red-600">{t('error')}</p> : null}
    </section>
  );
}
