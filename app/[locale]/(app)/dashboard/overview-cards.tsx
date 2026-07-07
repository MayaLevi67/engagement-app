import { useTranslations } from 'next-intl';
import { Link } from '@/lib/i18n/navigation';
import { resolveConceptTitle } from '@/lib/concepts/title';
import type { BudgetSummary, ChecklistSummary, ConceptSummary, VendorCounts } from '@/lib/dashboard/aggregate';

interface OverviewCardsProps {
  locale: string;
  checklist: ChecklistSummary;
  budget: BudgetSummary | null;
  vendors: VendorCounts;
  concept: ConceptSummary | null;
}

function Card({ title, href, cta, children }: { title: string; href: string; cta: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2 rounded-card bg-surface p-5 shadow-sm">
      <h2 className="font-display text-lg text-text">{title}</h2>
      <div className="flex-1 text-sm text-muted">{children}</div>
      <Link href={href} className="mt-2 inline-block self-start rounded-card bg-primary px-4 py-2 text-sm font-medium text-background">
        {cta}
      </Link>
    </section>
  );
}

export function OverviewCards({ locale, checklist, budget, vendors, concept }: OverviewCardsProps) {
  const t = useTranslations('Dashboard');
  const fmt = (n: number) => `₪${n.toLocaleString(locale)}`;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {/* Checklist */}
      <Card title={t('checklistTitle')} href="/checklist" cta={t('checklistCta')}>
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
      </Card>

      {/* Budget — dual-mode (summary vs nudge body; same CTA either way) */}
      <Card title={t('budgetTitle')} href="/budget" cta={t('budgetCta')}>
        {budget ? (
          <span>{t('budgetSummary', { committed: fmt(budget.committed), total: fmt(budget.total) })}</span>
        ) : (
          <span>{t('budgetBody')}</span>
        )}
      </Card>

      {/* Vendors — dual-mode */}
      <Card title={t('vendorsTitle')} href="/vendors" cta={t('vendorsCta')}>
        {vendors.shortlisted > 0 ? (
          <span>{t('vendorsSummary', { shortlisted: vendors.shortlisted, booked: vendors.booked })}</span>
        ) : (
          <span>{t('vendorsBody')}</span>
        )}
      </Card>

      {/* Concept — dual-mode */}
      <Card title={t('chooseConceptTitle')} href="/concepts" cta={t('chooseConceptCta')}>
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
      </Card>
    </div>
  );
}
