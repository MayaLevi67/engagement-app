import { setRequestLocale, getTranslations } from 'next-intl/server';
import { auth } from '@/lib/auth';
import { getCurrentWedding } from '@/lib/wedding/queries';
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
    </main>
  );
}
