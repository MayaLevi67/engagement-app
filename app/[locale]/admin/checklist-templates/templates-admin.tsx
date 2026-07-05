'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { TaskCategory, TaskPriority, TitleLocale } from '@prisma/client';
import { useRouter } from '@/lib/i18n/navigation';
import { setTemplateActive, reorderTemplate, deleteTemplate } from '@/lib/actions/admin-templates';
import { TemplateForm } from './template-form';

export interface SerializedTemplate {
  id: string;
  title_en: string;
  title_he: string;
  titleLocale: TitleLocale;
  category: TaskCategory;
  priority: TaskPriority;
  dueOffsetDays: number | null;
  active: boolean;
  sortOrder: number;
}

interface TemplatesAdminProps {
  templates: SerializedTemplate[];
}

export function TemplatesAdmin({ templates }: TemplatesAdminProps) {
  const t = useTranslations('AdminTemplates');
  const tCategory = useTranslations('TaskCategory');
  const tPriority = useTranslations('TaskPriority');
  const router = useRouter();

  const [formTarget, setFormTarget] = useState<SerializedTemplate | 'new' | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  function refresh() {
    router.refresh();
  }

  function openForm(target: SerializedTemplate | 'new') {
    setJustSaved(false);
    setFormTarget(target);
  }

  function handleSaved() {
    setFormTarget(null);
    setJustSaved(true);
    refresh();
  }

  async function handleToggleActive(template: SerializedTemplate) {
    setErrorId(null);
    setPendingId(template.id);
    const result = await setTemplateActive(template.id, !template.active);
    setPendingId(null);
    if (!result.ok) {
      setErrorId(template.id);
      return;
    }
    refresh();
  }

  async function handleMove(index: number, direction: -1 | 1) {
    const current = templates[index];
    const target = templates[index + direction];
    if (!current || !target) return;

    setErrorId(null);
    setPendingId(current.id);
    const [currentResult, targetResult] = await Promise.all([
      reorderTemplate(current.id, target.sortOrder),
      reorderTemplate(target.id, current.sortOrder),
    ]);
    setPendingId(null);
    if (!currentResult.ok || !targetResult.ok) {
      setErrorId(current.id);
      return;
    }
    refresh();
  }

  async function handleDelete(templateId: string) {
    setErrorId(null);
    setPendingId(templateId);
    const result = await deleteTemplate(templateId);
    setPendingId(null);
    setConfirmingId(null);
    if (!result.ok) {
      setErrorId(templateId);
      return;
    }
    refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl text-text">{t('title')}</h1>
        <button
          type="button"
          onClick={() => openForm('new')}
          className="ms-auto rounded-card bg-primary px-4 py-2 text-sm font-medium text-background"
        >
          {t('new')}
        </button>
      </header>

      {justSaved && !formTarget ? (
        <p className="text-sm text-primary">{t('saved')}</p>
      ) : null}

      {formTarget ? (
        <TemplateForm
          template={formTarget === 'new' ? null : formTarget}
          onSaved={handleSaved}
          onCancel={() => setFormTarget(null)}
        />
      ) : null}

      <div className="overflow-x-auto rounded-card bg-surface shadow-sm">
        <table className="w-full text-start text-sm text-text">
          <thead>
            <tr className="border-b border-muted/30 text-xs text-muted">
              <th className="px-3 py-2 text-start font-medium">{t('titleEnLabel')}</th>
              <th className="px-3 py-2 text-start font-medium">{t('titleHeLabel')}</th>
              <th className="px-3 py-2 text-start font-medium">{t('categoryLabel')}</th>
              <th className="px-3 py-2 text-start font-medium">{t('priorityLabel')}</th>
              <th className="px-3 py-2 text-start font-medium">{t('dueOffsetDaysLabel')}</th>
              <th className="px-3 py-2 text-start font-medium">{t('activeLabel')}</th>
              <th className="px-3 py-2 text-start font-medium">{t('sortOrderLabel')}</th>
              <th className="px-3 py-2 text-start font-medium">{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {templates.map((template, index) => (
              <tr key={template.id} className="border-b border-muted/10 last:border-b-0">
                <td className="px-3 py-2" dir="ltr">
                  {template.title_en}
                </td>
                <td className="px-3 py-2" dir="rtl">
                  {template.title_he}
                </td>
                <td className="px-3 py-2">{tCategory(template.category)}</td>
                <td className="px-3 py-2">{tPriority(template.priority)}</td>
                <td className="px-3 py-2" dir="ltr">
                  {template.dueOffsetDays ?? t('noDueOffsetDays')}
                </td>
                <td className="px-3 py-2">
                  {template.active ? t('activeYes') : t('activeNo')}
                </td>
                <td className="px-3 py-2" dir="ltr">
                  {template.sortOrder}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={pendingId === template.id || index === 0}
                      onClick={() => handleMove(index, -1)}
                      className="text-text disabled:opacity-40"
                    >
                      {t('moveUp')}
                    </button>
                    <button
                      type="button"
                      disabled={pendingId === template.id || index === templates.length - 1}
                      onClick={() => handleMove(index, 1)}
                      className="text-text disabled:opacity-40"
                    >
                      {t('moveDown')}
                    </button>
                    <button
                      type="button"
                      disabled={pendingId === template.id}
                      onClick={() => openForm(template)}
                      className="text-text"
                    >
                      {t('edit')}
                    </button>
                    <button
                      type="button"
                      disabled={pendingId === template.id}
                      onClick={() => handleToggleActive(template)}
                      className="text-primary"
                    >
                      {template.active ? t('deactivate') : t('activate')}
                    </button>
                    {confirmingId === template.id ? (
                      <>
                        <span className="text-xs text-red-600">{t('confirmDelete')}</span>
                        <button
                          type="button"
                          disabled={pendingId === template.id}
                          onClick={() => handleDelete(template.id)}
                          className="text-red-600"
                        >
                          {t('delete')}
                        </button>
                        <button
                          type="button"
                          disabled={pendingId === template.id}
                          onClick={() => setConfirmingId(null)}
                          className="text-text"
                        >
                          {t('cancel')}
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        disabled={pendingId === template.id}
                        onClick={() => setConfirmingId(template.id)}
                        className="text-red-600"
                      >
                        {t('delete')}
                      </button>
                    )}
                    {errorId === template.id ? (
                      <span className="text-xs text-red-600">{t('error')}</span>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {templates.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted">{t('empty')}</p>
        ) : null}
      </div>
    </div>
  );
}
