'use server';

import { z } from 'zod';
import type { PayerRole, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requirePremiumWedding } from '@/lib/premium/gate';

export type PaymentActionResult =
  | { ok: true }
  | { ok: false; error: 'UNAUTHENTICATED' | 'NOT_FOUND' | 'INVALID' | 'PREMIUM_REQUIRED' };

const paymentInput = z.object({
  amount: z.number().int().positive(),
  payer: z.enum(['PARTNER_1', 'PARTNER_2', 'BOTH', 'PARTNER_1_FAMILY', 'PARTNER_2_FAMILY', 'OTHER']),
  payerLabel: z.string().trim().max(100).nullish(),
  paidOn: z.coerce.date().nullish(),
  note: z.string().trim().max(500).nullish(),
  cost: z.number().int().min(0).nullish(),
});

/** Cached-total invariant: Task.amountPaid = sum(TaskPayment.amount). Called inside a tx by every mutation. */
async function recomputeTaskPaid(tx: Prisma.TransactionClient, taskId: string): Promise<void> {
  const agg = await tx.taskPayment.aggregate({ where: { taskId }, _sum: { amount: true } });
  await tx.task.update({ where: { id: taskId }, data: { amountPaid: agg._sum.amount ?? 0 } });
}

export async function recordTaskPayment(taskId: string, input: unknown): Promise<PaymentActionResult> {
  const g = await requirePremiumWedding();
  if (!g.ok) return g;
  const parsed = paymentInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'INVALID' };
  const { cost, ...pay } = parsed.data;

  const task = await prisma.task.findFirst({
    where: { id: taskId, weddingId: g.wedding.id },
    select: { id: true },
  });
  if (!task) return { ok: false, error: 'NOT_FOUND' };

  await prisma.$transaction(async (tx) => {
    if (cost != null) {
      await tx.task.update({ where: { id: taskId }, data: { estimatedCost: cost } });
    }
    await tx.taskPayment.create({
      data: {
        weddingId: g.wedding.id,
        taskId,
        amount: pay.amount,
        payer: pay.payer as PayerRole,
        payerLabel: pay.payer === 'OTHER' ? pay.payerLabel ?? null : null,
        paidOn: pay.paidOn ?? null,
        note: pay.note ?? null,
      },
    });
    await recomputeTaskPaid(tx, taskId);
  });
  return { ok: true };
}

export async function editTaskPayment(paymentId: string, input: unknown): Promise<PaymentActionResult> {
  const g = await requirePremiumWedding();
  if (!g.ok) return g;
  const parsed = paymentInput.omit({ cost: true }).safeParse(input);
  if (!parsed.success) return { ok: false, error: 'INVALID' };

  const existing = await prisma.taskPayment.findFirst({
    where: { id: paymentId, weddingId: g.wedding.id },
    select: { id: true, taskId: true },
  });
  if (!existing) return { ok: false, error: 'NOT_FOUND' };

  await prisma.$transaction(async (tx) => {
    await tx.taskPayment.update({
      where: { id: paymentId },
      data: {
        amount: parsed.data.amount,
        payer: parsed.data.payer as PayerRole,
        payerLabel: parsed.data.payer === 'OTHER' ? parsed.data.payerLabel ?? null : null,
        paidOn: parsed.data.paidOn ?? null,
        note: parsed.data.note ?? null,
      },
    });
    await recomputeTaskPaid(tx, existing.taskId);
  });
  return { ok: true };
}

export async function deleteTaskPayment(paymentId: string): Promise<PaymentActionResult> {
  const g = await requirePremiumWedding();
  if (!g.ok) return g;

  const existing = await prisma.taskPayment.findFirst({
    where: { id: paymentId, weddingId: g.wedding.id },
    select: { id: true, taskId: true },
  });
  if (!existing) return { ok: false, error: 'NOT_FOUND' };

  await prisma.$transaction(async (tx) => {
    await tx.taskPayment.delete({ where: { id: paymentId } });
    await recomputeTaskPaid(tx, existing.taskId);
  });
  return { ok: true };
}
