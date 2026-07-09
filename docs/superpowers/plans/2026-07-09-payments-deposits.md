# Payments & Deposits — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a premium couple record a total cost + a ledger of payments (amount + who paid) per task/vendor, and see paid / remaining per item and a by-payer roll-up on a new Payments page.

**Architecture:** A `TaskPayment` child table is the source of truth for payment attribution; `Task.amountPaid` becomes a cached total (`= sum(payments)`) kept in sync inside the payment actions, so the tested budget rollup and the remaining calc are untouched. Pure helpers compute money/roll-up + resolve neutral name-based payers. Premium-gated actions (`requirePremiumWedding`) do all writes. A `/payments` page (new side-nav item) shows the overview; recording is inline on the checklist task + vendor detail.

**Tech Stack:** Next.js 16 (App Router, RSC + server actions), Prisma 6.19.3 + Postgres, next-intl (he default/RTL + en), Vitest, Playwright, Tailwind v4 tokens.

## Global Constraints

- **Money is whole-shekel `Int`** (no floats, no agorot), matching the existing model.
- **Premium-gated** — Payments page + every record/edit/delete action require premium via `requirePremiumWedding` (`lib/premium/gate.ts`); free couples get the paywall / `PREMIUM_REQUIRED`. Completing a task stays **free**.
- **Ownership-scoped** — resolve the wedding from the session; every payment write validates the target task (and the payment) belong to the caller's wedding. Never trust a client id.
- **Invariant:** `Task.amountPaid == sum(that task's TaskPayment.amount)` — maintained ONLY by the payment actions (via `recomputeTaskPaid`) + the migration backfill. No other code writes `amountPaid`.
- **Payers are neutral + name-based** — `PayerRole` enum resolved to the couple's real names; `OTHER` carries a free-text label.
- **he + en parity** — identical key sets in `messages/en.json` + `messages/he.json`; RTL-safe logical props (`ps-`/`pe-`/`text-start`); existing design tokens (no new palette). Lint (`--max-warnings 0`) + typecheck stay green.
- Prisma pinned 6.19.3; migrate via `npm run db:migrate`.

## File Structure

**Create:**
- `lib/payments/rollup.ts` (+ `.test.ts`) — pure `taskMoney`, `sumByPayer`, `rollup`.
- `lib/payments/payer.ts` (+ `.test.ts`) — pure `payerDisplayName`, `payerOptions`.
- `lib/actions/payments.ts` (+ `.test.ts`) — `recordTaskPayment` / `editTaskPayment` / `deleteTaskPayment`.
- `app/[locale]/(app)/payments/page.tsx` + `payments-view.tsx` — the Payments page + client view.
- `app/[locale]/(app)/payments/paywall.tsx` — free-couple paywall (Payments copy).
- `app/[locale]/(app)/payment-form.tsx` — shared client record-payment form.
- `e2e/payments.spec.ts`.

**Modify:**
- `prisma/schema.prisma` — `PayerRole`, `TaskPayment`, back-relations.
- `lib/app-nav/sections.ts` — add the `payments` nav entry.
- `lib/actions/checklist.ts` — `setTaskStatus` drops the `amountPaid` param.
- `lib/actions/budget.ts` — remove `setTaskAmountPaid`.
- `lib/actions/vendors.ts` — `pushQuoteToBudget` paid path rewired.
- `app/[locale]/(app)/checklist/task-row.tsx` + `checklist-view.tsx` + `page.tsx` — completion no longer prompts for paid; premium record-payment affordance + paid/remaining summary.
- `app/[locale]/(app)/budget/**` — task paid figure read-only (drop the inline editor).
- `app/[locale]/(app)/vendors/[vendorId]/**` — record-payment affordance + cost/paid/remaining for the linked task.
- `messages/en.json` + `messages/he.json` — `Payments` + `Payer` namespaces, `Nav.payments`.

---

### Task 1: Schema, migration & backfill

**Files:** Modify `prisma/schema.prisma`.

**Interfaces:**
- Produces: enum `PayerRole { PARTNER_1 PARTNER_2 BOTH PARTNER_1_FAMILY PARTNER_2_FAMILY OTHER }`; model `TaskPayment` (`id`, `weddingId`, `taskId`, `amount Int`, `payer PayerRole`, `payerLabel String?`, `paidOn DateTime?`, `note String?`, timestamps); `Wedding.taskPayments`; `Task.payments`.

