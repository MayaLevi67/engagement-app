import { setRequestLocale } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { BudgetTemplatesAdmin } from './budget-templates-admin';

export default async function BudgetTemplatesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const rows = await prisma.budgetTemplate.findMany({ orderBy: { sortOrder: 'asc' } });

  return (
    <BudgetTemplatesAdmin
      rows={rows.map((r) => ({
        category: r.category, defaultPercent: r.defaultPercent, active: r.active, sortOrder: r.sortOrder,
      }))}
    />
  );
}
