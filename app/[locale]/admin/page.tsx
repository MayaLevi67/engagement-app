import { setRequestLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/navigation';

export default async function AdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Admin');
  const tConcepts = await getTranslations('AdminConcepts');
  const tTemplates = await getTranslations('AdminTemplates');
  return (
    <main className="mx-auto w-full max-w-3xl p-8">
      <p className="mb-4 text-text">{t('placeholder')}</p>
      <ul className="flex flex-col gap-2">
        <li>
          <Link href="/admin/checklist-templates" className="text-primary underline">
            {tTemplates('title')}
          </Link>
        </li>
        <li>
          <Link href="/admin/concepts" className="text-primary underline">
            {tConcepts('title')}
          </Link>
        </li>
      </ul>
    </main>
  );
}
