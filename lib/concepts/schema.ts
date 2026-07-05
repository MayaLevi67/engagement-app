import { z } from 'zod';
import { TaskCategory, TitleLocale } from '@prisma/client';

export const CATEGORY_OPTIONS = Object.values(TaskCategory);
export const TITLE_LOCALE_OPTIONS = Object.values(TitleLocale);

const hex = z.string().regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'invalid hex');

export const conceptSchema = z.object({
  title_en: z.string().trim().min(1).max(120),
  title_he: z.string().trim().min(1).max(120),
  titleLocale: z.nativeEnum(TitleLocale).default(TitleLocale.AUTO),
  tagline_en: z.string().trim().max(200).nullish(),
  tagline_he: z.string().trim().max(200).nullish(),
  description_en: z.string().trim().max(2000).nullish(),
  description_he: z.string().trim().max(2000).nullish(),
  palette: z.array(hex).max(8).default([]),
  isPremium: z.boolean().default(false),
  active: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

export const conceptElementSchema = z
  .object({
    title_en: z.string().trim().min(1).max(200),
    title_he: z.string().trim().min(1).max(200),
    titleLocale: z.nativeEnum(TitleLocale).default(TitleLocale.AUTO),
    description_en: z.string().trim().max(1000).nullish(),
    description_he: z.string().trim().max(1000).nullish(),
    category: z.nativeEnum(TaskCategory),
    estCostMin: z.number().int().min(0).nullish(),
    estCostMax: z.number().int().min(0).nullish(),
    active: z.boolean().default(true),
    sortOrder: z.number().int().default(0),
  })
  .refine(
    (v) => v.estCostMin == null || v.estCostMax == null || v.estCostMin <= v.estCostMax,
    { message: 'estCostMin must be <= estCostMax', path: ['estCostMax'] },
  );

export const conceptImageSchema = z.object({
  url: z.string().trim().url().max(2000),
  alt_en: z.string().trim().max(200).nullish(),
  alt_he: z.string().trim().max(200).nullish(),
  sortOrder: z.number().int().default(0),
});
