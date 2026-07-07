'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { TaskCategory, TaskPriority } from '@prisma/client';
import { setTaskStatus, editTask, softDeleteTask, setTaskReminder } from '@/lib/actions/checklist';
import { resolveTaskTitle } from '@/lib/checklist/title';
import { CATEGORY_OPTIONS, PRIORITY_OPTIONS } from '@/lib/checklist/schema';
import type { SerializedTask } from './checklist-view';

interface TaskRowProps {
  task: SerializedTask;
  locale: string;
  onChanged: () => void;
}

function toDateInputValue(iso: string | null): string {
  return iso ? iso.slice(0, 10) : '';
}

export function TaskRow({ task, locale, onChanged }: TaskRowProps) {
  const t = useTranslations('Checklist');
  const tCategory = useTranslations('TaskCategory');
  const tPriority = useTranslations('TaskPriority');

  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [askingPaid, setAskingPaid] = useState(false);
  const [paidInput, setPaidInput] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState<TaskCategory>(task.category);
  const [editPriority, setEditPriority] = useState<TaskPriority>(task.priority);
  const [editDueDate, setEditDueDate] = useState('');

  const title = resolveTaskTitle(task, locale);
  const done = task.status === 'DONE';

  function startEditing() {
    setError(false);
    setEditTitle(title);
    setEditCategory(task.category);
    setEditPriority(task.priority);
    setEditDueDate(toDateInputValue(task.dueDate));
    setIsEditing(true);
  }

  async function completeWith(amountPaid: number | null) {
    setError(false);
    setPending(true);
    const result = await setTaskStatus(task.id, true, amountPaid);
    setPending(false);
    setAskingPaid(false);
    setPaidInput('');
    if (!result.ok) { setError(true); return; }
    onChanged();
  }

  async function handleToggleDone() {
    if (!done) { setAskingPaid(true); return; }
    setError(false);
    setPending(true);
    const result = await setTaskStatus(task.id, false);
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
        <span className="rounded-card bg-accent/20 px-2 py-0.5 text-xs text-text">
          {tPriority(task.priority)}
        </span>
      </div>

      {askingPaid ? (
        <div className="flex flex-wrap items-center gap-2 rounded-card bg-background p-2">
          <label className="text-xs text-muted" htmlFor={`paid-${task.id}`}>
            {t('paidPrompt')}
          </label>
          <input
            id={`paid-${task.id}`}
            type="number"
            min="0"
            dir="ltr"
            value={paidInput}
            onChange={(e) => setPaidInput(e.target.value)}
            className="w-28 rounded-card border border-muted/30 bg-surface px-2 py-1 text-sm text-text"
          />
          <button
            type="button"
            disabled={pending}
            onClick={() => completeWith(paidInput === '' ? null : Math.trunc(Number(paidInput)))}
            className="rounded-card bg-primary px-3 py-1 text-sm text-background disabled:opacity-60"
          >
            {t('paidSave')}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => completeWith(null)}
            className="rounded-card border border-muted/30 px-3 py-1 text-sm text-text"
          >
            {t('paidSkip')}
          </button>
        </div>
      ) : null}

      {done && task.amountPaid != null ? (
        <span className="text-xs text-muted">
          {t('paidLabel', { amount: `₪${task.amountPaid.toLocaleString(locale)}` })}
        </span>
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
