import { setRequestLocale } from 'next-intl/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { redirect } from '@/lib/i18n/navigation';
import { BudgetTemplatesAdmin } from './budget-templates-admin';

export default async function BudgetTemplatesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user?.id) redirect({ href: '/login', locale });
  // The role is resolved from the live DB rather than the JWT/session claim,
  // since the JWT role is stamped at login and can be stale.
  const user = await prisma.user.findUnique({ where: { id: session!.user.id }, select: { role: true } });
  if (user?.role !== 'ADMIN') redirect({ href: '/dashboard', locale });

  const rows = await prisma.budgetTemplate.findMany({ orderBy: { sortOrder: 'asc' } });

  return (
    <main className="mx-auto w-full max-w-3xl p-8">
      <BudgetTemplatesAdmin
        rows={rows.map((r) => ({
          category: r.category, defaultPercent: r.defaultPercent, active: r.active, sortOrder: r.sortOrder,
        }))}
      />
    </main>
  );
}
