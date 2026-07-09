# Payments & Deposits Tracking — Design

**Status:** Approved (brainstorming) — ready for implementation plan.
**Date:** 2026-07-09
**Phase:** post-Phase-9 feature (builds on the premium entitlement + the side nav).

## Goal

Let a couple track the real money behind their vendors/tasks: for each task record the **total cost** (contract amount) and a **ledger of payments** — each payment carrying an amount and **who paid** (from a neutral, name-based set of payers). The app derives **paid so far** and **remaining balance** per task/vendor, and a **by-payer roll-up** across the whole wedding, all on a dedicated **Payments** page. Example: DJ contract ₪10,000, a ₪3,000 deposit paid by "Both" → the app shows ₪7,000 remaining and adds ₪3,000 to the "Both" total.

Premium feature (gated exactly like Budget).

## Non-Goals (explicitly deferred)

- **Due dates, installment schedules, and reminders** — a future phase (the couple confirmed). Design leaves room (`paidOn` exists; no scheduled/expected-payment concept is added).
- **Configurable payer list** — payers are a fixed neutral set (+ free-text `OTHER`); not couple-editable.
- **Multi-currency** — whole-shekel ILS `Int`, consistent with the existing money model.
- **Splitting a single payment across payers in one entry** — a split is expressed as *multiple* payment entries (e.g. two ₪1,500 rows), not one row with fractions.

## Global Constraints

- **Money is whole-shekel `Int`** (agorot not tracked), matching Phase 5/6/9. No floats.
- **Premium-gated** — the Payments page, and all record/edit/delete payment actions, require premium via the existing `requirePremiumWedding` (`lib/premium/gate.ts`); free couples get the paywall/`PREMIUM_REQUIRED`, same as Budget.
- **he + en parity** — new `Payments` + `Payer` i18n keys in both `messages/*.json`; RTL-safe logical props; existing design tokens/colors (no new palette).
- **Prisma 6.19.3**, migrations via `npm run db:migrate`; whole-shekel `Int`.
- **Ownership-scoped** — all reads/writes resolve the wedding from the session (`getCurrentWedding`), never a client id; a payment is always validated to belong to a task in the caller's wedding.

## Data Model

### New enum `PayerRole`
```prisma
enum PayerRole {
  PARTNER_1
  PARTNER_2
  BOTH
  PARTNER_1_FAMILY
  PARTNER_2_FAMILY
  OTHER
}
```

### New model `TaskPayment`
(Named `TaskPayment` — `Payment` is already taken by the Stripe/premium table.)
```prisma
model TaskPayment {
  id         String    @id @default(cuid())
  weddingId  String
  wedding    Wedding   @relation(fields: [weddingId], references: [id], onDelete: Cascade)
  taskId     String
  task       Task      @relation(fields: [taskId], references: [id], onDelete: Cascade)

  amount     Int                        // whole shekels, > 0
  payer      PayerRole
  payerLabel String?                    // free text, only when payer == OTHER
  paidOn     DateTime?                  // optional "date paid"
  note       String?

  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt

  @@index([weddingId])
  @@index([taskId])
}
```
Add the back-relations: `Wedding.taskPayments TaskPayment[]` and `Task.payments TaskPayment[]`.

### `Task` fields (existing, semantics clarified)
- `estimatedCost Int?` — **the task's total/contract cost** — the basis for remaining. (No rename; we treat it as "cost".)
- `amountPaid Int?` — becomes a **cached total** = `sum(task.payments.amount)`, kept in sync by the payment actions (see Approach). Never edited directly by users anymore.
- `remaining = estimatedCost != null ? estimatedCost - amountPaid : null` (derived, not stored). Can go negative (overpaid) — display as-is; never clamp silently, but the UI may show an "overpaid" hint.