- [ ] **Step 1: Add the enum + model + relations**

In `prisma/schema.prisma` add:
```prisma
enum PayerRole {
  PARTNER_1
  PARTNER_2
  BOTH
  PARTNER_1_FAMILY
  PARTNER_2_FAMILY
  OTHER
}

model TaskPayment {
  id         String    @id @default(cuid())
  weddingId  String
  wedding    Wedding   @relation(fields: [weddingId], references: [id], onDelete: Cascade)
  taskId     String
  task       Task      @relation(fields: [taskId], references: [id], onDelete: Cascade)
  amount     Int
  payer      PayerRole
  payerLabel String?
  paidOn     DateTime?
  note       String?
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt

  @@index([weddingId])
  @@index([taskId])
}
```
Add back-relations: in `Wedding` add `taskPayments TaskPayment[]`; in `Task` add `payments TaskPayment[]`.

- [ ] **Step 2: Migrate**

Run: `npm run db:migrate -- --name add_task_payments`
Expected: new migration; "in sync". Then `npm run db:generate` if needed, and `npm run typecheck` → PASS (`TaskPayment`, `PayerRole` available).

- [ ] **Step 3: Add the backfill to the migration**

Edit the generated `prisma/migrations/<ts>_add_task_payments/migration.sql`, appending a backfill so existing paid amounts become ledger rows (keeps `amountPaid == sum(payments)`):
```sql
-- Backfill: existing Task.amountPaid becomes one imported payment (payer OTHER).
INSERT INTO "TaskPayment" ("id", "weddingId", "taskId", "amount", "payer", "note", "paidOn", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text, t."weddingId", t."id", t."amountPaid", 'OTHER', 'imported',
  COALESCE(t."completedAt", NOW()), NOW(), NOW()
FROM "Task" t
WHERE t."amountPaid" IS NOT NULL AND t."amountPaid" > 0;
```
Re-apply against a fresh DB to confirm the SQL runs: `npm run db:migrate` (or `prisma migrate reset` in dev if you need a clean apply). Confirm rows appear only for tasks with prior paid amounts.

- [ ] **Step 4: Typecheck; commit**

Run: `npm run typecheck && npm run lint`
```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add TaskPayment ledger + PayerRole, backfill existing amountPaid"
```

---

### Task 2: Pure domain — money roll-up & payer names

**Files:** Create `lib/payments/rollup.ts` (+ `.test.ts`), `lib/payments/payer.ts` (+ `.test.ts`).

**Interfaces:**
- Consumes: `PayerRole` (`@prisma/client`).
- Produces:
  - `taskMoney(estimatedCost: number | null, payments: { amount: number }[]): { cost: number | null; paid: number; remaining: number | null }`
  - `sumByPayer(payments: { payer: PayerRole; payerLabel: string | null; amount: number }[]): { payer: PayerRole; payerLabel: string | null; amount: number }[]`
  - `PaymentRow` type + `rollup(rows: PaymentRow[]): { totalCost: number; totalPaid: number; totalRemaining: number; byPayer: {...}[]; rows: PaymentRow[] }`
  - `payerDisplayName(role, payerLabel, names, labels): string`; `payerOptions(names, labels): { role: PayerRole; label: string }[]`; types `PayerNames`, `PayerLabels`.

- [ ] **Step 1: Write the rollup tests**

`lib/payments/rollup.test.ts`:
```typescript
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
```

- [ ] **Step 2: Run to verify fail, then implement `rollup.ts`**

Run: `npm run test -- lib/payments/rollup.test.ts` → FAIL.

`lib/payments/rollup.ts`:
```typescript
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
```

Run: `npm run test -- lib/payments/rollup.test.ts` → PASS.

- [ ] **Step 3: Write payer tests**

`lib/payments/payer.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { payerDisplayName, payerOptions, type PayerLabels } from './payer';

const labels: PayerLabels = {
  both: 'Both', other: 'Other', partner1: 'Partner 1', partner2: 'Partner 2',
  partner1Family: "Partner 1's family", partner2Family: "Partner 2's family",
  family: (name) => `${name}'s family`,
};

