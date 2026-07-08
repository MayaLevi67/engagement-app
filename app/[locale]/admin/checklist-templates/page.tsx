import { setRequestLocale } from 'next-intl/server';
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

  const templates = await getTemplates();

  return <TemplatesAdmin templates={templates.map(serializeTemplate)} />;
}
