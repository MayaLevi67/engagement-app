import { setRequestLocale, getTranslations } from 'next-intl/server';

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Landing');

  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <h1 className="font-display text-4xl text-primary text-center">
        {t('title')}
      </h1>
    </main>
  );
}
