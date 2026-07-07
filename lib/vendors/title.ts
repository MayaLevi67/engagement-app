import type { TitleLocale } from '@prisma/client';
import { resolveTaskTitle } from '@/lib/checklist/title';

/** Resolve a vendor's display name for the given locale. */
export function resolveVendorTitle(
  item: { name_en: string; name_he: string; titleLocale: TitleLocale },
  locale: string,
): string {
  return resolveTaskTitle({ title_en: item.name_en, title_he: item.name_he, titleLocale: item.titleLocale }, locale);
}
