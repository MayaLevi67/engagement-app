import { useTranslations } from 'next-intl';
import { Link } from '@/lib/i18n/navigation';
import { resolveConceptTitle } from '@/lib/concepts/title';
import { Card } from '@/components/editorial/card';
import type { BudgetSummary, ChecklistSummary, ConceptSummary, VendorCounts } from '@/lib/dashboard/aggregate';

interface OverviewCardsProps {
  locale: string;
  checklist: ChecklistSummary;
  budget: BudgetSummary | null;
  vendors: VendorCounts;
  concept: ConceptSummary | null;
}

function OverviewCard({
  title,
  href,
  cta,
  accent = 'sage',
  className = '',
  children,
}: {
  title: string;
  href: string;
  cta: string;
  accent?: 'sage' | 'wine' | 'none';
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card accent={accent} className={`flex h-full flex-col gap-2 ${className}`.trim()}>
      <h2 className="font-display text-lg text-text">{title}</h2>
      <div className="flex-1 text-sm text-muted">{children}</div>
      <Link href={href} className="mt-2 inline-block self-start rounded-card bg-primary px-4 py-2 text-sm font-medium text-background">
        {cta}
      </Link>
    </Card>
  );
}

export function OverviewCards({ locale, checklist, budget, vendors, concept }: OverviewCardsProps) {
  const t = useTranslations('Dashboard');
  const fmt = (n: number) => `₪${n.toLocaleString(locale)}`;

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {/* Checklist — money-adjacent progress, wine accent; wide (asymmetric grid) */}
      <OverviewCard title={t('checklistTitle')} href="/checklist" cta={t('checklistCta')} accent="wine" className="sm:col-span-2">
        {checklist.total > 0 ? (
          <div className="flex flex-col gap-2">
            <span>{t('checklistSummary', { done: checklist.done, total: checklist.total })}</span>
            <div className="h-2 w-full overflow-hidden rounded-card bg-background">
              <div className="h-full rounded-card bg-primary" style={{ width: `${checklist.pct}%` }} />
            </div>
            {checklist.overdue > 0 ? <span className="text-red-600">{t('checklistOverdue', { count: checklist.overdue })}</span> : null}
          </div>
        ) : (
          <span>{t('checklistEmpty')}</span>
        )}
      </OverviewCard>

      {/* Budget — dual-mode (summary vs nudge body; same CTA either way); wine accent for money */}
      <OverviewCard title={t('budgetTitle')} href="/budget" cta={t('budgetCta')} accent="wine">
        {budget ? (
          <div className="flex flex-col gap-1">
            <span>{t('budgetSummary', { committed: fmt(budget.committed), total: fmt(budget.total) })}</span>
            <span>{t('budgetRemaining', { remaining: fmt(budget.remaining) })}</span>
          </div>
        ) : (
          <span>{t('budgetBody')}</span>
        )}
      </OverviewCard>

      {/* Vendors — dual-mode */}
      <OverviewCard title={t('vendorsTitle')} href="/vendors" cta={t('vendorsCta')} accent="sage">
        {vendors.shortlisted > 0 ? (
          <span>{t('vendorsSummary', { shortlisted: vendors.shortlisted, booked: vendors.booked })}</span>
        ) : (
          <span>{t('vendorsBody')}</span>
        )}
      </OverviewCard>

      {/* Concept — dual-mode; wide (asymmetric grid) */}
      <OverviewCard title={t('chooseConceptTitle')} href="/concepts" cta={t('chooseConceptCta')} accent="sage" className="sm:col-span-2">
        {concept ? (
          <div className="flex flex-col gap-2">
            <span>{t('conceptChosen', { name: resolveConceptTitle(concept, locale) })}</span>
            <div className="flex gap-1">
              {concept.palette.slice(0, 5).map((hex, i) => (
                <span key={`${hex}-${i}`} className="h-5 w-5 rounded-full border border-muted/30" style={{ backgroundColor: hex }} />
              ))}
            </div>
          </div>
        ) : (
          <span>{t('chooseConceptBody')}</span>
        )}
      </OverviewCard>
    </div>
  );
}
