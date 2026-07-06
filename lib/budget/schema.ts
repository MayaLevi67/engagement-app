import { z } from 'zod';
import { TaskCategory } from '@prisma/client';

export const CATEGORY_OPTIONS = Object.values(TaskCategory);

const amount = z.number().int().min(0).max(100_000_000);

export const budgetTotalInput = z.object({ amount: amount.nullable() });
export const avgGiftInput = z.object({ amount: amount.nullable() });
export const taskAmountInput = z.object({ amount: amount.nullable() });
export const categoryAllocationInput = z.object({
  category: z.nativeEnum(TaskCategory),
  amount,
});
export const budgetTemplateInput = z.object({
  defaultPercent: z.number().int().min(0).max(100),
  active: z.boolean(),
  sortOrder: z.number().int(),
});
