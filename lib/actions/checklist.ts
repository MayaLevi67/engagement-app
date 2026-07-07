'use server';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getCurrentWedding } from '@/lib/wedding/queries';
import { taskEditSchema, customTaskSchema } from '@/lib/checklist/schema';
import { taskAmountInput } from '@/lib/budget/schema';
import type { Task } from '@prisma/client';

export type ActionResult =
  | { ok: true }
  | { ok: false; error: 'UNAUTHENTICATED' | 'INVALID' | 'NOT_FOUND' };

async function requireUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

/** True only for the object's own `key` — never inherited/prototype-polluted. */
function hasOwnKey(input: unknown, key: string): boolean {
  return typeof input === 'object' && input !== null && Object.hasOwn(input, key);
}

/**
 * Load a task and confirm it belongs to the caller's wedding.
 * Resolves the wedding from the DB (never a client/JWT id) so a caller can
 * only ever reach their own tasks. Returns null for "not yours / not found"
 * without leaking which case it was.
 */
async function loadOwnedTask(userId: string, taskId: string): Promise<Task | null> {
  const wedding = await getCurrentWedding(userId);
  if (!wedding) return null;
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task || task.weddingId !== wedding.id) return null;
  return task;
}

export async function setTaskStatus(
  taskId: string,
  done: boolean,
  amountPaid?: number | null,
): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: 'UNAUTHENTICATED' };
  const task = await loadOwnedTask(userId, taskId);
  if (!task) return { ok: false, error: 'NOT_FOUND' };
  // A paid amount is only meaningful when completing; ignore it when re-opening.
  let paid: number | undefined;
  if (done && amountPaid !== undefined && amountPaid !== null) {
    const parsed = taskAmountInput.safeParse({ amount: amountPaid });
    if (!parsed.success) return { ok: false, error: 'INVALID' };
    paid = parsed.data.amount ?? undefined;
  }
  await prisma.task.update({
    where: { id: task.id },
    data: done
      ? { status: 'DONE', completedAt: new Date(), ...(paid !== undefined ? { amountPaid: paid } : {}) }
      : { status: 'OPEN', completedAt: null },
  });
  return { ok: true };
}

export async function editTask(taskId: string, input: unknown): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: 'UNAUTHENTICATED' };
  const task = await loadOwnedTask(userId, taskId);
  if (!task) return { ok: false, error: 'NOT_FOUND' };
  const parsed = taskEditSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'INVALID' };
  await prisma.task.update({
    where: { id: task.id },
    // An explicit dueDate (even null, to clear it) means the user has taken
    // manual control, so pin it against future auto-recompute.
    data: { ...parsed.data, ...(hasOwnKey(input, 'dueDate') ? { dueDateOverridden: true } : {}) },
  });
  return { ok: true };
}

export async function softDeleteTask(taskId: string): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: 'UNAUTHENTICATED' };
  const task = await loadOwnedTask(userId, taskId);
  if (!task) return { ok: false, error: 'NOT_FOUND' };
  await prisma.task.update({ where: { id: task.id }, data: { deletedAt: new Date() } });
  return { ok: true };
}

export async function restoreTask(taskId: string): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: 'UNAUTHENTICATED' };
  const task = await loadOwnedTask(userId, taskId);
  if (!task) return { ok: false, error: 'NOT_FOUND' };
  await prisma.task.update({ where: { id: task.id }, data: { deletedAt: null } });
  return { ok: true };
}

export async function permanentlyDeleteTask(taskId: string): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: 'UNAUTHENTICATED' };
  const task = await loadOwnedTask(userId, taskId);
  if (!task) return { ok: false, error: 'NOT_FOUND' };
  await prisma.task.delete({ where: { id: task.id } });
  return { ok: true };
}

export async function addCustomTask(input: unknown): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: 'UNAUTHENTICATED' };
  const wedding = await getCurrentWedding(userId);
  if (!wedding) return { ok: false, error: 'NOT_FOUND' };
  const parsed = customTaskSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'INVALID' };
  const { title_en, title_he, category, priority, dueDate } = parsed.data;
  const agg = await prisma.task.aggregate({
    where: { weddingId: wedding.id },
    _max: { sortOrder: true },
  });
  const sortOrder = (agg._max.sortOrder ?? -1) + 1;
  await prisma.task.create({
    data: {
      weddingId: wedding.id,
      title_en,
      title_he,
      category,
      priority,
      dueDate: dueDate ?? null,
      dueDateOverridden: hasOwnKey(input, 'dueDate'),
      isCustom: true,
      sourceTemplateId: null,
      sortOrder,
    },
  });
  return { ok: true };
}

export async function setTaskReminder(
  taskId: string,
  enabled: boolean,
  remindAt?: Date | null,
): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: 'UNAUTHENTICATED' };
  const task = await loadOwnedTask(userId, taskId);
  if (!task) return { ok: false, error: 'NOT_FOUND' };
  await prisma.task.update({
    where: { id: task.id },
    data: { reminderEnabled: enabled, remindAt: enabled ? (remindAt ?? null) : null },
  });
  return { ok: true };
}
