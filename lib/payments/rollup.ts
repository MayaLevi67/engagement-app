import type { PayerRole } from '@prisma/client';

export function taskMoney(
  estimatedCost: number | null,
  payments: { amount: number }[],
): { cost: number | null; paid: number; remaining: number | null } {
  const paid = payments.reduce((s, p) => s + p.amount, 0);
  return { cost: estimatedCost, paid, remaining: estimatedCost != null ? estimatedCost - paid : null };
}

export function sumByPayer(
  payments: { payer: PayerRole; payerLabel: string | null; amount: number }[],
): { payer: PayerRole; payerLabel: string | null; amount: number }[] {
  const map = new Map<string, { payer: PayerRole; payerLabel: string | null; amount: number }>();
  for (const p of payments) {
    const key = `${p.payer}::${p.payerLabel ?? ''}`;
    const existing = map.get(key);
    if (existing) existing.amount += p.amount;
    else map.set(key, { payer: p.payer, payerLabel: p.payerLabel, amount: p.amount });
  }
  return [...map.values()];
}

export interface PaymentRow {
  taskId: string;
  title: string;
  vendorName: string | null;
  cost: number | null;
  paid: number;
  remaining: number | null;
  payments: { payer: PayerRole; payerLabel: string | null; amount: number }[];
}

export function rollup(rows: PaymentRow[]): {
  totalCost: number;
  totalPaid: number;
  totalRemaining: number;
  byPayer: { payer: PayerRole; payerLabel: string | null; amount: number }[];
  rows: PaymentRow[];
} {
  const totalCost = rows.reduce((s, r) => s + (r.cost ?? 0), 0);
  const totalPaid = rows.reduce((s, r) => s + r.paid, 0);
  // Only rows with a known cost contribute to remaining (no-cost rows → 0).
  const totalRemaining = rows.reduce((s, r) => s + (r.cost != null ? (r.remaining ?? 0) : 0), 0);
  const byPayer = sumByPayer(rows.flatMap((r) => r.payments));
  return { totalCost, totalPaid, totalRemaining, byPayer, rows };
}
