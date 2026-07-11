'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { CategoryAllocation } from '@/lib/budget/optimize';
import { setCategoryAllocation, clearCategoryAllocation } from '@/lib/actions/budget';

export function CategoryBreakdown({
  locale, categories, onChanged,
}: { locale: string; categories: CategoryAllocation[]; onChanged: () => void }) {
  const t = useTranslations('Budget');
  const tCategory = useTranslations('TaskCategory');
  const fmt = (n: number) => `₪${n.toLocaleString(locale)}`;
  const [pinningCategory, setPinningCategory] = useState<string | null>(null);
  const [pinValue, setPinValue] = useState('');
  const [pending, setPending] = useState(false);

  async function savePin(category: string) {
    setPending(true);
    const amount = pinValue === '' ? 0 : Math.trunc(Number(pinValue));
    const result = await setCategoryAllocation(category as never, amount);
    setPending(false);
    if (result.ok) { setPinningCategory(null); setPinValue(''); onChanged(); }
  }

  async function unpin(category: string) {
    setPending(true);
    const result = await clearCategoryAllocation(category as never);
    setPending(false);
    if (result.ok) onChanged();
  }

  return (
    <section className="flex flex-col gap-3" data-testid="category-breakdown">
      <h2 className="font-display text-lg text-text">{t('breakdownTitle')}</h2>
      {categories.map((c) => {
        const recommendedLine = `${t('recommended')}: ${fmt(c.recommended)}`;
        const committedLine = `${t('committed')}: ${fmt(c.committed)}`;
        const openLine = `${t('open')}: ${fmt(c.open)}`;
        return (
        <div key={c.category} className="flex flex-col gap-2 rounded-card bg-surface p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium text-text">{tCategory(c.category)}</span>
            <span className="text-sm text-text">{recommendedLine}</span>
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-muted">
            <span>{committedLine}</span>
            <span>{openLine}</span>
            {c.pinned ? <span className="text-primary">{t('pinnedLabel')}</span> : null}
          </div>
          {pinningCategory === c.category ? (
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="number" min="0" dir="ltr" value={pinValue}
                onChange={(e) => setPinValue(e.target.value)}
                className="w-32 rounded-card border border-muted/30 bg-background px-2 py-1 text-sm text-text"
              />
              <button type="button" disabled={pending} onClick={() => savePin(c.category)}
                className="rounded-card bg-primary px-3 py-1 text-sm text-background disabled:opacity-60">
                {t('save')}
              </button>
              <button type="button" disabled={pending} onClick={() => setPinningCategory(null)}
                className="rounded-card border border-muted/30 px-3 py-1 text-sm text-text">
                {t('cancel')}
              </button>
            </div>
          ) : (
            <div className="flex gap-3 text-xs">
              <button type="button" onClick={() => { setPinningCategory(c.category); setPinValue(String(c.recommended)); }}
                className="text-primary">
                {t('pinCta')}
              </button>
              {c.pinned ? (
                <button type="button" disabled={pending} onClick={() => unpin(c.category)} className="text-muted">
                  {t('unpinCta')}
                </button>
              ) : null}
            </div>
          )}
        </div>
        );
      })}
    </section>
  );
}
