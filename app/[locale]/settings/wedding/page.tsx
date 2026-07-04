import { setRequestLocale } from 'next-intl/server';
import { auth } from '@/lib/auth';
import { getCurrentWedding } from '@/lib/wedding/queries';
import { redirect } from '@/lib/i18n/navigation';
import { EditWeddingForm } from './edit-wedding-form';

export default async function SettingsWeddingPage({
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
  if (!wedding) {
    redirect({ href: '/onboarding', locale });
  }

  return (
    <main className="flex flex-1 justify-center p-6">
      <EditWeddingForm
        initial={{
          partner1Name: wedding!.partner1Name ?? '',
          partner2Name: wedding!.partner2Name ?? '',
          weddingDate: wedding!.weddingDate ? wedding!.weddingDate.toISOString() : null,
          dateIsApproximate: wedding!.dateIsApproximate ?? false,
          guestCount: wedding!.guestCount ?? undefined,
          budgetTotal: wedding!.budgetTotal ?? undefined,
          city: wedding!.city ?? '',
          venueSetting: wedding!.venueSetting ?? undefined,
          ceremonyType: wedding!.ceremonyType ?? undefined,
          priorities: wedding!.priorities ?? [],
        }}
      />
    </main>
  );
}
