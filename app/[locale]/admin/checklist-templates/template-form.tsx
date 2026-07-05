'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { TaskCategory, TaskPriority, TitleLocale } from '@prisma/client';
import { createTemplate, updateTemplate } from '@/lib/actions/admin-templates';
import { templateSchema, CATEGORY_OPTIONS, PRIORITY_OPTIONS, TITLE_LOCALE_OPTIONS } from '@/lib/checklist/schema';
import type { SerializedTemplate } from './templates-admin';

interface TemplateFormProps {
  template?: SerializedTemplate | null;
  onSaved: () => void;
  onCancel: () => void;
}

export function TemplateForm({ template, onSaved, onCancel }: TemplateFormProps) {
  const t = useTranslations('AdminTemplates');
  const tCategory = useTranslations('TaskCategory');
  const tPriority = useTranslations('TaskPriority');

  const [titleEn, setTitleEn] = useState(template?.title_en ?? '');
  const [titleHe, setTitleHe] = useState(template?.title_he ?? '');
  const [titleLocale, setTitleLocale] = useState<TitleLocale>(template?.titleLocale ?? 'AUTO');
  const [category, setCategory] = useState<TaskCategory>(template?.category ?? CATEGORY_OPTIONS[0]);
  const [priority, setPriority] = useState<TaskPriority>(template?.priority ?? 'MEDIUM');
  const [dueOffsetDays, setDueOffsetDays] = useState(
    template?.dueOffsetDays != null ? String(template.dueOffsetDays) : '',
  );
  const [active, setActive] = useState(template?.active ?? true);
  const [sortOrder, setSortOrder] = useState(template ? String(template.sortOrder) : '0');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const input = {
      title_en: titleEn.trim(),
      title_he: titleHe.trim(),
      titleLocale,
      category,
      priority,
      dueOffsetDays: dueOffsetDays.trim() === '' ? null : Number(dueOffsetDays),
      active,
      sortOrder: sortOrder.trim() === '' ? 0 : Number(sortOrder),
    };

    const parsed = templateSchema.safeParse(input);
    if (!parsed.success) {
      setError(true);
      return;
    }

    setError(false);
    setPending(true);
    const result = template
      ? await updateTemplate(template.id, parsed.data)
      : await createTemplate(parsed.data);
    setPending(false);

    if (!result.ok) {
      setError(true);
      return;
    }
    onSaved();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-card bg-surface p-4 shadow-sm"
    >
      <h2 className="font-display text-lg text-text">
        {template ? t('edit') : t('new')}
      </h2>

      <div className="flex flex-wrap gap-3">
        <label className="flex flex-1 flex-col gap-1 text-xs text-muted" htmlFor="template-title-en">
          {t('titleEnLabel')}
          <input
            id="template-title-en"
            type="text"
            dir="ltr"
            value={titleEn}
            onChange={(e) => setTitleEn(e.target.value)}
            className="rounded-card border border-muted/30 bg-background px-3 py-2 text-sm text-text"
          />
        </label>

        <label className="flex flex-1 flex-col gap-1 text-xs text-muted" htmlFor="template-title-he">
          {t('titleHeLabel')}
          <input
            id="template-title-he"
            type="text"
            dir="rtl"
            value={titleHe}
            onChange={(e) => setTitleHe(e.target.value)}
            className="rounded-card border border-muted/30 bg-background px-3 py-2 text-sm text-text"
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-xs text-muted" htmlFor="template-title-locale">
          {t('titleLocaleLabel')}
          <select
            id="template-title-locale"
            value={titleLocale}
            onChange={(e) => setTitleLocale(e.target.value as TitleLocale)}
            className="rounded-card border border-muted/30 bg-background px-2 py-1.5 text-sm text-text"
          >
            {TITLE_LOCALE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {t(`titleLocale.${option}`)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-muted" htmlFor="template-category">
          {t('categoryLabel')}
          <select
            id="template-category"
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

        <label className="flex flex-col gap-1 text-xs text-muted" htmlFor="template-priority">
          {t('priorityLabel')}
          <select
            id="template-priority"
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
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-muted" htmlFor="template-due-offset">
          {t('dueOffsetDaysLabel')}
          <input
            id="template-due-offset"
            type="number"
            dir="ltr"
            min={0}
            max={3650}
            value={dueOffsetDays}
            onChange={(e) => setDueOffsetDays(e.target.value)}
            className="rounded-card border border-muted/30 bg-background px-2 py-1.5 text-sm text-text"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs text-muted" htmlFor="template-sort-order">
          {t('sortOrderLabel')}
          <input
            id="template-sort-order"
            type="number"
            dir="ltr"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="rounded-card border border-muted/30 bg-background px-2 py-1.5 text-sm text-text"
          />
        </label>

        <label className="flex items-center gap-2 text-sm text-text" htmlFor="template-active">
          <input
            id="template-active"
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="h-4 w-4"
          />
          {t('activeLabel')}
        </label>
      </div>

      {error ? <p className="text-sm text-red-600">{t('error')}</p> : null}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
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
