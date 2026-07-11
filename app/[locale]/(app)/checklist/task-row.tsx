'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { TaskCategory, TaskPriority } from '@prisma/client';
import { setTaskStatus, editTask, softDeleteTask, setTaskReminder } from '@/lib/actions/checklist';
import { deleteTaskPayment } from '@/lib/actions/payments';
import { resolveTaskTitle } from '@/lib/checklist/title';
import { CATEGORY_OPTIONS, PRIORITY_OPTIONS } from '@/lib/checklist/schema';
import { taskMoney } from '@/lib/payments/rollup';
import { payerDisplayName, type PayerLabels } from '@/lib/payments/payer';
import { PaymentForm } from '../payment-form';
import type { SerializedTask } from './checklist-view';

interface TaskRowProps {
  task: SerializedTask;
  locale: string;
  onChanged: () => void;
  premium?: boolean;
  partner1Name?: string | null;
  partner2Name?: string | null;
}

function toDateInputValue(iso: string | null): string {
  return iso ? iso.slice(0, 10) : '';
}

export function TaskRow({
  task,
  locale,
  onChanged,
  premium = false,
  partner1Name = null,
  partner2Name = null,
}: TaskRowProps) {
  const t = useTranslations('Checklist');
  const tCategory = useTranslations('TaskCategory');
  const tPriority = useTranslations('TaskPriority');
  const tPayments = useTranslations('Payments');
  const tPayer = useTranslations('Payer');

  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState<TaskCategory>(task.category);
  const [editPriority, setEditPriority] = useState<TaskPriority>(task.priority);
  const [editDueDate, setEditDueDate] = useState('');
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);

  const title = resolveTaskTitle(task, locale);
  const done = task.status === 'DONE';
  const fmt = (n: number) => `₪${n.toLocaleString(locale)}`;

  const payerLabels: PayerLabels = {
    partner1: tPayer('partner1'),
    partner2: tPayer('partner2'),
    both: tPayer('both'),
    partner1Family: tPayer('partner1Family'),
    partner2Family: tPayer('partner2Family'),
    family: (name: string) => tPayer('family', { name }),
    other: tPayer('other'),
  };
  const money = taskMoney(task.estimatedCost, task.payments);

  function startEditing() {
    setError(false);
    setEditTitle(title);
    setEditCategory(task.category);
    setEditPriority(task.priority);
    setEditDueDate(toDateInputValue(task.dueDate));
    setIsEditing(true);
  }

  async function handleToggleDone() {
    setError(false);
    setPending(true);
    const result = await setTaskStatus(task.id, !done);
    setPending(false);
    if (!result.ok) { setError(true); return; }
    onChanged();
  }

  async function handleDeletePayment(paymentId: string) {
    setError(false);
    setPending(true);
    const result = await deleteTaskPayment(paymentId);
    setPending(false);
    if (!result.ok) { setError(true); return; }
    onChanged();
  }

  async function handleToggleReminder() {
    setError(false);
    setPending(true);
    const result = await setTaskReminder(
      task.id,
      !task.reminderEnabled,
      task.dueDate ? new Date(task.dueDate) : null,
    );
    setPending(false);
    if (!result.ok) {
      setError(true);
      return;
    }
    onChanged();
  }

  async function handleDelete() {
    setError(false);
    setPending(true);
    const result = await softDeleteTask(task.id);
    setPending(false);
    if (!result.ok) {
      setError(true);
      return;
    }
    onChanged();
  }

  async function handleSaveEdit() {
    setError(false);
    setPending(true);
    const input: Record<string, unknown> = {
      category: editCategory,
      priority: editPriority,
    };
    if (locale === 'he') {
      input.title_he = editTitle;
    } else {
      input.title_en = editTitle;
    }
    if (toDateInputValue(task.dueDate) !== editDueDate) {
      input.dueDate = editDueDate ? new Date(editDueDate) : null;
    }
    const result = await editTask(task.id, input);
    setPending(false);
    if (!result.ok) {
      setError(true);
      return;
    }
    setIsEditing(false);
    onChanged();
  }

  if (isEditing) {
    return (
      <div className="flex flex-col gap-3 rounded-card bg-surface p-4 shadow-sm">
        <label className="flex flex-col gap-1 text-xs text-muted" htmlFor={`edit-title-${task.id}`}>
          {t('titleLabel')}
          <input
            id={`edit-title-${task.id}`}
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            className="rounded-card border border-muted/30 bg-background px-3 py-2 text-sm text-text"
          />
        </label>

        <div className="flex flex-wrap gap-3">
          <label className="flex flex-col gap-1 text-xs text-muted" htmlFor={`edit-category-${task.id}`}>
            {t('categoryLabel')}
            <select
              id={`edit-category-${task.id}`}
              value={editCategory}
              onChange={(e) => setEditCategory(e.target.value as TaskCategory)}
              className="rounded-card border border-muted/30 bg-background px-2 py-1.5 text-sm text-text"
            >
              {CATEGORY_OPTIONS.map((category) => (
                <option key={category} value={category}>
                  {tCategory(category)}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs text-muted" htmlFor={`edit-priority-${task.id}`}>
            {t('priorityLabel')}
            <select
              id={`edit-priority-${task.id}`}
              value={editPriority}
              onChange={(e) => setEditPriority(e.target.value as TaskPriority)}
              className="rounded-card border border-muted/30 bg-background px-2 py-1.5 text-sm text-text"
            >
              {PRIORITY_OPTIONS.map((priority) => (
                <option key={priority} value={priority}>
                  {tPriority(priority)}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs text-muted" htmlFor={`edit-due-${task.id}`}>
            {t('dueDateLabel')}
            <input
              id={`edit-due-${task.id}`}
              type="date"
              dir="ltr"
              value={editDueDate}
              onChange={(e) => setEditDueDate(e.target.value)}
              className="rounded-card border border-muted/30 bg-background px-2 py-1.5 text-sm text-text"
            />
          </label>
        </div>

        {error ? <p className="text-sm text-red-600">{t('error')}</p> : null}

        <div className="flex gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={handleSaveEdit}
            className="rounded-card bg-primary px-3 py-1.5 text-sm font-medium text-background disabled:opacity-60"
          >
            {t('save')}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setIsEditing(false)}
            className="rounded-card border border-muted/30 px-3 py-1.5 text-sm text-text"
          >
            {t('cancel')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-card bg-surface p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="checkbox"
          checked={done}
          disabled={pending}
          onChange={handleToggleDone}
          aria-label={title}
          className="h-4 w-4"
        />
        <span className={done ? 'flex-1 text-sm text-muted line-through' : 'flex-1 text-sm text-text'}>
          {title}
        </span>
        <span className="rounded-card bg-background px-2 py-0.5 text-xs text-muted">
          {tCategory(task.category)}
        </span>
        <span className="rounded-card bg-muted/20 px-2 py-0.5 text-xs text-text">
          {tPriority(task.priority)}
        </span>
      </div>

      {premium ? (
        <div className="flex flex-col gap-2 rounded-card bg-background p-3">
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
            <span>
              {task.estimatedCost != null
                ? tPayments('paidOfCost', { paid: fmt(money.paid), cost: fmt(money.cost ?? 0) })
                : tPayments('paidOnly', { paid: fmt(money.paid) })}
            </span>
            {task.estimatedCost != null ? (
              (money.remaining ?? 0) < 0 ? (
                <span className="text-primary">{tPayments('overpaid')}</span>
              ) : (
                <span>{tPayments('remaining', { amount: fmt(money.remaining ?? 0) })}</span>
              )
            ) : null}
            <button
              type="button"
              onClick={() => {
                setShowPaymentForm((v) => !v);
                setEditingPaymentId(null);
              }}
              className="ms-auto text-primary"
            >
              {tPayments('recordCta')}
            </button>
          </div>

          {task.payments.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {task.payments.map((payment) => (
                <li key={payment.id}>
                  {editingPaymentId === payment.id ? (
                    <PaymentForm
                      taskId={task.id}
                      partner1Name={partner1Name}
                      partner2Name={partner2Name}
                      initialCost={task.estimatedCost}
                      editing={{
                        paymentId: payment.id,
                        amount: payment.amount,
                        payer: payment.payer,
                        payerLabel: payment.payerLabel,
                        paidOn: payment.paidOn,
                        note: payment.note,
                      }}
                      onCancel={() => setEditingPaymentId(null)}
                      onSaved={() => setEditingPaymentId(null)}
                    />
                  ) : (
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                      <span className="text-text">{fmt(payment.amount)}</span>
                      <span>
                        {payerDisplayName(
                          payment.payer,
                          payment.payerLabel,
                          { partner1Name, partner2Name },
                          payerLabels,
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingPaymentId(payment.id);
                          setShowPaymentForm(false);
                        }}
                        className="text-primary"
                      >
                        {tPayments('editPayment')}
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => handleDeletePayment(payment.id)}
                        className="text-red-600"
                      >
                        {tPayments('deletePayment')}
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : null}

          {showPaymentForm ? (
            <PaymentForm
              taskId={task.id}
              partner1Name={partner1Name}
              partner2Name={partner2Name}
              initialCost={task.estimatedCost}
              onCancel={() => setShowPaymentForm(false)}
              onSaved={() => setShowPaymentForm(false)}
            />
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
        <span>
          {task.dueDate
            ? new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric' }).format(
                new Date(task.dueDate),
              )
            : t('noDueDate')}
        </span>

        <button type="button" disabled={pending} onClick={handleToggleReminder} className="text-primary">
          {task.reminderEnabled ? t('reminderOn') : t('reminderOff')}
        </button>

        <button type="button" onClick={startEditing} className="text-text">
          {t('edit')}
        </button>

        <button type="button" disabled={pending} onClick={handleDelete} className="text-red-600">
          {t('delete')}
        </button>
      </div>

      {error ? <p className="text-sm text-red-600">{t('error')}</p> : null}
    </div>
  );
}
