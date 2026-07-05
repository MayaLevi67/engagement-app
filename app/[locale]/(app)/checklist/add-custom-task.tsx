'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { TaskCategory, TaskPriority } from '@prisma/client';
import { addCustomTask } from '@/lib/actions/checklist';
import { CATEGORY_OPTIONS, PRIORITY_OPTIONS } from '@/lib/checklist/schema';

interface AddCustomTaskProps {
  locale: string;
  onAdded: () => void;
  onCancel: () => void;
}

export function AddCustomTask({ locale, onAdded, onCancel }: AddCustomTaskProps) {
  const t = useTranslations('Checklist');
  const tCategory = useTranslations('TaskCategory');
  const tPriority = useTranslations('TaskPriority');

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<TaskCategory>('OTHER');
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM');
  const [dueDate, setDueDate] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;

    setError(false);
    setPending(true);
    const result = await addCustomTask({
      title_en: locale === 'he' ? '' : trimmed,
      title_he: locale === 'he' ? trimmed : '',
      category,
      priority,
      dueDate: dueDate ? new Date(dueDate) : null,
    });
    setPending(false);
    if (!result.ok) {
      setError(true);
      return;
    }
    onAdded();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-card bg-surface p-4 shadow-sm">
      <h2 className="font-display text-lg text-text">{t('addCustomTitle')}</h2>

      <label className="flex flex-col gap-1 text-xs text-muted" htmlFor="add-task-title">
        {t('titleLabel')}
        <input
          id="add-task-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="rounded-card border border-muted/30 bg-background px-3 py-2 text-sm text-text"
        />
      </label>

      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-xs text-muted" htmlFor="add-task-category">
          {t('categoryLabel')}
          <select
            id="add-task-category"
            value={category}
            onChange={(e) => setCategory(e.target.value as TaskCategory)}
            className="rounded-card border border-muted/30 bg-background px-2 py-1.5 text-sm text-text"
          >
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {tCategory(option)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-muted" htmlFor="add-task-priority">
          {t('priorityLabel')}
          <select
            id="add-task-priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value as TaskPriority)}
            className="rounded-card border border-muted/30 bg-background px-2 py-1.5 text-sm text-text"
          >
            {PRIORITY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {tPriority(option)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-muted" htmlFor="add-task-due">
          {t('dueDateLabel')}
          <input
            id="add-task-due"
            type="date"
            dir="ltr"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="rounded-card border border-muted/30 bg-background px-2 py-1.5 text-sm text-text"
          />
        </label>
      </div>

      {error ? <p className="text-sm text-red-600">{t('error')}</p> : null}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending || !title.trim()}
          className="rounded-card bg-primary px-4 py-2 text-sm font-medium text-background disabled:opacity-60"
        >
          {t('save')}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onCancel}
          className="rounded-card border border-muted/30 px-4 py-2 text-sm text-text"
        >
          {t('cancel')}
        </button>
      </div>
    </form>
  );
}
