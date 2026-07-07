'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/lib/i18n/navigation';
import type { TaskCategory } from '@prisma/client';
import { updateBudgetTemplate } from '@/lib/actions/admin-budget';

export interface BudgetTemplateRow {
  category: TaskCategory;
  defaultPercent: number;
  active: boolean;
  sortOrder: number;
}

export function BudgetTemplatesAdmin({ rows }: { rows: BudgetTemplateRow[] }) {
  const t = useTranslations('AdminBudget');
  const tCategory = useTranslations('TaskCategory');
  const router = useRouter();
  const [draft, setDraft] = useState<BudgetTemplateRow[]>(rows);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  const activeSum = draft.filter((r) => r.active).reduce((s, r) => s + r.defaultPercent, 0);

  function patch(category: TaskCategory, over: Partial<BudgetTemplateRow>) {
    setDraft((d) => d.map((r) => (r.category === category ? { ...r, ...over } : r)));
  }

  async function save(row: BudgetTemplateRow) {
    setError(false);
    setPending(true);
    const result = await updateBudgetTemplate(row.category, {
      defaultPercent: row.defaultPercent, active: row.active, sortOrder: row.sortOrder,
    });
    setPending(false);
    if (!result.ok) { setError(true); return; }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-2xl text-text">{t('title')}</h1>
        <p className="text-sm text-muted">{t('subtitle')}</p>
      </header>

      <p className={activeSum === 100 ? 'text-sm text-muted' : 'text-sm text-red-600'}>
        {activeSum === 100 ? t('sumOk', { sum: activeSum }) : t('sumWarn', { sum: activeSum })}
      </p>

      <div className="flex flex-col gap-2">
        {draft.map((row) => (
          <div key={row.category} className="flex flex-wrap items-center gap-3 rounded-card bg-surface p-3 shadow-sm">
            <span className="w-32 text-sm text-text">{tCategory(row.category)}</span>
            <label className="flex items-center gap-1 text-xs text-muted">
              {t('percentLabel')}
              <input
                type="number" min="0" max="100" dir="ltr" value={row.defaultPercent}
                onChange={(e) => patch(row.category, { defaultPercent: Math.trunc(Number(e.target.value)) })}
                className="w-20 rounded-card border border-muted/30 bg-background px-2 py-1 text-sm text-text"
              />
            </label>
            <label className="flex items-center gap-1 text-xs text-muted">
              {t('activeLabel')}
              <input
                type="checkbox" checked={row.active}
                onChange={(e) => patch(row.category, { active: e.target.checked })}
              />
            </label>
            <button type="button" disabled={pending} onClick={() => save(row)}
              className="ms-auto rounded-card bg-primary px-3 py-1.5 text-sm text-background disabled:opacity-60">
              {t('save')}
            </button>
          </div>
        ))}
      </div>
      {error ? <p className="text-sm text-red-600">{t('error')}</p> : null}
    </div>
  );
}