describe('payerDisplayName', () => {
  const names = { partner1Name: 'Maya', partner2Name: 'Asaf' };
  it('resolves partner names', () => {
    expect(payerDisplayName('PARTNER_1', null, names, labels)).toBe('Maya');
    expect(payerDisplayName('PARTNER_2', null, names, labels)).toBe('Asaf');
  });
  it('resolves families via the name template', () => {
    expect(payerDisplayName('PARTNER_1_FAMILY', null, names, labels)).toBe("Maya's family");
  });
  it('falls back when a name is blank', () => {
    expect(payerDisplayName('PARTNER_1', null, { partner1Name: null, partner2Name: null }, labels)).toBe('Partner 1');
    expect(payerDisplayName('PARTNER_1_FAMILY', null, { partner1Name: null, partner2Name: null }, labels)).toBe("Partner 1's family");
  });
  it('BOTH and OTHER', () => {
    expect(payerDisplayName('BOTH', null, names, labels)).toBe('Both');
    expect(payerDisplayName('OTHER', 'Grandma', names, labels)).toBe('Grandma');
    expect(payerDisplayName('OTHER', null, names, labels)).toBe('Other');
  });
});

describe('payerOptions', () => {
  it('returns all six roles with resolved labels', () => {
    const opts = payerOptions({ partner1Name: 'Maya', partner2Name: 'Asaf' }, labels);
    expect(opts.map((o) => o.role)).toEqual(['PARTNER_1', 'PARTNER_2', 'BOTH', 'PARTNER_1_FAMILY', 'PARTNER_2_FAMILY', 'OTHER']);
    expect(opts[0].label).toBe('Maya');
  });
});
```

- [ ] **Step 4: Run to verify fail, then implement `payer.ts`**

Run: `npm run test -- lib/payments/payer.test.ts` → FAIL.

`lib/payments/payer.ts`:
```typescript
import type { PayerRole } from '@prisma/client';

export interface PayerNames {
  partner1Name: string | null;
  partner2Name: string | null;
}
export interface PayerLabels {
  both: string;
  other: string;
  partner1: string;
  partner2: string;
  partner1Family: string;
  partner2Family: string;
  family: (name: string) => string;
}

export function payerDisplayName(
  role: PayerRole,
  payerLabel: string | null,
  names: PayerNames,
  labels: PayerLabels,
): string {
  switch (role) {
    case 'PARTNER_1':
      return names.partner1Name?.trim() || labels.partner1;
    case 'PARTNER_2':
      return names.partner2Name?.trim() || labels.partner2;
    case 'PARTNER_1_FAMILY':
      return names.partner1Name?.trim() ? labels.family(names.partner1Name.trim()) : labels.partner1Family;
    case 'PARTNER_2_FAMILY':
      return names.partner2Name?.trim() ? labels.family(names.partner2Name.trim()) : labels.partner2Family;
    case 'BOTH':
      return labels.both;
    case 'OTHER':
      return payerLabel?.trim() || labels.other;
  }
}

const ROLE_ORDER: PayerRole[] = ['PARTNER_1', 'PARTNER_2', 'BOTH', 'PARTNER_1_FAMILY', 'PARTNER_2_FAMILY', 'OTHER'];

export function payerOptions(names: PayerNames, labels: PayerLabels): { role: PayerRole; label: string }[] {
  return ROLE_ORDER.map((role) => ({ role, label: payerDisplayName(role, null, names, labels) }));
}
```

- [ ] **Step 5: Run; typecheck; lint; commit**

Run: `npm run test -- lib/payments && npm run typecheck && npm run lint` → PASS.
```bash
git add lib/payments/rollup.ts lib/payments/rollup.test.ts lib/payments/payer.ts lib/payments/payer.test.ts
git commit -m "feat: add pure payments roll-up and neutral payer-name resolution"
```

---

### Task 3: Payment server actions (premium-gated)

**Files:** Create `lib/actions/payments.ts` (+ `.test.ts`).

**Interfaces:**
- Consumes: `requirePremiumWedding` (`@/lib/premium/gate`), `prisma`, `PayerRole`, Zod.
- Produces:
  - `PaymentActionResult = { ok: true } | { ok: false; error: 'UNAUTHENTICATED' | 'NOT_FOUND' | 'INVALID' | 'PREMIUM_REQUIRED' }`
  - `recordTaskPayment(taskId: string, input: unknown): Promise<PaymentActionResult>`
  - `editTaskPayment(paymentId: string, input: unknown): Promise<PaymentActionResult>`
  - `deleteTaskPayment(paymentId: string): Promise<PaymentActionResult>`
  - internal `recomputeTaskPaid(tx, taskId)` — sets `Task.amountPaid = sum(payments)`.

- [ ] **Step 1: Write the action tests**

`lib/actions/payments.test.ts` (mirror the mocked-prisma idiom used in `lib/actions/budget.test.ts`). Cover: happy record (creates payment, recomputes amountPaid to the sum, sets cost when provided), free → `PREMIUM_REQUIRED` (no write), task-not-in-wedding → `NOT_FOUND`, amount ≤ 0 → `INVALID`, edit recomputes, delete recomputes, payment-not-in-wedding → `NOT_FOUND`. Use `requirePremiumWedding` mocked to return `{ ok: true, wedding: { id: 'w1', ... } }` for premium and `{ ok: false, error: 'PREMIUM_REQUIRED' }` for free. Mock `prisma.$transaction` to run its callback with a `tx` exposing `task.findFirst`, `taskPayment.{create,update,delete,findFirst,aggregate}`, `task.update`.

- [ ] **Step 2: Run to verify fail, then implement**

`lib/actions/payments.ts`:
```typescript
'use server';

