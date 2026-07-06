# Wedding Planner AI — Phase 5: Budget Planning & Optimization

**Status:** Approved for planning
**Date:** 2026-07-06
**Builds on:** Phase 1 (Foundation), Phase 2 (Onboarding & Wedding Profile), Phase 3 (Checklist & Timeline), Phase 4 (Wedding Concepts)

## Context

Phases 1–4 delivered auth, i18n (he default/RTL + en), the `Wedding` model with profile fields (`budgetTotal`, `guestCount`, `priorities`) + `onboardingCompletedAt`, the onboarding wizard, the `/settings/wedding` edit page, the checklist engine (`ChecklistTemplate` → per-couple snapshot `Task` with a category, a relative-due-date timeline, complete/edit/trash/restore/add-custom), and the concepts library (`Concept`/`ConceptElement`/`ConceptImage`, `Wedding.selectedConceptId`, push-idea-to-checklist). Crucially, Phase 4 modeled `ConceptElement.estCostMin`/`estCostMax` + a `category` (reusing `TaskCategory`) **specifically** so this phase can consume them; and every checklist `Task` already carries a `category`. Admin role-gating (`/admin`, live-DB `User.role === ADMIN`) exists from Phase 1, and the admin-master → per-couple pattern (Phase 3 templates, Phase 4 concepts CMS) is established.

Phase 5 is **Budget Planning & Optimization**: a couple-facing budget page anchored on `Wedding.budgetTotal`. It splits the total across the existing `TaskCategory` categories using three signals — an admin-editable **baseline percentage template**, the **selected concept's** summed cost ranges, and the couple's onboarding **priorities** — via a **deterministic constrained allocator** ("water-filling"). The checklist and the budget are unified: **checklist tasks are the budget's line items.** When a couple completes a task, a skippable prompt captures how much they paid; that **committed** money is frozen per category, and the optimizer only redistributes the **open** (not-yet-closed) remainder. A **gift estimator** (average gift × guest count, and the delta vs the budget) helps couples decide the total. No AI, no vendors, no payment processing this phase.

This is a couple-facing planning feature plus a small admin CMS for the percentage baseline.

## Goals

