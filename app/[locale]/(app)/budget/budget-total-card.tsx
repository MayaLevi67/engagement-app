'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { setBudgetTotal } from '@/lib/actions/budget';

export function BudgetTotalCard({
  locale, budgetTotal, onChanged,
}: { locale: string; budgetTotal: number | null; onChanged: () => void }) {
  const t = useTranslations('Budget');
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(budgetTotal != null ? String(budgetTotal) : '');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  async function save() {
    setError(false);
    setPending(true);
    const amount = value === '' ? null : Math.trunc(Number(value));
    const result = await setBudgetTotal(amount);
    setPending(false);
    if (!result.ok) { setError(true); return; }
    setEditing(false);
    onChanged();
  }

  return (
    <section className="rounded-card bg-surface p-5 shadow-sm">
      <h2 className="font-display text-lg text-text">{t('totalLabel')}</h2>
      {editing ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            type="number" min="0" dir="ltr" value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-40 rounded-card border border-muted/30 bg-background px-3 py-2 text-sm text-text"
          />
          <button type="button" disabled={pending} onClick={save}
            className="rounded-card bg-primary px-3 py-1.5 text-sm text-background disabled:opacity-60">
            {t('save')}
          </button>
          <button type="button" disabled={pending} onClick={() => setEditing(false)}
            className="rounded-card border border-muted/30 px-3 py-1.5 text-sm text-text">
            {t('cancel')}
          </button>
          {error ? <span className="text-sm text-red-600">{t('error')}</span> : null}
        </div>
      ) : (
        <div className="mt-2 flex items-center gap-3">
          <span className="text-xl text-text">
            {budgetTotal != null ? `₪${budgetTotal.toLocaleString(locale)}` : '—'}
          </span>
          <button type="button" onClick={() => setEditing(true)} className="text-sm text-primary">
            {budgetTotal != null ? t('editTotalCta') : t('setTotalCta')}
          </button>
        </div>
      )}
    </section>
  );
}
