import { setRequestLocale, getTranslations } from 'next-intl/server';

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Dashboard');
  return <main className="p-8">{t('placeholder')}</main>;
}
