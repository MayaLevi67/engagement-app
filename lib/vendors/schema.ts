import { z } from 'zod';
import { TaskCategory, TitleLocale, VendorQuoteStatus } from '@prisma/client';

export const VENDOR_STATUS_OPTIONS = Object.values(VendorQuoteStatus);

const money = z.number().int().min(0).max(100_000_000);
const optionalMoney = money.nullish();

const contact = {
  email: z.string().trim().email().max(200).nullish(),
  phone: z.string().trim().max(40).nullish(),
  website: z.string().trim().url().max(300).nullish(),
};

export const vendorSchema = z
  .object({
    name_en: z.string().trim().min(1).max(160),
    name_he: z.string().trim().min(1).max(160),
    titleLocale: z.nativeEnum(TitleLocale).default(TitleLocale.AUTO),
    description_en: z.string().trim().max(2000).nullish(),
    description_he: z.string().trim().max(2000).nullish(),
    category: z.nativeEnum(TaskCategory),
    city: z.string().trim().max(120).nullish(),
    priceMin: optionalMoney,
    priceMax: optionalMoney,
    ...contact,
    verified: z.boolean().default(false),
    isPremium: z.boolean().default(false),
    active: z.boolean().default(true),
    sortOrder: z.number().int().default(0),
  })
  .refine((v) => v.priceMin == null || v.priceMax == null || v.priceMin <= v.priceMax, {
    message: 'priceMin must be <= priceMax', path: ['priceMax'],
  });

/** Couple-added private vendor: a lighter subset (no images/verified/premium/sortOrder). */
export const privateVendorSchema = z
  .object({
    name_en: z.string().trim().min(1).max(160),
    name_he: z.string().trim().min(1).max(160),
    titleLocale: z.nativeEnum(TitleLocale).default(TitleLocale.AUTO),
    category: z.nativeEnum(TaskCategory),
    city: z.string().trim().max(120).nullish(),
    priceMin: optionalMoney,
    priceMax: optionalMoney,
    ...contact,
    notes: z.string().trim().max(2000).nullish(),
  })
  .refine((v) => v.priceMin == null || v.priceMax == null || v.priceMin <= v.priceMax, {
    message: 'priceMin must be <= priceMax', path: ['priceMax'],
  });

export const vendorImageSchema = z.object({
  url: z.string().trim().url().max(2000),
  alt_en: z.string().trim().max(200).nullish(),
  alt_he: z.string().trim().max(200).nullish(),
  sortOrder: z.number().int().default(0),
});

export const quoteInput = z.object({
  status: z.nativeEnum(VendorQuoteStatus),
  amount: optionalMoney,
  notes: z.string().trim().max(2000).nullish(),
});
