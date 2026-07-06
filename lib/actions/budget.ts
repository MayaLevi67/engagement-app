'use server';

import type { TaskCategory } from '@prisma/client';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getCurrentWedding } from '@/lib/wedding/queries';
import {
  budgetTotalInput, avgGiftInput, categoryAllocationInput, taskAmountInput,
} from '@/lib/budget/schema';

export type BudgetActionResult =
  | { ok: true }
  | { ok: false; error: 'UNAUTHENTICATED' | 'INVALID' | 'NOT_FOUND' };

async function requireWeddingId(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const wedding = await getCurrentWedding(session.user.id);
  return wedding?.id ?? null;
}

export async function setBudgetTotal(amount: number | null): Promise<BudgetActionResult> {
  const weddingId = await requireWeddingId();
  if (weddingId === null) {
    const session = await auth();
    return { ok: false, error: session?.user?.id ? 'NOT_FOUND' : 'UNAUTHENTICATED' };
  }
  const parsed = budgetTotalInput.safeParse({ amount });
  if (!parsed.success) return { ok: false, error: 'INVALID' };
  await prisma.wedding.update({ where: { id: weddingId }, data: { budgetTotal: parsed.data.amount } });
  return { ok: true };
}

export async function setAvgGiftPerGuest(amount: number | null): Promise<BudgetActionResult> {
  const weddingId = await requireWeddingId();
  if (weddingId === null) {
    const session = await auth();
    return { ok: false, error: session?.user?.id ? 'NOT_FOUND' : 'UNAUTHENTICATED' };
  }
  const parsed = avgGiftInput.safeParse({ amount });
  if (!parsed.success) return { ok: false, error: 'INVALID' };
  await prisma.wedding.update({ where: { id: weddingId }, data: { avgGiftPerGuest: parsed.data.amount } });
  return { ok: true };
}

export async function setCategoryAllocation(category: TaskCategory, amount: number): Promise<BudgetActionResult> {
  const weddingId = await requireWeddingId();
  if (weddingId === null) {
    const session = await auth();
    return { ok: false, error: session?.user?.id ? 'NOT_FOUND' : 'UNAUTHENTICATED' };
  }
  const parsed = categoryAllocationInput.safeParse({ category, amount });
  if (!parsed.success) return { ok: false, error: 'INVALID' };
  await prisma.budgetAllocation.upsert({
    where: { weddingId_category: { weddingId, category: parsed.data.category } },
    create: { weddingId, category: parsed.data.category, amount: parsed.data.amount },
    update: { amount: parsed.data.amount },
  });
  return { ok: true };
}

export async function clearCategoryAllocation(category: TaskCategory): Promise<BudgetActionResult> {
  const weddingId = await requireWeddingId();
  if (weddingId === null) {
    const session = await auth();
    return { ok: false, error: session?.user?.id ? 'NOT_FOUND' : 'UNAUTHENTICATED' };
  }
  await prisma.budgetAllocation.deleteMany({ where: { weddingId, category } });
  return { ok: true };
}

async function updateOwnedTaskAmount(
  taskId: string,
  field: 'amountPaid' | 'estimatedCost',
  amount: number | null,
): Promise<BudgetActionResult> {
  const weddingId = await requireWeddingId();
  if (weddingId === null) {
    const session = await auth();
    return { ok: false, error: session?.user?.id ? 'NOT_FOUND' : 'UNAUTHENTICATED' };
  }
  const parsed = taskAmountInput.safeParse({ amount });
  if (!parsed.success) return { ok: false, error: 'INVALID' };
  const task = await prisma.task.findFirst({ where: { id: taskId, weddingId }, select: { id: true } });
  if (!task) return { ok: false, error: 'NOT_FOUND' };
  await prisma.task.update({ where: { id: task.id }, data: { [field]: parsed.data.amount } });
  return { ok: true };
}

export function setTaskAmountPaid(taskId: string, amount: number | null): Promise<BudgetActionResult> {
  return updateOwnedTaskAmount(taskId, 'amountPaid', amount);
}

export function setTaskEstimatedCost(taskId: string, amount: number | null): Promise<BudgetActionResult> {
  return updateOwnedTaskAmount(taskId, 'estimatedCost', amount);
}
