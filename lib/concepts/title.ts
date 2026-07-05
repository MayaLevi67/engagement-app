import type { TitleLocale } from '@prisma/client';
import { resolveTaskTitle } from '@/lib/checklist/title';

/** Resolve a concept/element's display title for the given locale. */
export function resolveConceptTitle(
  item: { title_en: string; title_he: string; titleLocale: TitleLocale },
  locale: string,
): string {
  return resolveTaskTitle(item, locale);
}
