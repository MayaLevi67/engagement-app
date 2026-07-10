import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

vi.mock('@/lib/premium/gate', () => ({ requirePremiumWedding: vi.fn() }));
vi.mock('@/lib/db', () => ({
  prisma: {
    task: { findFirst: vi.fn() },
    taskPayment: { findFirst: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { prisma } from '@/lib/db';
import { requirePremiumWedding } from '@/lib/premium/gate';
import { recordTaskPayment, editTaskPayment, deleteTaskPayment } from './payments';

// The tx handed to the $transaction callback: its own spies so we can assert the
// create/update/delete + recompute all happen inside the SAME transaction.
const tx = {
  task: { update: vi.fn() },
  taskPayment: {
    create: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
    aggregate: vi.fn(),
  },
};

const gate = requirePremiumWedding as unknown as Mock;

beforeEach(() => {
  vi.clearAllMocks();
  gate.mockResolvedValue({ ok: true, wedding: { id: 'w1' } });
  (prisma.$transaction as unknown as Mock).mockImplementation(
    async (cb: (t: typeof tx) => unknown) => cb(tx),
  );
  // default: no payments yet
  tx.taskPayment.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
});

const validPay = { amount: 25000, payer: 'PARTNER_1' as const };

describe('recordTaskPayment', () => {
  it('creates the payment and recomputes amountPaid to the SUM of payments', async () => {
    (prisma.task.findFirst as unknown as Mock).mockResolvedValue({ id: 't1' });
    // sum AFTER the new payment is written
    tx.taskPayment.aggregate.mockResolvedValue({ _sum: { amount: 25000 } });

    expect(await recordTaskPayment('t1', validPay)).toEqual({ ok: true });

    expect(tx.taskPayment.create).toHaveBeenCalledWith({
      data: {
        weddingId: 'w1',
        taskId: 't1',
        amount: 25000,
        payer: 'PARTNER_1',
        payerLabel: null,
        paidOn: null,
        note: null,
      },
    });
    // invariant: amountPaid := sum(payments)
    expect(tx.taskPayment.aggregate).toHaveBeenCalledWith({ where: { taskId: 't1' }, _sum: { amount: true } });
    expect(tx.task.update).toHaveBeenCalledWith({ where: { id: 't1' }, data: { amountPaid: 25000 } });
  });

  it('sets estimatedCost on the task only when cost is provided', async () => {
    (prisma.task.findFirst as unknown as Mock).mockResolvedValue({ id: 't1' });
    tx.taskPayment.aggregate.mockResolvedValue({ _sum: { amount: 25000 } });

    expect(await recordTaskPayment('t1', { ...validPay, cost: 90000 })).toEqual({ ok: true });

    expect(tx.task.update).toHaveBeenCalledWith({ where: { id: 't1' }, data: { estimatedCost: 90000 } });
    expect(tx.task.update).toHaveBeenCalledWith({ where: { id: 't1' }, data: { amountPaid: 25000 } });
  });

  it('does NOT touch estimatedCost when cost is omitted', async () => {
    (prisma.task.findFirst as unknown as Mock).mockResolvedValue({ id: 't1' });
    await recordTaskPayment('t1', validPay);
    // the only task.update is the amountPaid recompute
    expect(tx.task.update).toHaveBeenCalledTimes(1);
    expect(tx.task.update).toHaveBeenCalledWith({ where: { id: 't1' }, data: { amountPaid: 0 } });
  });

  it('persists payerLabel only when payer is OTHER', async () => {
    (prisma.task.findFirst as unknown as Mock).mockResolvedValue({ id: 't1' });

    await recordTaskPayment('t1', { amount: 100, payer: 'OTHER', payerLabel: 'Grandma' });
    expect(tx.taskPayment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ payer: 'OTHER', payerLabel: 'Grandma' }) }),
    );

    tx.taskPayment.create.mockClear();
    // a label sent with a non-OTHER payer must be dropped to null
    await recordTaskPayment('t1', { amount: 100, payer: 'BOTH', payerLabel: 'Grandma' });
    expect(tx.taskPayment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ payer: 'BOTH', payerLabel: null }) }),
    );
  });

  it('returns PREMIUM_REQUIRED and performs NO write for a free wedding', async () => {
    gate.mockResolvedValue({ ok: false, error: 'PREMIUM_REQUIRED' });

    expect(await recordTaskPayment('t1', validPay)).toEqual({ ok: false, error: 'PREMIUM_REQUIRED' });
    expect(prisma.task.findFirst).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('returns NOT_FOUND when the task is not in the caller wedding (no write)', async () => {
    (prisma.task.findFirst as unknown as Mock).mockResolvedValue(null);

    expect(await recordTaskPayment('tX', validPay)).toEqual({ ok: false, error: 'NOT_FOUND' });
    expect(prisma.task.findFirst).toHaveBeenCalledWith({
      where: { id: 'tX', weddingId: 'w1' },
      select: { id: true },
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('returns INVALID for amount <= 0 (no ownership lookup, no write)', async () => {
    expect(await recordTaskPayment('t1', { amount: 0, payer: 'PARTNER_1' })).toEqual({ ok: false, error: 'INVALID' });
    expect(await recordTaskPayment('t1', { amount: -5, payer: 'PARTNER_1' })).toEqual({ ok: false, error: 'INVALID' });
    expect(prisma.task.findFirst).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('returns INVALID for a non-integer amount and an unknown payer', async () => {
    expect(await recordTaskPayment('t1', { amount: 12.5, payer: 'PARTNER_1' })).toEqual({ ok: false, error: 'INVALID' });
    expect(await recordTaskPayment('t1', { amount: 100, payer: 'NOPE' })).toEqual({ ok: false, error: 'INVALID' });
  });
});

describe('editTaskPayment', () => {
  it('updates the payment and recomputes amountPaid to the new SUM', async () => {
    (prisma.taskPayment.findFirst as unknown as Mock).mockResolvedValue({ id: 'p1', taskId: 't1' });
    tx.taskPayment.aggregate.mockResolvedValue({ _sum: { amount: 5000 } });

    expect(await editTaskPayment('p1', { amount: 5000, payer: 'PARTNER_2' })).toEqual({ ok: true });

    expect(tx.taskPayment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'p1', weddingId: 'w1' },
        data: expect.objectContaining({ amount: 5000, payer: 'PARTNER_2' }),
      }),
    );
    expect(tx.task.update).toHaveBeenCalledWith({ where: { id: 't1' }, data: { amountPaid: 5000 } });
  });

  it('returns NOT_FOUND when the payment is not in the caller wedding (no write)', async () => {
    (prisma.taskPayment.findFirst as unknown as Mock).mockResolvedValue(null);

    expect(await editTaskPayment('pX', { amount: 5000, payer: 'PARTNER_2' })).toEqual({ ok: false, error: 'NOT_FOUND' });
    expect(prisma.taskPayment.findFirst).toHaveBeenCalledWith({
      where: { id: 'pX', weddingId: 'w1' },
      select: { id: true, taskId: true },
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('returns PREMIUM_REQUIRED and performs NO write for a free wedding', async () => {
    gate.mockResolvedValue({ ok: false, error: 'PREMIUM_REQUIRED' });
    expect(await editTaskPayment('p1', { amount: 5000, payer: 'PARTNER_2' })).toEqual({ ok: false, error: 'PREMIUM_REQUIRED' });
    expect(prisma.taskPayment.findFirst).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('returns INVALID for amount <= 0 (no write)', async () => {
    expect(await editTaskPayment('p1', { amount: 0, payer: 'PARTNER_2' })).toEqual({ ok: false, error: 'INVALID' });
    expect(prisma.taskPayment.findFirst).not.toHaveBeenCalled();
  });
});

describe('deleteTaskPayment', () => {
  it('deletes the payment and recomputes amountPaid (to 0 when no payments remain)', async () => {
    (prisma.taskPayment.findFirst as unknown as Mock).mockResolvedValue({ id: 'p1', taskId: 't1' });
    // no payments left → aggregate _sum.amount is null → amountPaid must fall back to 0
    tx.taskPayment.aggregate.mockResolvedValue({ _sum: { amount: null } });

    expect(await deleteTaskPayment('p1')).toEqual({ ok: true });

    expect(tx.taskPayment.deleteMany).toHaveBeenCalledWith({ where: { id: 'p1', weddingId: 'w1' } });
    expect(tx.task.update).toHaveBeenCalledWith({ where: { id: 't1' }, data: { amountPaid: 0 } });
  });

  it('returns NOT_FOUND when the payment is not in the caller wedding (no write)', async () => {
    (prisma.taskPayment.findFirst as unknown as Mock).mockResolvedValue(null);

    expect(await deleteTaskPayment('pX')).toEqual({ ok: false, error: 'NOT_FOUND' });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('returns PREMIUM_REQUIRED and performs NO write for a free wedding', async () => {
    gate.mockResolvedValue({ ok: false, error: 'PREMIUM_REQUIRED' });
    expect(await deleteTaskPayment('p1')).toEqual({ ok: false, error: 'PREMIUM_REQUIRED' });
    expect(prisma.taskPayment.findFirst).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