import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requirePremiumWedding } from '@/lib/premium/gate';
import type { PayerRole, Prisma } from '@prisma/client';

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

/** Cached-total invariant: amountPaid = sum(payments). Called inside a tx by every mutation. */
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

  const task = await prisma.task.findFirst({ where: { id: taskId, weddingId: g.wedding.id }, select: { id: true } });
  if (!task) return { ok: false, error: 'NOT_FOUND' };

  await prisma.$transaction(async (tx) => {
    if (cost != null) await tx.task.update({ where: { id: taskId }, data: { estimatedCost: cost } });
    await tx.taskPayment.create({
      data: {
        weddingId: g.wedding.id, taskId,
        amount: pay.amount, payer: pay.payer as PayerRole,
        payerLabel: pay.payer === 'OTHER' ? pay.payerLabel ?? null : null,
        paidOn: pay.paidOn ?? null, note: pay.note ?? null,
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
    where: { id: paymentId, weddingId: g.wedding.id }, select: { id: true, taskId: true },
  });
  if (!existing) return { ok: false, error: 'NOT_FOUND' };
  await prisma.$transaction(async (tx) => {
    await tx.taskPayment.update({
      where: { id: paymentId },
      data: {
        amount: parsed.data.amount, payer: parsed.data.payer as PayerRole,
        payerLabel: parsed.data.payer === 'OTHER' ? parsed.data.payerLabel ?? null : null,
        paidOn: parsed.data.paidOn ?? null, note: parsed.data.note ?? null,
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
    where: { id: paymentId, weddingId: g.wedding.id }, select: { id: true, taskId: true },
  });
  if (!existing) return { ok: false, error: 'NOT_FOUND' };
  await prisma.$transaction(async (tx) => {
    await tx.taskPayment.delete({ where: { id: paymentId } });
    await recomputeTaskPaid(tx, existing.taskId);
  });
  return { ok: true };
}
```

- [ ] **Step 3: Run; typecheck; lint; commit**

Run: `npm run test -- lib/actions/payments.test.ts && npm run typecheck && npm run lint` → PASS.
```bash
git add lib/actions/payments.ts lib/actions/payments.test.ts
git commit -m "feat: add premium-gated task payment actions (record/edit/delete, cached-paid sync)"
```

---

### Task 4: Rewire existing money paths

**Files:** Modify `lib/actions/checklist.ts`, `lib/actions/budget.ts`, `lib/actions/vendors.ts`, and their tests; touch budget/task-row callers only as needed to compile (UI polish lands in Tasks 5–6).

**Interfaces:**
- Consumes: `recordTaskPayment` (`@/lib/actions/payments`), `setTaskEstimatedCost` (existing), `setTaskStatus` (modified).
- Produces: `setTaskStatus(taskId: string, done: boolean): Promise<ActionResult>` (no `amountPaid` param); `setTaskAmountPaid` removed; `pushQuoteToBudget` unchanged signature, new paid behavior.

- [ ] **Step 1: Drop `amountPaid` from `setTaskStatus`**

In `lib/actions/checklist.ts` change `setTaskStatus` to take only `(taskId, done)`. Remove the `amountPaid` param, the `taskAmountInput` paid-parse block, and the `amountPaid` write — completion just sets `status/completedAt`:
```typescript
export async function setTaskStatus(taskId: string, done: boolean): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: 'UNAUTHENTICATED' };
  const task = await loadOwnedTask(userId, taskId);
  if (!task) return { ok: false, error: 'NOT_FOUND' };
  await prisma.task.update({
    where: { id: task.id },
    data: done ? { status: 'DONE', completedAt: new Date() } : { status: 'OPEN', completedAt: null },
  });
  return { ok: true };
}
```
Update `lib/actions/checklist.test.ts`: drop the paid-amount cases for `setTaskStatus` (that behavior moves to `recordTaskPayment`); keep the done/reopen cases.

- [ ] **Step 2: Remove `setTaskAmountPaid` (Budget paid is read-only)**

In `lib/actions/budget.ts` delete the exported `setTaskAmountPaid` and narrow `updateOwnedTaskAmount` to only `'estimatedCost'` (or inline it into `setTaskEstimatedCost`). Keep `setTaskEstimatedCost`. Update `lib/actions/budget.test.ts` to drop `setTaskAmountPaid` cases. (The budget UI editor is removed in Task 5's budget touch.)

- [ ] **Step 3: Rewire `pushQuoteToBudget` paid path**

In `lib/actions/vendors.ts`, the paid path now: mark the task done, set its cost if unset, and record a `BOTH` payment for the quote amount. Replace the paid branch:
```typescript
import { recordTaskPayment } from '@/lib/actions/payments';
// ...
  if (opts.paid) {
    const doneRes = await setTaskStatus(quote.taskId, true);
    if (!doneRes.ok) return { ok: false, error: doneRes.error === 'INVALID' ? 'INVALID' : 'NOT_FOUND' };
    const payRes = await recordTaskPayment(quote.taskId, {
      amount: quote.amount, payer: 'BOTH', cost: quote.amount,
    });
    if (!payRes.ok) return { ok: false, error: payRes.error === 'INVALID' ? 'INVALID' : payRes.error === 'PREMIUM_REQUIRED' ? 'PREMIUM_REQUIRED' : 'NOT_FOUND' };
    return { ok: true };
  }
  const result = await setTaskEstimatedCost(quote.taskId, quote.amount);
  if (!result.ok) return { ok: false, error: result.error === 'INVALID' ? 'INVALID' : 'NOT_FOUND' };
  return { ok: true };
```
(Note: `recordTaskPayment` sets `estimatedCost` via its `cost` field only if you pass it; here we pass `cost: quote.amount` so an unset cost is filled. It always overwrites — acceptable for the push flow since the quote amount is the agreed cost.) Update `lib/actions/vendors.test.ts`: the paid path now asserts a `BOTH` `TaskPayment` is created (mock `recordTaskPayment` or the prisma calls) rather than a scalar `amountPaid` write.

- [ ] **Step 4: Fix compile fallout in callers**

`setTaskStatus` callers currently pass a 3rd arg — update them to 2 args so it compiles (full UI treatment in Task 5): `app/[locale]/(app)/checklist/task-row.tsx` `completeWith` → call `setTaskStatus(task.id, true)`. Grep for other callers: `grep -rn "setTaskStatus(" app lib --include=*.ts --include=*.tsx | grep -v test`.

- [ ] **Step 5: Run affected suites; typecheck; lint; commit**

Run: `npm run test -- lib/actions/checklist.test.ts lib/actions/budget.test.ts lib/actions/vendors.test.ts && npm run typecheck && npm run lint` → PASS.
```bash
git add lib/actions/checklist.ts lib/actions/checklist.test.ts lib/actions/budget.ts lib/actions/budget.test.ts lib/actions/vendors.ts lib/actions/vendors.test.ts "app/[locale]/(app)/checklist/task-row.tsx"
git commit -m "refactor: route task paid through the payment ledger (setTaskStatus, budget, pushQuoteToBudget)"
```

---

### Task 5: i18n + recording UI (checklist task + vendor detail)

**Files:** Create `app/[locale]/(app)/payment-form.tsx`; modify `messages/en.json` + `messages/he.json`, `checklist/task-row.tsx` + `checklist-view.tsx` + `page.tsx`, `budget/**` (drop the inline paid editor), `vendors/[vendorId]/**`; create `app/[locale]/(app)/payments-ui.test.tsx`.

**Interfaces:**
- Consumes: `recordTaskPayment`/`editTaskPayment`/`deleteTaskPayment`; `payerOptions`, `payerDisplayName`, `taskMoney`; `isPremium`.

- [ ] **Step 1: Add `Payer` + `Payments` i18n (both locales, identical keys)**

Add a `Payer` namespace (`partner1`, `partner2`, `both`, `partner1Family`, `partner2Family`, `family` with `{name}`, `other`) and a `Payments` namespace (page title, `Nav.payments`, form labels: `recordCta`, `cost`, `amount`, `payer`, `payerLabelOther`, `date`, `note`, `save`, `cancel`, `paidOfCost` with `{paid}`/`{cost}`, `remaining` with `{amount}`, `overpaid`, column headers, `byPayerTitle`, `totalsCost`/`totalsPaid`/`totalsRemaining`, `paywallTitle`/`paywallBody`, `empty`, `deletePayment`, `editPayment`). Provide natural Hebrew for each. Keep key sets identical.

- [ ] **Step 2: Build the shared `PaymentForm` (client)**

`app/[locale]/(app)/payment-form.tsx` — a client form: cost (number, pre-filled), amount (number, required), payer (`<select>` from `payerOptions(names, labels)` built from `useTranslations('Payer')` + the passed partner names), free-text label when `OTHER`, optional date/note. On submit calls `recordTaskPayment(taskId, {...})` (or `editTaskPayment` when editing), then `router.refresh()`. Props: `{ taskId, partner1Name, partner2Name, initialCost, editing?: { paymentId, ... } }`. Build the `PayerLabels` object from `t('Payer.*')` (with `family: (name) => t('Payer.family', { name })`). Design tokens; RTL logical props; no hard-coded strings.

- [ ] **Step 3: Wire recording into the checklist task row**

In `checklist/page.tsx`: extend `SerializedTask`/loader to include the task's `payments` (serialize `{ id, amount, payer, payerLabel, paidOn, note }`) and pass `premium` + the wedding's partner names to `ChecklistView`. In `task-row.tsx`: remove the "how much did you pay?" popup; completing calls `setTaskStatus(task.id, true)`. For **premium** couples show a paid/remaining summary (`taskMoney`) + a "Record payment" button opening `PaymentForm`, and list existing payments with edit/delete. Free couples: no payment affordance. Update the checklist component tests that referenced the paid popup.

- [ ] **Step 4: Budget paid read-only + vendor detail recording**

Budget: in `app/[locale]/(app)/budget/**`, remove the inline paid editor (drop the `setTaskAmountPaid` call + input); render the paid figure read-only. Vendor detail (`vendors/[vendorId]/**`): when the vendor has a linked task, show cost/paid/remaining (`taskMoney`) and a `PaymentForm` "Record deposit/payment" for premium couples.

- [ ] **Step 5: Component test**

`app/[locale]/(app)/payments-ui.test.tsx` — `NextIntlClientProvider` + `vi.mock('@/lib/actions/payments')`: `PaymentForm` renders the payer options with the couple's names, submits `recordTaskPayment` with the entered values; the task-row summary shows paid/remaining.

- [ ] **Step 6: Full suite; typecheck; lint; commit**

Run: `npm run test && npm run typecheck && npm run lint` → PASS (he/en parity holds).
```bash
git add "app/[locale]/(app)" messages/en.json messages/he.json
git commit -m "feat: payment recording UI (checklist + vendor), payer i18n, budget paid read-only"
```

---

### Task 6: Payments page + side-nav entry

**Files:** Create `app/[locale]/(app)/payments/page.tsx`, `payments-view.tsx`, `paywall.tsx`; modify `lib/app-nav/sections.ts`.

**Interfaces:**
- Consumes: `rollup`, `taskMoney`, `payerDisplayName`; `isPremium`; `getCurrentWedding`.

- [ ] **Step 1: Add the nav entry**

In `lib/app-nav/sections.ts` add after `budget`: `{ key: 'payments', href: '/payments', labelKey: 'Nav.payments' }`. (Active-match logic already covers it.) Update `side-nav.test.ts` to expect the payments link.

- [ ] **Step 2: Payments loader + view**

`payments/page.tsx` (RSC): resolve the wedding; if `!isPremium(wedding)` render `<Paywall/>`. Else load money-relevant tasks — `prisma.task.findMany({ where: { weddingId, deletedAt: null, OR: [{ estimatedCost: { not: null } }, { payments: { some: {} } }] }, include: { payments: true } })` — plus each task's linked vendor name (via `vendorQuote` where `taskId`). Build `PaymentRow[]` with `taskMoney`, pass to `payments-view.tsx`. The view renders: rows (name · vendor · cost · paid · remaining, expandable to payment entries with edit/delete via `PaymentForm`), totals, and the by-payer summary (resolve names with `payerDisplayName` + `Payer` translations). Use `rollup`. Design tokens; RTL; `empty` state when no rows.

- [ ] **Step 3: Paywall**

`payments/paywall.tsx` — mirror the budget paywall: `Payments.paywallTitle` + `paywallBody` + `<UpgradeButton/>`.

- [ ] **Step 4: Full suite; typecheck; lint; commit**

Run: `npm run test && npm run typecheck && npm run lint` → PASS.
```bash
git add "app/[locale]/(app)/payments" lib/app-nav/sections.ts "app/[locale]/(app)/side-nav.test.ts"
git commit -m "feat: add Payments page (per-task cost/paid/remaining + by-payer roll-up) to the side nav"
```

---

### Task 7: E2E + acceptance

**Files:** Create `e2e/payments.spec.ts`.

- [ ] **Step 1: Write the spec**

`e2e/payments.spec.ts` — copy the register/onboard helpers + the `prisma`-promote-to-premium idiom (`import 'dotenv/config'`, `import { prisma } from '../lib/db'`, `test.afterAll` disconnect), prefix `e2e-payments-`. Flows:
- **Premium couple:** register+onboard → promote to premium → open a checklist task → record a payment with cost ₪10,000 + amount ₪3,000 + payer "Both" → assert the task shows paid ₪3,000 / remaining ₪7,000 → open `/payments` → assert a row with cost 10,000 / paid 3,000 / remaining 7,000 and a "Both" by-payer total of 3,000.
- **Free couple:** register+onboard → `/payments` shows the paywall; the checklist task has no record-payment affordance.

- [ ] **Step 2: Run e2e (warm server)**

Run: `npm run test:e2e -- payments.spec.ts`
Expected: PASS. (Reminder: e2e needs a **warm** server — a cold `next dev` compiles routes lazily and blows the short per-test timeouts; if flaky, warm the routes with one throwaway run first, then re-run.)

- [ ] **Step 3: Acceptance sweep; commit**

Run: `npm run lint && npm run typecheck && npm run test && npm run test:e2e`. Walk the spec's 9 acceptance criteria; confirm each maps to a passing test.
```bash
git add e2e/payments.spec.ts
git commit -m "test: add payments e2e (premium records deposit → paid/remaining + by-payer; free paywalled)"
```

---

### Final: Whole-branch review

- [ ] **Step 1: Full gate** — `npm run lint && npm run typecheck && npm run test && npm run test:e2e` (warm server) → all green; record counts.
- [ ] **Step 2: Adversarial whole-branch review** (most-capable model). Focus:
  - **Invariant:** `Task.amountPaid == sum(payments)` holds after record/edit/delete and after the migration backfill; nothing else writes `amountPaid`; the budget rollup is unchanged and still correct.
  - **Premium enforcement:** Payments page + all three actions reject free couples (`PREMIUM_REQUIRED` / paywall); completing a task stays free; a forged request can't record a payment.
  - **Ownership:** every payment write validates the task/payment belongs to the caller's wedding (no cross-wedding writes).
  - **Correctness:** remaining = cost − paid (blank when no cost; negative when overpaid); by-payer grand total equals total paid; `pushQuoteToBudget` paid path marks done + sets cost + records a BOTH payment.
  - **i18n he/en parity; RTL; neutral name-based payers resolve correctly (incl. blank-name fallback); no hard-coded strings; whole-shekel Int.**
- [ ] **Step 3: Address Critical/Important findings (commit each); update `docs/superpowers/IMPLEMENTATION-LOG.md`** with the feature summary, verification counts, decisions (cached amountPaid, budget paid read-only, vendor-push default BOTH), and the deferred items (due dates/reminders).
- [ ] **Step 4: Push / PR** — only on the user's explicit go-ahead.
