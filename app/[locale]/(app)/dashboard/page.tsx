import { setRequestLocale, getTranslations } from 'next-intl/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getCurrentWedding } from '@/lib/wedding/queries';
import { redirect } from '@/lib/i18n/navigation';
import { getDashboardData } from '@/lib/dashboard/aggregate';
import { isPremium } from '@/lib/premium/entitlement';
import { CountdownHero } from './countdown-hero';
import { OverviewCards } from './overview-cards';
import { NextUp } from './next-up';
import { UpgradeButton } from '../upgrade-button';
import { DevPremiumToggle } from './dev-premium-toggle';
import { SectionHeader } from '@/components/editorial/section-header';
import { ImageRail } from '@/components/editorial/image-rail';
import { Card } from '@/components/editorial/card';

export default async function DashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ upgraded?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;

  const session = await auth();
  if (!session?.user?.id) redirect({ href: '/login', locale });
  const wedding = await getCurrentWedding(session!.user.id);
  if (!wedding) redirect({ href: '/onboarding', locale });

  const data = await getDashboardData(wedding!, new Date());
  const premium = isPremium(wedding!);
  const justUpgraded = sp.upgraded === '1';
  const t = await getTranslations('Premium');
  const tDash = await getTranslations('Dashboard');
  const tEditorial = await getTranslations('Editorial');

  // Dev-only testing aid: show a grant/revoke-premium control to admins in
  // non-production so the premium UX can be exercised without a real payment.
  const showDevPremium =
    process.env.NODE_ENV !== 'production' &&
    (
      await prisma.user.findUnique({
        where: { id: session!.user.id },
        select: { role: true },
      })
    )?.role === 'ADMIN';

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

      {!premium ? (
        <Card accent="wine" className="flex flex-col items-start gap-2">
          <h2 className="font-display text-lg text-text">{t('upgradeCardTitle')}</h2>
          <p className="text-sm text-muted">{t('upgradeCardBody')}</p>
          {justUpgraded ? <p className="text-sm text-primary">{t('confirming')}</p> : null}
          <UpgradeButton />
        </Card>
      ) : justUpgraded ? (
        <Card accent="none">
          <p className="text-sm font-medium text-primary">{t('premiumActive')}</p>
        </Card>
      ) : null}

      {showDevPremium ? <DevPremiumToggle premium={premium} /> : null}

      <div>
        <SectionHeader title={tDash('nextUpTitle')} />
        <ImageRail alt={tEditorial('photoAlt')} placeholderLabel={tEditorial('photoPlaceholder')}>
          <NextUp locale={locale} tasks={data.nextUp} />
        </ImageRail>
      </div>

      <OverviewCards
        locale={locale}
        checklist={data.checklist}
        budget={data.budget}
        vendors={data.vendors}
        concept={data.concept}
      />
    </main>
  );
}
