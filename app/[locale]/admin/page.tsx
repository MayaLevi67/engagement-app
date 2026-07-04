import { setRequestLocale, getTranslations } from 'next-intl/server';

export default async function AdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Admin');
  return <main className="p-8">{t('placeholder')}</main>;
}
