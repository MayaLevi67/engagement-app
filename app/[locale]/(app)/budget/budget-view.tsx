'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from '@/lib/i18n/navigation';
import type { CategoryAllocation, BudgetFeedback } from '@/lib/budget/optimize';
import type { GiftEstimate } from '@/lib/budget/gifts';
import { BudgetTotalCard } from './budget-total-card';
import { GiftEstimatorCard } from './gift-estimator-card';
import { CategoryBreakdown } from './category-breakdown';

interface BudgetViewProps {
  locale: string;
  budgetTotal: number | null;
  avgGiftPerGuest: number | null;
  guestCount: number | null;
  categories: CategoryAllocation[];
  feedback: BudgetFeedback;
  gift: GiftEstimate;
}

export function BudgetView(props: BudgetViewProps) {
  const t = useTranslations('Budget');
  const tCategory = useTranslations('TaskCategory');
  const router = useRouter();
  const refresh = () => router.refresh();

  const fmt = (n: number) => `₪${n.toLocaleString(props.locale)}`;

  function feedbackBanner() {
    const f = props.feedback;
    if (f.type === 'over_budget') {
      return t('overBudget', {
        amount: fmt(f.shortfall),
        categories: f.underfunded.map((c) => tCategory(c)).join(', '),
      });
    }
    if (f.type === 'headroom') return t('headroom', { amount: fmt(f.unallocated) });
    if (f.type === 'committed_overrun') return t('committedOverrun', { amount: fmt(f.overrun) });
    return null;
  }

  const banner = feedbackBanner();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-2xl text-text">{t('title')}</h1>
        <p className="font-body text-sm text-muted">{t('subtitle')}</p>
      </header>

      <BudgetTotalCard locale={props.locale} budgetTotal={props.budgetTotal} onChanged={refresh} />

      <GiftEstimatorCard
        locale={props.locale}
        avgGiftPerGuest={props.avgGiftPerGuest}
        guestCount={props.guestCount}
        gift={props.gift}
        onChanged={refresh}
      />

      {banner ? (
        <p className="rounded-card bg-muted/20 p-4 text-sm text-text">{banner}</p>
      ) : null}

      {props.budgetTotal == null ? (
        <p className="rounded-card bg-surface p-6 text-center text-sm text-muted shadow-sm">{t('noBudget')}</p>
      ) : (
        <CategoryBreakdown locale={props.locale} categories={props.categories} onChanged={refresh} />
      )}
    </div>
  );
}
