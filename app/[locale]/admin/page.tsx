import { setRequestLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/navigation';
import { getAdminOverview } from '@/lib/admin/overview';

function Card({
  title,
  href,
  openLabel,
  children,
}: {
  title: string;
  href: string;
  openLabel: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2 rounded-card bg-surface p-5 shadow-sm">
      <h2 className="font-display text-lg text-text">{title}</h2>
      <div className="flex-1 text-sm text-muted">{children}</div>
      <Link href={href} className="mt-2 inline-block self-start rounded-card bg-primary px-4 py-2 text-sm font-medium text-background">
        {openLabel}
      </Link>
    </section>
  );
}

export default async function AdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Admin');
  const tTemplates = await getTranslations('AdminTemplates');
  const tConcepts = await getTranslations('AdminConcepts');
  const tVendors = await getTranslations('AdminVendors');

  const overview = await getAdminOverview();
  const openLabel = t('open');

  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-display text-2xl text-text">{t('overviewTitle')}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card title={tTemplates('title')} href="/admin/checklist-templates" openLabel={openLabel}>
          {t('countActive', { active: overview.checklistTemplates.active, total: overview.checklistTemplates.total })}
        </Card>
        <Card title={tConcepts('title')} href="/admin/concepts" openLabel={openLabel}>
          {t('countActive', { active: overview.concepts.active, total: overview.concepts.total })}
        </Card>
        <Card title={tVendors('title')} href="/admin/vendors" openLabel={openLabel}>
          {t('countActive', { active: overview.vendors.active, total: overview.vendors.total })}
        </Card>
        <Card title={t('budgetCardTitle')} href="/admin/budget-templates" openLabel={openLabel}>
          <span className={overview.budget.balanced ? 'text-muted' : 'text-red-600'}>
            {overview.budget.balanced ? t('budgetBalanced') : t('budgetImbalanced', { sum: overview.budget.sum })}
          </span>
        </Card>
      </div>
    </div>
  );
}
