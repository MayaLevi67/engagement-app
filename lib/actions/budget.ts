'use server';

import type { TaskCategory } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requirePremiumWedding } from '@/lib/premium/gate';
import {
  budgetTotalInput, avgGiftInput, categoryAllocationInput, taskAmountInput,
} from '@/lib/budget/schema';

export type BudgetActionResult =
  | { ok: true }
  | { ok: false; error: 'UNAUTHENTICATED' | 'INVALID' | 'NOT_FOUND' | 'PREMIUM_REQUIRED' };

export async function setBudgetTotal(amount: number | null): Promise<BudgetActionResult> {
  const g = await requirePremiumWedding();
  if (!g.ok) return g;
  const parsed = budgetTotalInput.safeParse({ amount });
  if (!parsed.success) return { ok: false, error: 'INVALID' };
  await prisma.wedding.update({ where: { id: g.wedding.id }, data: { budgetTotal: parsed.data.amount } });
  return { ok: true };
}

export async function setAvgGiftPerGuest(amount: number | null): Promise<BudgetActionResult> {
  const g = await requirePremiumWedding();
  if (!g.ok) return g;
  const parsed = avgGiftInput.safeParse({ amount });
  if (!parsed.success) return { ok: false, error: 'INVALID' };
  await prisma.wedding.update({ where: { id: g.wedding.id }, data: { avgGiftPerGuest: parsed.data.amount } });
  return { ok: true };
}

export async function setCategoryAllocation(category: TaskCategory, amount: number): Promise<BudgetActionResult> {
  const g = await requirePremiumWedding();
  if (!g.ok) return g;
  const parsed = categoryAllocationInput.safeParse({ category, amount });
  if (!parsed.success) return { ok: false, error: 'INVALID' };
  await prisma.budgetAllocation.upsert({
    where: { weddingId_category: { weddingId: g.wedding.id, category: parsed.data.category } },
    create: { weddingId: g.wedding.id, category: parsed.data.category, amount: parsed.data.amount },
    update: { amount: parsed.data.amount },
  });
  return { ok: true };
}

export async function clearCategoryAllocation(category: TaskCategory): Promise<BudgetActionResult> {
  const g = await requirePremiumWedding();
  if (!g.ok) return g;
  await prisma.budgetAllocation.deleteMany({ where: { weddingId: g.wedding.id, category } });
  return { ok: true };
}

export async function setTaskEstimatedCost(taskId: string, amount: number | null): Promise<BudgetActionResult> {
  const g = await requirePremiumWedding();
  if (!g.ok) return g;
  const parsed = taskAmountInput.safeParse({ amount });
  if (!parsed.success) return { ok: false, error: 'INVALID' };
  const task = await prisma.task.findFirst({ where: { id: taskId, weddingId: g.wedding.id }, select: { id: true } });
  if (!task) return { ok: false, error: 'NOT_FOUND' };
  await prisma.task.update({ where: { id: task.id }, data: { estimatedCost: parsed.data.amount } });
  return { ok: true };
}
