import type { TitleLocale } from '@prisma/client';

export function resolveTaskTitle(
  item: { title_en: string; title_he: string; titleLocale: TitleLocale },
  locale: string,
): string {
  const pickHe = item.titleLocale === 'HE' || (item.titleLocale === 'AUTO' && locale === 'he');
  const primary = pickHe ? item.title_he : item.title_en;
  const secondary = pickHe ? item.title_en : item.title_he;
  return primary?.trim() ? primary : secondary;
}
