import { auth } from '@/lib/auth';
import { getCurrentWedding } from '@/lib/wedding/queries';
import { redirect } from '@/lib/i18n/navigation';
import { setRequestLocale } from 'next-intl/server';
import { LogoutButton } from '../logout-button';

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  // proxy.ts already guarantees a session on (app) routes; this is defense-in-depth.
  if (!session?.user?.id) redirect({ href: '/login', locale });

  const wedding = await getCurrentWedding(session!.user.id);
  if (!wedding?.onboardingCompletedAt) {
    redirect({ href: '/onboarding', locale });
  }

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-end border-b border-muted/20 bg-surface px-4 py-2">
        <LogoutButton />
      </header>
      <main>{children}</main>
    </div>
  );
}
