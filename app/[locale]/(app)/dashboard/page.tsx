import { setRequestLocale } from 'next-intl/server';
import { auth } from '@/lib/auth';
import { getCurrentWedding } from '@/lib/wedding/queries';
import { redirect } from '@/lib/i18n/navigation';
import { getDashboardData } from '@/lib/dashboard/aggregate';
import { CountdownHero } from './countdown-hero';
import { OverviewCards } from './overview-cards';
import { NextUp } from './next-up';

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user?.id) redirect({ href: '/login', locale });
  const wedding = await getCurrentWedding(session!.user.id);
  if (!wedding) redirect({ href: '/onboarding', locale });

  const data = await getDashboardData(wedding!, new Date());

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6 sm:p-8">
      <CountdownHero
        locale={locale}
        partner1Name={data.partner1Name}
        partner2Name={data.partner2Name}
        countdownDays={data.countdownDays}
        dateIsApproximate={data.dateIsApproximate}
        weddingDate={data.weddingDate}
      />
      <OverviewCards
        locale={locale}
        checklist={data.checklist}
        budget={data.budget}
        vendors={data.vendors}
        concept={data.concept}
      />
      <NextUp locale={locale} tasks={data.nextUp} />
    </main>
  );
}
