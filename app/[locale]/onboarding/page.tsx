import { setRequestLocale } from 'next-intl/server';
import { auth } from '@/lib/auth';
import { getCurrentWedding } from '@/lib/wedding/queries';
import { redirect } from '@/lib/i18n/navigation';
import { OnboardingWizard } from './onboarding-wizard';

export default async function OnboardingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user?.id) {
    redirect({ href: '/login', locale });
  }

  const wedding = await getCurrentWedding(session!.user.id);
  if (wedding?.onboardingCompletedAt) {
    redirect({ href: '/dashboard', locale });
  }

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <OnboardingWizard
        defaultPartner1={session!.user.name ?? ''}
        initial={{
          partner1Name: wedding?.partner1Name ?? '',
          partner2Name: wedding?.partner2Name ?? '',
          weddingDate: wedding?.weddingDate ? wedding.weddingDate.toISOString() : null,
          dateIsApproximate: wedding?.dateIsApproximate ?? false,
          guestCount: wedding?.guestCount ?? undefined,
          budgetTotal: wedding?.budgetTotal ?? undefined,
          city: wedding?.city ?? '',
          venueSetting: wedding?.venueSetting ?? undefined,
          ceremonyType: wedding?.ceremonyType ?? undefined,
          priorities: wedding?.priorities ?? [],
        }}
      />
    </main>
  );
}