- A couple-facing **`/budget`** page: the total budget (inline-editable), a **gift estimator** with a net surplus/shortfall delta, and a **per-category breakdown** showing recommended vs committed vs open, with over/under-budget feedback.
- A **deterministic optimizer** (`lib/budget/optimize.ts`, pure + unit-tested) that distributes the open budget across categories by baseline % × priority weight, clamped to the selected concept's summed cost ranges, redistributing leftovers (water-filling) so the result always sums to the total.
- **Tasks are the budget's line items.** On completing a checklist task, a **skippable** popup captures `amountPaid`; that amount shows on the task and rolls into its category's **committed** (frozen) total. Concept-pushed tasks carry an `estimatedCost` (seeded from the idea's midpoint) that feeds the open/planned side.
- A **manual per-category override** ("pin") a couple can set; pinned categories are fixed and excluded from redistribution.
- An admin-editable **baseline percentage template** (`BudgetTemplate`) seeded with standard wedding percentages, with a minimal `ADMIN` CMS at `/admin/budget-templates`, mirroring Phase 3's checklist-template admin.

## Non-goals (deferred)

- **AI-driven optimization.** Natural-language tradeoff reasoning ("make it feel luxe for less") sits on top of this deterministic engine and is **Phase 10** (AI Multi-Agent Layer). Phase 5 builds the explainable engine it will later call.
- **Payment processing / real transactions.** `amountPaid` is a couple-entered number for their own tracking — no Stripe, no receipts, no deposits/installments. Real payments are **Phase 9**.
- **Vendor-linked costs.** Costs are per-task/per-category, not per-vendor. Vendor recommendations and vendor-attached quotes are **Phase 6**.
- **Multi-currency.** Amounts are whole **₪ (ILS)** integers, matching the existing `budgetTotal Int?`. A currency field is a later additive change.
- **A separate budget-line-item table.** The unification onto `Task` is deliberate — no parallel expense-record model this phase.
- **Rich admin shell.** The `BudgetTemplate` CMS is minimal/functional, matching Phase 3/4; the polished shared admin panel is **Phase 8**.
- **Historical/versioned budgets.** One live budget per wedding; no snapshots over time.

## Key decisions

1. **Tasks *are* the budget line items (no parallel table).** A category's spend is derived from its tasks: `committed` = Σ `amountPaid` of that category's **DONE** tasks; `planned` = Σ `estimatedCost` of its **open** tasks. This unifies checklist and budget, avoids a second source of truth, and means "complete a task → it shows in the budget" is a field write, not a sync. The only new per-couple table stores **manual category overrides** (`BudgetAllocation`), not line items.
2. **Deterministic water-filling allocator, not AI.** Given the total `B`, per-category weights (baseline % × priority boost), and per-category clamps (`[floor, ceiling]` from the concept's summed cost range minus committed), the engine allocates proportionally, clamps, and redistributes the excess/deficit across unclamped categories until stable. Explainable, deterministic, fully unit-testable. AI optimization is explicitly Phase 10.
3. **The optimizer only moves *open* money.** `committed` per category (Σ paid on DONE tasks) is frozen; pinned categories are fixed. The engine distributes `R = B − Σ pinned − Σ committed(non-pinned)` across the remaining open categories. This is the couple's "only play with what's not closed yet."
4. **Three allocation signals.** (a) **Baseline template** — admin-editable standard percentages, works with no concept selected; (b) **concept signal** — the selected concept's `estCostMin`/`estCostMax` summed by category provide the clamp `[floor, ceiling]`; (c) **priority signal** — the couple's onboarding `priorities` boost their favored categories' weight. All three are optional inputs; the engine degrades gracefully when any is absent (no concept → no clamps; no priorities → no boost; the baseline always exists).
5. **Baseline percentages are an admin-editable master (`BudgetTemplate`), seeded.** Chosen over a hard-coded constant for consistency with the Phase 3/4 admin-master pattern and so the split can be tuned without a deploy. Seeded to sum to 100 across categories.
6. **`amountPaid` on completion is optional/skippable.** Many checklist items have no cost (e.g. "Choose a hashtag"); forcing a number would create fake zeros. A task with no `amountPaid` simply contributes nothing to committed. The prompt appears on completion but can be dismissed, and the amount is **editable anytime** from the task row or the budget page.
7. **Committed is *derived*, not stored — so paid amounts stay fully editable.** `committed` per category is recomputed from tasks on every load (Σ `amountPaid` of **DONE** tasks); it is never persisted as a separate frozen figure. So when a couple revises what they paid — e.g. they swap DJs after a month and the amount changes — they simply edit `amountPaid` on that task, and the category's committed total and the entire optimization re-roll instantly. Re-opening a task returns its money to the open pool. "Frozen" means the optimizer won't silently reallocate that money, **not** that it's locked. (Deposit-before-done is an accepted edge deferral — the field exists, but only DONE tasks contribute to committed.)
8. **A category's allocation is never below its committed; pins are not validated against committed at write time.** The optimizer treats `committed` as each category's hard floor. A **pinned** category renders `max(pin, committed)`. Because paid amounts change over time (the DJ scenario), a write-time "pin ≥ committed" check would go stale — so it isn't enforced; instead the optimizer clamps up to committed and the feedback notes "spent above your pinned amount here" when relevant.
9. **Priority→category mapping is a fixed, documented table.** `FOOD→CATERING`, `PARTY→MUSIC`, `PHOTOGRAPHY→PHOTOGRAPHY`, `GUEST_EXPERIENCE→GUESTS`, `DESIGN→{DESIGN, FLOWERS}`, `FASHION→ATTIRE`. Mapped categories get a fixed weight multiplier per matched priority. Lives in `lib/budget/` as a pure constant.
10. **Whole-shekel integers throughout**, matching `budgetTotal Int?`. `avgGiftPerGuest`, `estimatedCost`, `amountPaid`, and `BudgetAllocation.amount` are all `Int?`/`Int` ₪.
11. **Live-DB admin authorization** on every `BudgetTemplate` mutation (`User.role === ADMIN` read fresh) — the Phase 3/4 pattern, with the parametrized non-admin `FORBIDDEN` test across all admin exports (the Phase 4 hardening lesson).
12. **Ownership scoping** on every couple action (resolve `weddingId` from the session; reject otherwise) — the Phase 3/4 pattern.

## Scale & cost calibration

Right-sized to a few thousand couples. The optimizer is O(categories) with a handful of water-filling passes over **12 fixed categories** — microseconds, run on demand in the page loader, nothing persisted. `BudgetTemplate` is a tiny fixed catalog (≤12 rows). Per-couple budget state is a couple of `Int` fields on `Wedding` (`budgetTotal`, `avgGiftPerGuest`) plus at most ~12 `BudgetAllocation` override rows and the `estimatedCost`/`amountPaid` fields already colocated on existing `Task` rows. Category rollups (committed/planned) are a single indexed `Task` query grouped in memory — the checklist page already loads these tasks. No new external services, no background jobs, no new secrets.

## Data model

One new master model, one new per-couple model, two `Wedding` fields, two `Task` fields. All mirror existing conventions (`active`/`sortOrder`, `@@unique` for idempotency, ₪ integers).

```prisma
model BudgetTemplate {              // admin-editable baseline percentages (seeded, sum ≈ 100)
  id            String       @id @default(cuid())
  category      TaskCategory @unique          // one row per category
  defaultPercent Int                          // 0–100; the baseline share of the total
  active        Boolean      @default(true)   // inactive → excluded from the split
  sortOrder     Int          @default(0)
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt
}

model BudgetAllocation {            // per-couple manual category override ("pin")
  id        String       @id @default(cuid())
  weddingId String
  wedding   Wedding      @relation(fields: [weddingId], references: [id], onDelete: Cascade)
  category  TaskCategory
  amount    Int                                // pinned ₪ allocation for this category
  createdAt DateTime     @default(now())
  updatedAt DateTime     @updatedAt
  @@unique([weddingId, category])              // one override per category, idempotent upsert
}
```

Added to `Wedding`:
```prisma
avgGiftPerGuest   Int?                         // ₪; for the gift estimator (guestCount already exists)
budgetAllocations BudgetAllocation[]
```

Added to `Task`:
```prisma
estimatedCost Int?   // ₪ planned cost; seeded from a pushed concept idea's midpoint; editable
amountPaid    Int?   // ₪ actual paid; captured (skippable) on completion; committed only when DONE
```

`budgetTotal Int?`, `guestCount Int?`, and `priorities Priority[]` already exist on `Wedding`; `Task.category` and `ConceptElement.estCostMin/estCostMax/category` already exist — no changes to those.

## Domain logic & server actions

Following the Phase 3/4 layout: pure logic + Zod in `lib/budget/`, server actions in `lib/actions/`.

**`lib/budget/` (pure, unit-tested):**
- `priority-map.ts` — the fixed `Priority → TaskCategory[]` table + the weight multiplier constant.
- `optimize.ts` — the allocator. Signature roughly `optimizeBudget({ budgetTotal, baseline: Map<category, percent>, priorities, conceptRanges: Map<category, {min,max}>, committed: Map<category, number>, pinned: Map<category, number> }) → { perCategory: Array<{ category, recommended, committed, open, floor, ceiling, pinned }>, distributable, feedback }`. Water-fills the open remainder; result's category totals sum to `budgetTotal` when feasible. `feedback` describes over-budget (shortfall vs Σ floors, underfunded categories) or headroom (unallocated ₪).
- `gifts.ts` — `estimateGifts({ avgGiftPerGuest, guestCount, budgetTotal }) → { estimatedGifts, delta }` (pure; `delta = estimatedGifts − budgetTotal`).
- `rollup.ts` — derive `committed`/`planned` per category from a wedding's tasks (Σ `amountPaid` of DONE tasks; Σ `estimatedCost` of open tasks), and sum the selected concept's active elements into `conceptRanges`.
- `schema.ts` — Zod: `budgetTotalInput`, `avgGiftInput`, `categoryAllocationInput` (category ∈ `TaskCategory`, amount ≥ 0), `taskAmountInput`/`taskEstimateInput` (≥ 0, integer), `budgetTemplateInput` (percent 0–100, category enum).

**`lib/actions/budget.ts` — couple actions** (ownership-scoped to the session `weddingId`; reject when none):
- `setBudgetTotal(amount | null)` → update `Wedding.budgetTotal`.
- `setAvgGiftPerGuest(amount | null)` → update `Wedding.avgGiftPerGuest`.
- `setCategoryAllocation(category, amount)` → upsert `BudgetAllocation` (pin); `clearCategoryAllocation(category)` → delete (unpin).
- `setTaskAmountPaid(taskId, amount | null)` → set `Task.amountPaid` on an owned task (also callable from the completion popup and the budget page).
- `setTaskEstimatedCost(taskId, amount | null)` → set `Task.estimatedCost` on an owned task.
- **Extend the existing `setTaskStatus(taskId, done)` path (Phase 3)** to accept an optional `amountPaid` (only meaningful when `done: true`) so completion + paid-amount is one action; skipping leaves it null. (`setTaskAmountPaid` remains the standalone editor for later changes.)

**`lib/actions/admin-budget.ts` — admin CMS actions** (live-DB `ADMIN` check on every mutation, like `admin-templates.ts`):
- `updateBudgetTemplate(category, { defaultPercent, active, sortOrder })`, `setBudgetTemplateActive(category, active)`, `reorderBudgetTemplates(order)`. (Categories are the fixed enum set — the CMS edits the seeded rows rather than creating/deleting arbitrary ones.)

## UI & navigation

**Placement:** a standalone **`/budget`** couple-facing section, a nav item alongside `/checklist` and `/concepts` — not part of the onboarding gate. **Added to the proxy `APP_PREFIXES` login-gate** (the recurring Phase 3/4 lesson). A light **dashboard entry** shows "Set your budget" when `budgetTotal` is null, else a mini summary (total, committed, remaining) — the Phase 4 nudge pattern.

**Couple UI — `app/[locale]/(app)/budget/`:**
- `page.tsx` — server component; loads `budgetTotal`/`guestCount`/`avgGiftPerGuest`/`priorities`/`selectedConcept` + the wedding's tasks + overrides, runs the rollup + optimizer, renders the breakdown.
- `budget-total-card.tsx` — inline-editable total (client; calls `setBudgetTotal`).
- `gift-estimator-card.tsx` — average-gift input + guest count (link to edit) → estimated gifts and the net **surplus/shortfall** delta (client; calls `setAvgGiftPerGuest`).
- `category-breakdown.tsx` — per category: recommended vs committed vs open bars/numbers, the pin/override control (`setCategoryAllocation`/`clearCategoryAllocation`), and the category's tasks with their `estimatedCost`/`amountPaid`. Over/under-budget feedback banner from the optimizer.
- Client components call the server actions with optimistic UI, mirroring `task-row.tsx`.

**Checklist completion popup (bounded change to Phase 3 `/checklist`):**
- On marking a task DONE, a small **skippable** "How much did you pay? (optional)" prompt captures `amountPaid` (calls the extended `setTaskStatus`). The amount then renders on the task row and rolls into the budget. Editing/clearing it later is available from the task row and the budget page.

**Admin CMS — `app/[locale]/admin/budget-templates/`:**
- `page.tsx` — the ≤12 category rows with `defaultPercent`, active toggle, and order; a live **sum indicator** (warns if the active rows don't total 100). Mirrors `checklist-templates`. Admin nav: add a "Budget Baseline" link next to "Checklist Templates" and "Concepts".

**i18n / RTL:** all chrome via `messages/he.json` + `en.json` (no hard-coded strings — ESLint enforced); logical Tailwind properties (`ps-`/`pe-`/`text-start`); ₪ amounts formatted via the shared locale-aware number formatting; old-money palette/fonts from the design tokens.

**Seed:** extend the committed, idempotent seed with `BudgetTemplate` rows for every category, using standard wedding percentages that sum to 100 (e.g. VENUE+CATERING the largest share, then PHOTOGRAPHY, MUSIC, ATTIRE, DESIGN, FLOWERS, and smaller shares for the rest). Idempotent upsert by `category`.

## Error handling & edge cases

- **Ownership scoping** — every couple action resolves `weddingId` from the session and operates only on that wedding; reject otherwise. `setTaskAmountPaid`/`setTaskEstimatedCost` verify the task belongs to the session wedding.
- **Admin authorization** — every `BudgetTemplate` mutation re-checks `User.role === ADMIN` against the live DB (rejects a stale-JWT admin).
- **No budget set (`budgetTotal` null)** — the page prompts for a total; the breakdown/optimizer render an empty/zero state rather than dividing by nothing. Gift delta is shown only once both a gift average and a budget exist.
- **No concept selected** — no clamps; the optimizer allocates purely by baseline % × priority weight (floors 0, ceilings ∞).
- **No priorities** — no boost; pure baseline weighting.
- **Committed exceeds a pin / a recommendation** — the optimizer treats `committed` as each category's hard floor and never assigns a category less than its committed. A pinned category renders `max(pin, committed)`; pins are **not** validated against committed at write time (paid amounts change over time — a stale write-time check would be wrong), so if a later paid-amount edit pushes committed above the pin, the category simply shows committed and the feedback notes "spent above your pinned amount here." If total committed exceeds `budgetTotal`, the feedback flags an over-budget overrun (negative distributable) rather than producing negative allocations.
- **Over-budget concept** — if `R < Σ floors`, feedback reports the shortfall and names the underfunded categories (allocations clamp to what fits, not below committed).
- **Headroom** — if all categories clamp to their ceilings with money left, feedback reports the unallocated ₪.
- **Inactive `BudgetTemplate` category** — excluded from the split (weight 0); if it has committed spend, that still shows as committed (money isn't hidden), but it isn't allocated fresh open budget.
- **Re-opening a DONE task** — its `amountPaid` returns to the open pool automatically (committed is derived, not stored).
- **Negative / non-integer inputs** — rejected by Zod at the action boundary (amounts are non-negative integers).
- **Percentages not summing to 100** — the optimizer normalizes by the active weight sum (never assumes exactly 100), and the admin UI warns; the split stays correct regardless.
- **Task deleted (soft-delete)** — trashed tasks are excluded from both committed and planned rollups (the `deletedAt` filter already used by the checklist).

## Testing strategy

Mirrors Phase 3/4 (unit-heavy + focused e2e).

- **Unit (Vitest):**
  - `lib/budget/optimize.test.ts` — proportional split; clamp to concept floor/ceiling; water-fill redistribution; committed as a hard floor; pinned excluded, rendering `max(pin, committed)` when committed exceeds the pin; over-budget shortfall + underfunded-category feedback; headroom feedback; percentages not summing to 100 (normalization); result totals sum to `budgetTotal` when feasible; never allocates below committed.
  - `lib/budget/gifts.test.ts` — estimated gifts = avg × count; delta sign (surplus/shortfall); null inputs.
  - `lib/budget/priority-map.test.ts` — each `Priority` maps to the expected category set; multiplier applied once per matched priority.
  - `lib/budget/rollup.test.ts` — committed = Σ paid on DONE only; planned = Σ estimate on open; trashed excluded; concept-range summation over active elements.
  - `lib/budget/schema.test.ts` — non-negative integers, category enum, percent 0–100.
  - `lib/actions/budget.test.ts` — set total/gift; pin/unpin allocation; set task paid/estimate on an owned task; ownership rejection on `weddingId` mismatch; `setTaskStatus`-with-amount happy path + skip.
  - `lib/actions/admin-budget.test.ts` — update/reorder/active happy paths; **parametrized non-admin `FORBIDDEN` across every admin export** (the Phase 4 hardening pattern); live-DB role.
  - Seed test — idempotent re-run doesn't duplicate `BudgetTemplate` rows.
- **Component (Vitest + RTL):** category breakdown (recommended/committed/open, over-budget banner); gift estimator (surplus vs shortfall); completion popup (skip vs enter amount).
- **E2E (Playwright):** couple sets a budget → sees the category split → completes a checklist task and enters a paid amount → verifies it appears on the task **and** in that category's committed total, and that the optimizer redistributes only the open remainder → pins a category and sees it excluded from redistribution → enters a gift average and sees the delta. Admin edits a baseline percentage and sees the couple split change. Logged-out `/budget` + non-admin `/admin/budget-templates` are gated.

## Acceptance criteria

1. Couple sees `/budget` with an inline-editable total, and (once set) a per-category breakdown of recommended vs committed vs open — he + en, RTL correct.
2. The optimizer splits the total by baseline % × priority weight, clamped to the selected concept's summed cost ranges, always summing to the total when feasible; it degrades gracefully with no concept and/or no priorities.
3. Completing a checklist task offers a **skippable** paid-amount prompt; an entered amount shows on the task and rolls into that category's **committed** total.
4. Committed money is frozen; the optimizer redistributes only the **open** remainder. Re-opening a task returns its money to the open pool.
5. A couple can **pin** a category to a fixed amount; pinned categories are excluded from redistribution and always render at least their committed (`max(pin, committed)`). Paid amounts remain editable anytime, and committed re-derives so the whole budget re-rolls.
6. Over-budget (concept implies more than the total) and headroom (money unallocated) both surface as clear feedback.
7. The **gift estimator** computes `avgGiftPerGuest × guestCount` and shows a net surplus/shortfall delta vs the budget.
8. Admin can edit the baseline percentages (`BudgetTemplate`) with a sum indicator; changes affect couple splits. Admin mutations reject non-admins (live-DB role).
9. All amounts are non-negative ₪ integers; invalid inputs rejected at the action boundary; ownership enforced on every couple action.
10. No hard-coded strings (ESLint clean); logical properties render both RTL and LTR correctly.
11. Seed provides a full set of baseline percentages (sum 100); re-running it does not duplicate.
12. `lint --max-warnings 0`, typecheck, and all unit + e2e tests green.

## Roadmap position

Done: Phase 1 (Foundation), Phase 2 (Onboarding & Profile), Phase 3 (Checklist & Timeline), Phase 4 (Wedding Concepts).
**This: Phase 5 — Budget Planning & Optimization.** Next: Vendor Database (6, recommendations per idea + vendor quotes), Dashboard (7), Admin Panel (8), Premium/Payments (9, enforces `isPremium` + real transactions), AI Multi-Agent Layer (10, AI-driven budget optimization on top of this engine).
