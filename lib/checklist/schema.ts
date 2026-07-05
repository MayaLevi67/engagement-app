import { z } from 'zod';
import { TaskCategory, TaskPriority, TitleLocale } from '@prisma/client';

export const CATEGORY_OPTIONS = Object.values(TaskCategory);
export const PRIORITY_OPTIONS = Object.values(TaskPriority);
export const TITLE_LOCALE_OPTIONS = Object.values(TitleLocale);

export const customTaskSchema = z.object({
  title_en: z.string().trim().max(200).optional().default(''),
  title_he: z.string().trim().max(200).optional().default(''),
  category: z.nativeEnum(TaskCategory).default(TaskCategory.OTHER),
  priority: z.nativeEnum(TaskPriority).default(TaskPriority.MEDIUM),
  dueDate: z.coerce.date().nullable().optional(),
}).refine((v) => v.title_en.trim() || v.title_he.trim(), { message: 'title required' });

export const taskEditSchema = z.object({
  title_en: z.string().trim().max(200).optional(),
  title_he: z.string().trim().max(200).optional(),
  titleLocale: z.nativeEnum(TitleLocale).optional(),
  category: z.nativeEnum(TaskCategory).optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
  dueDate: z.coerce.date().nullish(),
  notes: z.string().trim().max(2000).nullish(),
});

export const templateSchema = z.object({
  title_en: z.string().trim().min(1).max(200),
  title_he: z.string().trim().min(1).max(200),
  titleLocale: z.nativeEnum(TitleLocale).default(TitleLocale.AUTO),
  category: z.nativeEnum(TaskCategory),
  priority: z.nativeEnum(TaskPriority).default(TaskPriority.MEDIUM),
  dueOffsetDays: z.number().int().min(0).max(3650).nullish(),
  active: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});
