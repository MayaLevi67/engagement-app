import { describe, it, expect } from 'vitest';
import { taskMoney, sumByPayer, rollup, type PaymentRow } from './rollup';

describe('taskMoney', () => {
  it('sums payments and computes remaining against cost', () => {
    expect(taskMoney(10000, [{ amount: 3000 }, { amount: 2000 }])).toEqual({ cost: 10000, paid: 5000, remaining: 5000 });
  });
  it('remaining is null when cost is unset', () => {
    expect(taskMoney(null, [{ amount: 3000 }])).toEqual({ cost: null, paid: 3000, remaining: null });
  });
  it('remaining can be negative (overpaid)', () => {
    expect(taskMoney(1000, [{ amount: 1500 }])).toEqual({ cost: 1000, paid: 1500, remaining: -500 });
  });
});

describe('sumByPayer', () => {
  it('groups by role, keeping distinct OTHER labels separate', () => {
    const r = sumByPayer([
      { payer: 'BOTH', payerLabel: null, amount: 1000 },
      { payer: 'BOTH', payerLabel: null, amount: 500 },
      { payer: 'OTHER', payerLabel: 'Grandma', amount: 300 },
      { payer: 'OTHER', payerLabel: 'Uncle', amount: 200 },
    ]);
    expect(r).toContainEqual({ payer: 'BOTH', payerLabel: null, amount: 1500 });
    expect(r).toContainEqual({ payer: 'OTHER', payerLabel: 'Grandma', amount: 300 });
    expect(r).toContainEqual({ payer: 'OTHER', payerLabel: 'Uncle', amount: 200 });
  });
});

describe('rollup', () => {
  const rows: PaymentRow[] = [
    { taskId: 't1', title: 'DJ', vendorName: 'DJ Dan', cost: 10000, paid: 3000, remaining: 7000,
      payments: [{ payer: 'BOTH', payerLabel: null, amount: 3000 }] },
    { taskId: 't2', title: 'Cake', vendorName: null, cost: 2000, paid: 2000, remaining: 0,
      payments: [{ payer: 'PARTNER_1', payerLabel: null, amount: 2000 }] },
    { taskId: 't3', title: 'Misc', vendorName: null, cost: null, paid: 500, remaining: null,
      payments: [{ payer: 'BOTH', payerLabel: null, amount: 500 }] },
  ];
  it('totals cost/paid/remaining (remaining only over rows with a cost) and by-payer equals total paid', () => {
    const r = rollup(rows);
    expect(r.totalCost).toBe(12000);
    expect(r.totalPaid).toBe(5500);
    expect(r.totalRemaining).toBe(7000); // 7000 + 0 (t3 has no cost → excluded)
    expect(r.byPayer.reduce((s, p) => s + p.amount, 0)).toBe(r.totalPaid);
  });
});
