import { setRequestLocale, getTranslations } from 'next-intl/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getCurrentWedding } from '@/lib/wedding/queries';
import { rollupTasks } from '@/lib/budget/rollup';
import { Link } from '@/lib/i18n/navigation';

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Dashboard');

  const session = await auth();
  const wedding = session?.user?.id ? await getCurrentWedding(session.user.id) : null;

  // Only roll up committed spend on the summary path (budget set). The
  // null-budget nudge path stays a single cheap query.
  let committedTotal = 0;
  if (wedding?.budgetTotal != null) {
    const tasks = await prisma.task.findMany({
      where: { weddingId: wedding.id, deletedAt: null },
      select: { category: true, status: true, amountPaid: true, estimatedCost: true, deletedAt: true },
    });
    const { committed } = rollupTasks(tasks);
    committedTotal = Object.values(committed).reduce((s, n) => s + (n ?? 0), 0);
  }

  return (
    <main className="flex flex-col gap-6 p-8">
      {t('placeholder')}
      {!wedding?.selectedConceptId ? (
        <section className="rounded-card bg-surface p-5">
          <h2 className="font-display text-lg text-text">{t('chooseConceptTitle')}</h2>
          <p className="mt-1 text-sm text-muted">{t('chooseConceptBody')}</p>
          <Link
            href="/concepts"
            className="mt-3 inline-block rounded-card bg-primary px-4 py-2 text-sm font-medium text-background"
          >
            {t('chooseConceptCta')}
          </Link>
        </section>
      ) : null}

      <section className="rounded-card bg-surface p-5">
        <h2 className="font-display text-lg text-text">{t('budgetTitle')}</h2>
        {wedding?.budgetTotal == null ? (
          <p className="mt-1 text-sm text-muted">{t('budgetBody')}</p>
        ) : (
          <p className="mt-1 text-sm text-muted">
            {t('budgetSummary', {
              committed: `₪${committedTotal.toLocaleString(locale)}`,
              total: `₪${wedding.budgetTotal.toLocaleString(locale)}`,
            })}
          </p>
        )}
        <Link
          href="/budget"
          className="mt-3 inline-block rounded-card bg-primary px-4 py-2 text-sm font-medium text-background"
        >
          {t('budgetCta')}
        </Link>
      </section>

      <section className="rounded-card bg-surface p-5">
        <h2 className="font-display text-lg text-text">{t('vendorsTitle')}</h2>
        <p className="mt-1 text-sm text-muted">{t('vendorsBody')}</p>
        <Link
          href="/vendors"
          className="mt-3 inline-block rounded-card bg-primary px-4 py-2 text-sm font-medium text-background"
        >
          {t('vendorsCta')}
        </Link>
      </section>
    </main>
  );
}