### Approach: cached `amountPaid` (decided)
`amountPaid` stays as a stored running total, recomputed inside every payment mutation (`= sum` of the task's payments) within the same transaction. Rationale: the **tested budget rollup and the remaining calc keep reading one number** — the Phase 5 budget subsystem is untouched (lowest risk). The ledger (`TaskPayment`) is the source of truth for *attribution/history*; `amountPaid` is a derived cache of the *total*. Invariant: `amountPaid == sum(payments)` is maintained solely through the payment actions (no other code writes `amountPaid`).

### Migration + data backfill
1. Schema migration: add `PayerRole`, `TaskPayment`, the two back-relations.
2. **Backfill** (in the same migration, SQL): for every `Task` with `amountPaid` set and `> 0`, insert one `TaskPayment` (`amount = amountPaid`, `payer = OTHER`, `payerLabel = NULL`, `note = 'imported'`, `paidOn = completedAt` or `now()`). This keeps `amountPaid == sum(payments)` from day one so by-payer totals are consistent (imported money shows under "Other" until re-attributed).

## Payer Name Resolution

Roles resolve to display names using the wedding's `partner1Name` / `partner2Name`:
- `PARTNER_1` → `partner1Name` (fallback: `Payer.partner1` — "Partner 1").
- `PARTNER_2` → `partner2Name` (fallback: `Payer.partner2`).
- `PARTNER_1_FAMILY` → `Payer.family` with `{name}` = partner1Name (e.g. "Maya's family" / "המשפחה של מיה"); if name blank, `Payer.partner1Family`.
- `PARTNER_2_FAMILY` → likewise for partner 2.
- `BOTH` → `Payer.both` ("Both" / "משותף").
- `OTHER` → `payerLabel` if set, else `Payer.other` ("Other" / "אחר").

A pure helper `payerDisplayName(role, payerLabel, partner1Name, partner2Name, t)` centralizes this (lives in `lib/payments/`), so the same names appear on the form, the ledger, and the by-payer roll-up. The set of selectable payers for the form comes from a pure `payerOptions(partner1Name, partner2Name, t)` returning `{ role, label }[]`.

## Server Actions (`lib/actions/payments.ts`)

All premium-gated with `requirePremiumWedding()`; all validate the target task belongs to the caller's wedding; all recompute the task's cached `amountPaid` transactionally.

Result type: `PaymentActionResult = { ok: true } | { ok: false; error: 'UNAUTHENTICATED' | 'NOT_FOUND' | 'INVALID' | 'PREMIUM_REQUIRED' }`.

- `recordTaskPayment(taskId, input)` where `input = { amount: number; payer: PayerRole; payerLabel?: string | null; paidOn?: Date | null; note?: string | null; cost?: number | null }`.
  - Zod-validate: `amount` integer `> 0`; if `payer === OTHER`, `payerLabel` optional but trimmed; `cost` (optional) integer `>= 0`.
  - In one `prisma.$transaction`: if `cost` provided, set the task's `estimatedCost`; create the `TaskPayment`; recompute `Task.amountPaid = sum(payments)`.
- `editTaskPayment(paymentId, input)` — update an existing entry (amount/payer/label/date/note), re-validate, recompute the task's `amountPaid`.
- `deleteTaskPayment(paymentId)` — delete the entry, recompute the task's `amountPaid`.

A single internal helper `recomputeTaskPaid(tx, taskId)` does the `sum → Task.amountPaid` write, called by all three.

## Recording UX (inline)

**Checklist task (`task-row.tsx`):**
- Completing a task **no longer** takes a paid amount. `setTaskStatus` drops its `amountPaid` parameter — completion just toggles done (stays **free**).
- For **premium** couples, the task row gains a "Record payment / deposit" affordance (also offered right after completing): a small form capturing **cost** (pre-filled from `estimatedCost`), **amount**, **payer** (select from `payerOptions`, free-text when Other), optional date/note → `recordTaskPayment`. The row shows a compact **paid / of cost · remaining** summary and the payment count.
- Free couples: no payment affordance (or an upsell hint); completion still works.

**Vendor detail:** with a linked task, the same "Record deposit/payment" affordance targets the linked task via `recordTaskPayment(linkedTaskId, …)`, and the vendor detail shows cost / paid / remaining for that task.

## Payments Page (`/payments`)

New route `app/[locale]/(app)/payments/page.tsx` (+ client view), added to the side-nav config (`APP_NAV_SECTIONS`, `Nav.payments`, placed after Budget). Premium-gated: free couples see the paywall (reuse the Budget paywall pattern with Payments copy).

Server loader gathers the wedding's money-relevant tasks — tasks with `estimatedCost != null` **or** at least one payment — with their payments and any linked vendor (via `VendorQuote.taskId`). Serializes to the client view. Content:
- **Rows:** per task — name (task title, and the linked vendor name if any), **cost**, **paid**, **remaining** (blank when no cost). Expand to see that task's payment entries (amount · payer · date) with edit/delete.
- **Totals:** total cost, total paid, total remaining (sum of per-task remaining where cost is known).
- **By-payer summary:** each payer (resolved name) with their summed contributions across all tasks, plus a grand total that equals total paid.

## Aggregation (pure — `lib/payments/rollup.ts`)

Pure, unit-tested functions (no I/O):
- `taskMoney(estimatedCost, payments): { cost, paid, remaining }` — `paid = sum(amount)`, `remaining = cost != null ? cost - paid : null`.
- `sumByPayer(payments): { role: PayerRole; payerLabel: string | null; amount: number }[]` — groups by `(role, payerLabel)`; `OTHER` with distinct labels stay distinct.
- `rollup(tasks): { totalCost, totalPaid, totalRemaining, byPayer, rows }` — composes the above over the serialized task set; `totalRemaining` sums only rows with a known cost.

## Premium Gating

- `/payments` loader: if `!isPremium(wedding)` render the paywall (Payments copy) instead of the view.
- `recordTaskPayment` / `editTaskPayment` / `deleteTaskPayment`: `requirePremiumWedding()` → `PREMIUM_REQUIRED` for free couples.
- The task-row payment affordance and vendor-detail affordance render only for premium couples.

## Integration Touch-Points (decided)

- **Completion popup → payment:** `setTaskStatus(taskId, done)` drops the `amountPaid` arg; the "how much paid?" popup is replaced by the premium "record payment" form. Update all callers (task-row, `pushQuoteToBudget`, tests).
- **Budget page paid is read-only:** remove the inline `amountPaid` editor on the Budget page; the paid figure is display-only there (it still reflects the cached total). The `setTaskAmountPaid` budget action is removed (no remaining caller). `setTaskEstimatedCost` (cost editing) stays.
- **`pushQuoteToBudget` "mark paid":** instead of setting the scalar paid, it now (a) marks the linked task done (as today), (b) sets the task's `estimatedCost` to the quote amount if unset, and (c) records a `TaskPayment` for the quote amount with `payer = BOTH` (editable afterward on the Payments page). The "not paid" path is unchanged (sets `estimatedCost`, no payment).
- **Cached `amountPaid` invariant:** only the three payment actions (via `recomputeTaskPaid`) write `amountPaid`; the migration backfill seeds it. No other write path remains.

## i18n

New `Payments` namespace (title, page copy, column headers cost/paid/remaining, totals, by-payer heading, record-form labels, paywall title/body, overpaid hint, empty state) and `Payer` namespace (partner1/partner2/both/family/{name} template/partner1Family/partner2Family/other), plus `Nav.payments`. Identical he/en key sets.

## Testing

- **Unit (pure):** `taskMoney` (cost/paid/remaining incl. no-cost and overpaid), `sumByPayer` (grouping incl. distinct OTHER labels), `rollup` (totals), `payerDisplayName` + `payerOptions` (name resolution incl. blank-name fallbacks).
- **Action:** `recordTaskPayment`/`edit`/`delete` — happy path, `amountPaid` recompute equals sum, cost-set path, ownership rejection, premium gating (`PREMIUM_REQUIRED` for free), `INVALID` on non-positive amount. `pushQuoteToBudget` paid-path now creates a BOTH payment. `setTaskStatus` no longer touches paid.
- **Component:** the record-payment form (renders payer options with names, submits `recordTaskPayment`); the Payments page view (rows, totals, by-payer). Reuse the `NextIntlClientProvider` idiom.
- **E2E (premium couple):** set a task cost (₪10,000), record a ₪3,000 deposit by "Both", see ₪7,000 remaining on the task/vendor and on `/payments`, and see ₪3,000 under "Both" in the by-payer summary. Free couple: `/payments` shows the paywall; no record affordance.

## Acceptance Criteria

1. A premium couple can record one or more payments (amount + payer + optional date/note) on a task, and set/adjust the task's cost.
2. Each task/vendor shows cost, paid-so-far, and remaining (= cost − paid), with remaining blank when no cost is set.
3. `/payments` lists money-relevant tasks with those figures, overall totals, and a by-payer summary whose grand total equals total paid.
4. Payers are neutral and name-based; the couple's real names appear everywhere a payer is shown.
5. `amountPaid` always equals the sum of a task's payments (verified after record/edit/delete); the budget rollup is unchanged.
6. The Payments page and all payment mutations are premium-gated; free couples get the paywall / `PREMIUM_REQUIRED`; completing a task stays free.
7. `pushQuoteToBudget` "paid" records a BOTH payment; the Budget page paid figure is read-only.
8. Existing paid amounts are backfilled into `TaskPayment` rows (payer Other) so totals are consistent post-migration.
9. he/en parity, RTL-safe, existing design tokens; lint/typecheck/unit/e2e green.

## Deferred / Future

- Due dates, expected/scheduled payments, installment plans, and reminders (a later phase; hooks: `paidOn` and the isolated ledger make this additive).
- Re-attributing imported "Other" payments in bulk.
- Per-payer filtering/export on the Payments page.
