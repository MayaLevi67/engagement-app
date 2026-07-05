import { setRequestLocale } from 'next-intl/server';
import { auth } from '@/lib/auth';
import { redirect } from '@/lib/i18n/navigation';
import { getTemplates } from '@/lib/checklist/queries';
import { TemplatesAdmin, type SerializedTemplate } from './templates-admin';
import type { ChecklistTemplate } from '@prisma/client';

function serializeTemplate(template: ChecklistTemplate): SerializedTemplate {
  return {
    id: template.id,
    title_en: template.title_en,
    title_he: template.title_he,
    titleLocale: template.titleLocale,
    category: template.category,
    priority: template.priority,
    dueOffsetDays: template.dueOffsetDays,
    active: template.active,
    sortOrder: template.sortOrder,
  };
}

export default async function ChecklistTemplatesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  // The proxy already gates `/admin` for non-admins; this is defense-in-depth
  // in case the page is ever reached through another path.
  if (session?.user?.role !== 'ADMIN') {
    redirect({ href: '/dashboard', locale });
  }

  const templates = await getTemplates();

  return (
    <main className="mx-auto w-full max-w-5xl p-6 sm:p-8">
      <TemplatesAdmin templates={templates.map(serializeTemplate)} />
    </main>
  );
}
