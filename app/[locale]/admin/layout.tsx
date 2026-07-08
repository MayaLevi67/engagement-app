import { setRequestLocale, getTranslations } from 'next-intl/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { redirect, Link } from '@/lib/i18n/navigation';
import { adminGateDecision } from '@/lib/admin/gate';
import { AdminNav } from './admin-nav';

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Admin');

  const session = await auth();
  const dbRole = session?.user?.id
    ? (await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } }))?.role ?? null
    : null;

  const decision = adminGateDecision(session?.user?.id, dbRole);
  if (decision === 'login') redirect({ href: '/login', locale });
  if (decision === 'dashboard') redirect({ href: '/dashboard', locale });

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6 sm:flex-row sm:p-8">
      <aside className="flex flex-col gap-4 sm:w-56 sm:shrink-0">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-xl text-text">{t('panelTitle')}</h1>
          <Link href="/dashboard" className="text-xs text-primary">{t('backToApp')}</Link>
        </div>
        <AdminNav />
      </aside>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
