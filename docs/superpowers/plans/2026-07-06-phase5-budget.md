# Phase 5 — Budget Planning & Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Budget Planning feature — a couple-facing `/budget` page that splits `Wedding.budgetTotal` across the existing `TaskCategory` categories via a deterministic water-filling optimizer (baseline % × priority weight, clamped to the selected concept's summed cost ranges), unifies checklist tasks as the budget's line items (skippable paid-amount on completion → committed spend), and a gift estimator; plus an admin CMS to edit the baseline percentages.

**Architecture:** Tasks *are* the budget line items — `committed` per category is derived (Σ `amountPaid` of DONE tasks), never stored; the optimizer only redistributes the open remainder. Pure domain logic lives in `lib/budget/` (`priority-map`, `optimize`, `gifts`, `rollup`, `schema`), couple actions in `lib/actions/budget.ts`, admin actions in `lib/actions/admin-budget.ts`, couple UI under `app/[locale]/(app)/budget/`, admin CMS under `app/[locale]/admin/budget-templates/`. The Phase 3 checklist gains a bounded change: a skippable paid-amount prompt on task completion.

**Tech Stack:** Next.js 16 (App Router, RSC + server actions), Prisma 6.19.3 + Postgres, next-intl (he default/RTL + en), Zod, Vitest (+ @testing-library/react), Playwright, Tailwind v4 design tokens.

## Global Constraints

- **Prisma pinned to 6.19.3** — do not upgrade; migrations via `npm run db:migrate` (Docker Postgres on host port **5433**, `DATABASE_URL` from `.env`). Run `npm run db:generate` after schema changes; if a dev server is already running against an older schema, restart it (the Phase 4 stale-client lesson).
- **Whole-shekel integers everywhere** — `budgetTotal`, `avgGiftPerGuest`, `estimatedCost`, `amountPaid`, `BudgetAllocation.amount`, and `BudgetTemplate.defaultPercent` are all integers (₪; percent is 0–100). No floats persisted.
- **No hard-coded strings in JSX** — all chrome via `messages/he.json` + `messages/en.json` (ESLint rule fails the build otherwise). Reuse the existing `TaskCategory` namespace for category labels.
- **RTL-safe** — use Tailwind logical properties (`ps-`/`pe-`/`ms-`/`me-`/`text-start`/`text-end`), never `pl-`/`pr-`/`text-left`. Number/`₪` fields that must stay LTR use `dir="ltr"` (as `task-row.tsx` does for the date input).
- **Ownership scoping** — couple actions resolve `weddingId` from the DB via `getCurrentWedding(userId)` (never a client/JWT id). Admin mutations re-check live `User.role === ADMIN`.
- **Reuse existing enums** — budget categories are the existing `TaskCategory` enum. Do not add a new category enum. Priorities are the existing `Priority` enum.
- **Lint/type gate** — `npm run lint` (`--max-warnings 0`) and `npm run typecheck` must stay green.
- **Design tokens** — use existing token classes (`bg-surface`, `text-text`, `text-muted`, `bg-primary`, `text-background`, `rounded-card`, `font-display`, `font-body`). Match the "old-money" look of the Phase 3/4 UI.

## File Structure

**Create:**
- `lib/budget/priority-map.ts` — `PRIORITY_CATEGORY_MAP`, `PRIORITY_BOOST`, `priorityBoostFor()`.
- `lib/budget/priority-map.test.ts`
- `lib/budget/gifts.ts` — `estimateGifts()`.
- `lib/budget/gifts.test.ts`
- `lib/budget/rollup.ts` — `rollupTasks()`, `sumConceptRanges()`.
- `lib/budget/rollup.test.ts`
- `lib/budget/optimize.ts` — `optimizeBudget()` + result types.
- `lib/budget/optimize.test.ts`
- `lib/budget/schema.ts` — Zod input schemas.
- `lib/budget/schema.test.ts`
- `lib/actions/budget.ts` — couple actions.
- `lib/actions/budget.test.ts`
- `lib/actions/admin-budget.ts` — admin CMS actions.
- `lib/actions/admin-budget.test.ts`
- `app/[locale]/(app)/budget/page.tsx` — budget page (RSC loader).
- `app/[locale]/(app)/budget/budget-view.tsx` — client shell (state + refresh).
- `app/[locale]/(app)/budget/budget-total-card.tsx` — inline-editable total (client).
- `app/[locale]/(app)/budget/gift-estimator-card.tsx` — gift avg + delta (client).
- `app/[locale]/(app)/budget/category-breakdown.tsx` — per-category rows + pin control + per-task cost editors (client).
- `app/[locale]/(app)/budget/budget-view.test.tsx` — component tests.
- `app/[locale]/admin/budget-templates/page.tsx` — admin list (RSC).
- `app/[locale]/admin/budget-templates/budget-templates-admin.tsx` — client list + percent editor.
- `app/[locale]/admin/budget-templates/budget-templates-admin.test.tsx` — component test.

**Modify:**
- `prisma/schema.prisma` — add `BudgetTemplate` + `BudgetAllocation`; `Wedding.avgGiftPerGuest`/`budgetAllocations`; `Task.estimatedCost`/`amountPaid`.
- `prisma/seed.ts` — seed the 12 `BudgetTemplate` rows (idempotent upsert by `category`).
- `lib/actions/checklist.ts:37` — extend `setTaskStatus(taskId, done, amountPaid?)`.
- `lib/actions/checklist.test.ts` — cover the new `amountPaid` param.
- `lib/concepts/queries.ts` — `elementToTaskPayload` also seeds `estimatedCost` from the element midpoint.
- `lib/concepts/queries.test.ts` — assert the seeded `estimatedCost`.
- `lib/auth/authorize.ts:7` — add `/budget` to `APP_PREFIXES`.
- `lib/auth/authorize.test.ts` — assert `/budget` is login-gated.
- `app/[locale]/(app)/checklist/checklist-view.tsx` — add `estimatedCost`/`amountPaid` to `SerializedTask`.
- `app/[locale]/(app)/checklist/page.tsx` — serialize the two new fields.
- `app/[locale]/(app)/checklist/task-row.tsx` — skippable paid-amount prompt on completion; show paid amount.
- `app/[locale]/admin/page.tsx` — add a "Budget Baseline" admin nav link.
- `app/[locale]/(app)/dashboard/page.tsx` — budget entry card (set-budget nudge or mini summary).
- `messages/he.json` + `messages/en.json` — add `Budget` + `AdminBudget` namespaces; extend `Dashboard` + `Checklist`.
- `e2e/budget.spec.ts` — create (new e2e spec).

---

### Task 1: Schema, migration & BudgetTemplate seed

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `prisma/seed.ts`

**Interfaces:**
- Produces: Prisma models `BudgetTemplate` (unique `category`), `BudgetAllocation` (unique `[weddingId, category]`); `Wedding.avgGiftPerGuest` (nullable Int), `Wedding.budgetAllocations`; `Task.estimatedCost` (nullable Int), `Task.amountPaid` (nullable Int). Seeded `BudgetTemplate` rows for all 12 categories summing to 100.

- [ ] **Step 1: Add the models and fields to the schema**

In `prisma/schema.prisma`, append the two models:

```prisma
model BudgetTemplate {
  id             String       @id @default(cuid())
  category       TaskCategory @unique
  defaultPercent Int
  active         Boolean      @default(true)
  sortOrder      Int          @default(0)
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt
}

model BudgetAllocation {
  id        String       @id @default(cuid())
  weddingId String
  wedding   Wedding      @relation(fields: [weddingId], references: [id], onDelete: Cascade)
  category  TaskCategory
  amount    Int
  createdAt DateTime     @default(now())
  updatedAt DateTime     @updatedAt

  @@unique([weddingId, category])
  @@index([weddingId])
}
```

In the existing `Wedding` model, add these two lines (next to `favorites`):

```prisma
  avgGiftPerGuest   Int?
  budgetAllocations BudgetAllocation[]
```

In the existing `Task` model, add these two lines (next to `notes`):

```prisma
  estimatedCost Int?
  amountPaid    Int?
```

- [ ] **Step 2: Create and apply the migration**

Run: `npm run db:migrate -- --name add_budget_planning`
Expected: a new folder under `prisma/migrations/` and "Your database is now in sync with your schema." Prisma Client regenerates.

- [ ] **Step 3: Run typecheck to confirm the client picked up the new models**

Run: `npm run typecheck`
Expected: PASS (`BudgetTemplate`, `BudgetAllocation` types available from `@prisma/client`; `Task.amountPaid`/`estimatedCost` present).

- [ ] **Step 4: Add the baseline-percentage seed**

In `prisma/seed.ts`, above `async function main()`, add the baseline table. These are standard wedding shares summing to **100**.

```typescript
const budgetBaseline: { category: string; defaultPercent: number; sortOrder: number }[] = [
  { category: 'VENUE', defaultPercent: 20, sortOrder: 10 },
  { category: 'CATERING', defaultPercent: 25, sortOrder: 20 },
  { category: 'PHOTOGRAPHY', defaultPercent: 10, sortOrder: 30 },
  { category: 'MUSIC', defaultPercent: 10, sortOrder: 40 },
  { category: 'ATTIRE', defaultPercent: 8, sortOrder: 50 },
  { category: 'DESIGN', defaultPercent: 7, sortOrder: 60 },
  { category: 'FLOWERS', defaultPercent: 6, sortOrder: 70 },
  { category: 'GUESTS', defaultPercent: 4, sortOrder: 80 },
  { category: 'CEREMONY', defaultPercent: 3, sortOrder: 90 },
  { category: 'PLANNING', defaultPercent: 3, sortOrder: 100 },
  { category: 'BUDGET', defaultPercent: 0, sortOrder: 110 },
  { category: 'OTHER', defaultPercent: 4, sortOrder: 120 },
];
```

- [ ] **Step 5: Write the baseline upsert in the seed's `main()`**

Inside `main()` in `prisma/seed.ts`, after the concept upsert loop and its `console.log`, add (upsert by the unique `category`, so re-seeding is idempotent and reflects edits to the seed file):

```typescript
  for (const b of budgetBaseline) {
    await prisma.budgetTemplate.upsert({
      where: { category: b.category as never },
      create: { category: b.category as never, defaultPercent: b.defaultPercent, active: true, sortOrder: b.sortOrder },
      update: { defaultPercent: b.defaultPercent, active: true, sortOrder: b.sortOrder },
    });
  }
  console.log(`Seeded ${budgetBaseline.length} budget baseline rows.`);
```

- [ ] **Step 6: Run the seed twice to confirm idempotency**

Run: `npm run db:seed && npm run db:seed`
Expected: both runs finish with "Seeded 12 budget baseline rows." and no unique-constraint errors.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations prisma/seed.ts
git commit -m "feat: add budget-planning schema, migration, and baseline seed"
```

---

### Task 2: Pure budget domain (priority-map, gifts, rollup, optimize, schema)

This is the crux of the phase — pure, deterministic, unit-tested functions with no I/O.

**Files:**
- Create: `lib/budget/priority-map.ts` + `.test.ts`
- Create: `lib/budget/gifts.ts` + `.test.ts`
- Create: `lib/budget/rollup.ts` + `.test.ts`
- Create: `lib/budget/optimize.ts` + `.test.ts`
- Create: `lib/budget/schema.ts` + `.test.ts`

**Interfaces:**
- Consumes: `Priority`, `TaskCategory` from `@prisma/client`.
- Produces:
  - `priorityBoostFor(category, priorities): number`; `PRIORITY_CATEGORY_MAP`; `PRIORITY_BOOST`.
  - `estimateGifts({ avgGiftPerGuest, guestCount, budgetTotal }): { estimatedGifts, delta }`.
  - `rollupTasks(tasks): { committed, planned }`; `sumConceptRanges(elements): Record<category, {min,max}>`.
  - `optimizeBudget(input): OptimizeResult` with types `OptimizeInput`, `CategoryAllocation`, `BudgetFeedback`, `OptimizeResult`.
  - Zod: `budgetTotalInput`, `avgGiftInput`, `categoryAllocationInput`, `taskAmountInput`, `budgetTemplateInput`, `CATEGORY_OPTIONS`.

- [ ] **Step 1: Write the priority-map test**

`lib/budget/priority-map.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { priorityBoostFor, PRIORITY_BOOST } from './priority-map';

describe('priorityBoostFor', () => {
  it('returns 1 when the category is not a priority', () => {
    expect(priorityBoostFor('VENUE', ['FOOD'])).toBe(1);
  });

  it('boosts the mapped category (FOOD → CATERING)', () => {
    expect(priorityBoostFor('CATERING', ['FOOD'])).toBe(PRIORITY_BOOST);
  });

  it('maps DESIGN to both DESIGN and FLOWERS', () => {
    expect(priorityBoostFor('DESIGN', ['DESIGN'])).toBe(PRIORITY_BOOST);
    expect(priorityBoostFor('FLOWERS', ['DESIGN'])).toBe(PRIORITY_BOOST);
  });

  it('compounds when two priorities hit the same category', () => {
    expect(priorityBoostFor('CATERING', ['FOOD', 'FOOD'])).toBe(PRIORITY_BOOST * PRIORITY_BOOST);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test -- lib/budget/priority-map.test.ts`
Expected: FAIL ("Cannot find module './priority-map'").

- [ ] **Step 3: Implement the priority map**

`lib/budget/priority-map.ts`:

```typescript
import type { Priority, TaskCategory } from '@prisma/client';

/** Each onboarding Priority boosts one or more budget categories. */
export const PRIORITY_CATEGORY_MAP: Record<Priority, TaskCategory[]> = {
  FOOD: ['CATERING'],
  PARTY: ['MUSIC'],
  PHOTOGRAPHY: ['PHOTOGRAPHY'],
  GUEST_EXPERIENCE: ['GUESTS'],
  DESIGN: ['DESIGN', 'FLOWERS'],
  FASHION: ['ATTIRE'],
};

/** Weight multiplier applied once per matched priority. */
export const PRIORITY_BOOST = 1.5;

export function priorityBoostFor(category: TaskCategory, priorities: Priority[]): number {
  let boost = 1;
  for (const p of priorities) {
    if (PRIORITY_CATEGORY_MAP[p]?.includes(category)) boost *= PRIORITY_BOOST;
  }
  return boost;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm run test -- lib/budget/priority-map.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the gifts test**

`lib/budget/gifts.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { estimateGifts } from './gifts';

describe('estimateGifts', () => {
  it('multiplies average by guest count', () => {
    expect(estimateGifts({ avgGiftPerGuest: 500, guestCount: 200, budgetTotal: 150000 }))
      .toEqual({ estimatedGifts: 100000, delta: -50000 });
  });

  it('reports a surplus as a positive delta', () => {
    expect(estimateGifts({ avgGiftPerGuest: 800, guestCount: 200, budgetTotal: 120000 }))
      .toEqual({ estimatedGifts: 160000, delta: 40000 });
  });

  it('returns a null delta when no budget is set', () => {
    expect(estimateGifts({ avgGiftPerGuest: 500, guestCount: 100, budgetTotal: null }))
      .toEqual({ estimatedGifts: 50000, delta: null });
  });

  it('treats missing inputs as zero', () => {
    expect(estimateGifts({ avgGiftPerGuest: null, guestCount: 200, budgetTotal: 100000 }))
      .toEqual({ estimatedGifts: 0, delta: -100000 });
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npm run test -- lib/budget/gifts.test.ts`
Expected: FAIL ("Cannot find module './gifts'").

- [ ] **Step 7: Implement gifts**

`lib/budget/gifts.ts`:

```typescript
export interface GiftEstimate {
  estimatedGifts: number;
  delta: number | null;
}

/** estimatedGifts = avg × count; delta = estimatedGifts − budgetTotal (null if no budget). */
export function estimateGifts(input: {
  avgGiftPerGuest: number | null;
  guestCount: number | null;
  budgetTotal: number | null;
}): GiftEstimate {
  const avg = input.avgGiftPerGuest ?? 0;
  const count = input.guestCount ?? 0;
  const estimatedGifts = Math.max(0, Math.round(avg * count));
  const delta = input.budgetTotal == null ? null : estimatedGifts - input.budgetTotal;
  return { estimatedGifts, delta };
}
```

- [ ] **Step 8: Run it to verify it passes**

Run: `npm run test -- lib/budget/gifts.test.ts`
Expected: PASS.

- [ ] **Step 9: Write the rollup test**

`lib/budget/rollup.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { rollupTasks, sumConceptRanges } from './rollup';

const task = (over: Partial<Parameters<typeof rollupTasks>[0][number]>) => ({
  category: 'MUSIC' as const, status: 'OPEN' as const,
  amountPaid: null as number | null, estimatedCost: null as number | null,
  deletedAt: null as Date | null, ...over,
});

describe('rollupTasks', () => {
  it('sums amountPaid of DONE tasks into committed', () => {
    const { committed } = rollupTasks([
      task({ status: 'DONE', amountPaid: 10000 }),
      task({ status: 'DONE', amountPaid: 2000, category: 'CATERING' }),
    ]);
    expect(committed).toEqual({ MUSIC: 10000, CATERING: 2000 });
  });

  it('ignores amountPaid on OPEN tasks (not yet committed)', () => {
    const { committed } = rollupTasks([task({ status: 'OPEN', amountPaid: 9999 })]);
    expect(committed.MUSIC ?? 0).toBe(0);
  });

  it('sums estimatedCost of OPEN tasks into planned', () => {
    const { planned } = rollupTasks([task({ status: 'OPEN', estimatedCost: 5000 })]);
    expect(planned).toEqual({ MUSIC: 5000 });
  });

  it('excludes soft-deleted tasks from both rollups', () => {
    const { committed, planned } = rollupTasks([
      task({ status: 'DONE', amountPaid: 10000, deletedAt: new Date() }),
      task({ status: 'OPEN', estimatedCost: 5000, deletedAt: new Date() }),
    ]);
    expect(committed).toEqual({});
    expect(planned).toEqual({});
  });
});

describe('sumConceptRanges', () => {
  it('sums min/max per category over active elements, treating null as 0', () => {
    const ranges = sumConceptRanges([
      { category: 'MUSIC', estCostMin: 6000, estCostMax: 14000, active: true },
      { category: 'MUSIC', estCostMin: 4000, estCostMax: 9000, active: true },
      { category: 'DESIGN', estCostMin: null, estCostMax: 5000, active: true },
      { category: 'MUSIC', estCostMin: 1000, estCostMax: 2000, active: false },
    ]);
    expect(ranges).toEqual({
      MUSIC: { min: 10000, max: 23000 },
      DESIGN: { min: 0, max: 5000 },
    });
  });
});
```

- [ ] **Step 10: Run it to verify it fails**

Run: `npm run test -- lib/budget/rollup.test.ts`
Expected: FAIL ("Cannot find module './rollup'").

- [ ] **Step 11: Implement rollup**

`lib/budget/rollup.ts`:

```typescript
import type { TaskCategory } from '@prisma/client';

type RollupTask = {
  category: TaskCategory;
  status: 'OPEN' | 'DONE';
  amountPaid: number | null;
  estimatedCost: number | null;
  deletedAt: Date | null;
};

/** committed = Σ paid on DONE tasks; planned = Σ estimate on OPEN tasks. Soft-deleted excluded. */
export function rollupTasks(tasks: RollupTask[]): {
  committed: Partial<Record<TaskCategory, number>>;
  planned: Partial<Record<TaskCategory, number>>;
} {
  const committed: Partial<Record<TaskCategory, number>> = {};
  const planned: Partial<Record<TaskCategory, number>> = {};
  for (const t of tasks) {
    if (t.deletedAt) continue;
    if (t.status === 'DONE' && t.amountPaid != null) {
      committed[t.category] = (committed[t.category] ?? 0) + t.amountPaid;
    } else if (t.status === 'OPEN' && t.estimatedCost != null) {
      planned[t.category] = (planned[t.category] ?? 0) + t.estimatedCost;
    }
  }
  return { committed, planned };
}

type RangeElement = {
  category: TaskCategory;
  estCostMin: number | null;
  estCostMax: number | null;
  active: boolean;
};

/** Sum the selected concept's active elements into a per-category cost range. */
export function sumConceptRanges(
  elements: RangeElement[],
): Partial<Record<TaskCategory, { min: number; max: number }>> {
  const out: Partial<Record<TaskCategory, { min: number; max: number }>> = {};
  for (const e of elements) {
    if (!e.active) continue;
    const cur = out[e.category] ?? { min: 0, max: 0 };
    cur.min += e.estCostMin ?? 0;
    cur.max += e.estCostMax ?? 0;
    out[e.category] = cur;
  }
  return out;
}
```

- [ ] **Step 12: Run it to verify it passes**

Run: `npm run test -- lib/budget/rollup.test.ts`
Expected: PASS.

- [ ] **Step 13: Write the optimizer test**

`lib/budget/optimize.test.ts`. These inputs are chosen so distribution is exact (no rounding ambiguity) except the dedicated rounding test.

```typescript
import { describe, it, expect } from 'vitest';
import { optimizeBudget, type OptimizeInput } from './optimize';

const base = (over: Partial<OptimizeInput>): OptimizeInput => ({
  budgetTotal: 100000,
  baseline: { VENUE: 50, CATERING: 50 },
  priorities: [],
  conceptRanges: {},
  committed: {},
  pinned: {},
  ...over,
});

function alloc(result: ReturnType<typeof optimizeBudget>, category: string) {
  return result.perCategory.find((p) => p.category === category)!;
}

describe('optimizeBudget', () => {
  it('splits by baseline weight when there are no other signals', () => {
    const r = optimizeBudget(base({}));
    expect(alloc(r, 'VENUE').recommended).toBe(50000);
    expect(alloc(r, 'CATERING').recommended).toBe(50000);
    expect(r.feedback).toEqual({ type: 'ok' });
  });

  it('applies the priority boost (CATERING gets 1.5× weight)', () => {
    // weights VENUE=50, CATERING=50*1.5=75 → total 125 → VENUE 40k, CATERING 60k
    const r = optimizeBudget(base({ priorities: ['FOOD'] }));
    expect(alloc(r, 'VENUE').recommended).toBe(40000);
    expect(alloc(r, 'CATERING').recommended).toBe(60000);
  });

  it('freezes committed money and only redistributes the open remainder', () => {
    // CATERING has 30k committed on DONE tasks. R = 100k − 30k = 70k, split by weight 50/50 → 35k each open.
    const r = optimizeBudget(base({ committed: { CATERING: 30000 } }));
    expect(alloc(r, 'CATERING').committed).toBe(30000);
    expect(alloc(r, 'CATERING').open).toBe(35000);
    expect(alloc(r, 'CATERING').recommended).toBe(65000);
    expect(alloc(r, 'VENUE').recommended).toBe(35000);
  });

  it('excludes a pinned category from redistribution', () => {
    // Pin VENUE at 20k. R = 100k − 20k = 80k over CATERING only → CATERING 80k.
    const r = optimizeBudget(base({ pinned: { VENUE: 20000 } }));
    expect(alloc(r, 'VENUE').recommended).toBe(20000);
    expect(alloc(r, 'VENUE').pinned).toBe(true);
    expect(alloc(r, 'CATERING').recommended).toBe(80000);
  });

  it('renders max(pin, committed) when committed exceeds the pin', () => {
    // Pin VENUE at 20k but 26k already committed there → shows 26k.
    const r = optimizeBudget(base({ pinned: { VENUE: 20000 }, committed: { VENUE: 26000 } }));
    expect(alloc(r, 'VENUE').recommended).toBe(26000);
  });

  it('caps a category at its concept ceiling and redistributes the excess', () => {
    // CATERING capped at 20k max. Weight would give 50k; excess 30k flows to VENUE → VENUE 80k, CATERING 20k.
    const r = optimizeBudget(base({ conceptRanges: { CATERING: { min: 0, max: 20000 } } }));
    expect(alloc(r, 'CATERING').recommended).toBe(20000);
    expect(alloc(r, 'VENUE').recommended).toBe(80000);
  });

  it('reports headroom when every category caps out below the budget', () => {
    const r = optimizeBudget(base({
      budgetTotal: 100000,
      conceptRanges: { VENUE: { min: 0, max: 30000 }, CATERING: { min: 0, max: 30000 } },
    }));
    expect(alloc(r, 'VENUE').recommended).toBe(30000);
    expect(alloc(r, 'CATERING').recommended).toBe(30000);
    expect(r.feedback).toEqual({ type: 'headroom', unallocated: 40000 });
  });

  it('reports over_budget when the concept minimums exceed the budget', () => {
    // Floors 40k + 40k = 80k > R 60k → proportional trim to 30k each, shortfall 20k.
    const r = optimizeBudget(base({
      budgetTotal: 60000,
      conceptRanges: { VENUE: { min: 40000, max: 90000 }, CATERING: { min: 40000, max: 90000 } },
    }));
    expect(r.feedback.type).toBe('over_budget');
    if (r.feedback.type === 'over_budget') {
      expect(r.feedback.shortfall).toBe(20000);
      expect(r.feedback.underfunded.sort()).toEqual(['CATERING', 'VENUE']);
    }
    expect(alloc(r, 'VENUE').recommended).toBe(30000);
    expect(alloc(r, 'CATERING').recommended).toBe(30000);
  });

  it('reports committed_overrun when committed alone exceeds the budget', () => {
    const r = optimizeBudget(base({ budgetTotal: 40000, committed: { VENUE: 30000, CATERING: 20000 } }));
    expect(r.feedback).toEqual({ type: 'committed_overrun', overrun: 10000 });
    // Never produces a negative allocation — each category sits at its committed floor.
    expect(alloc(r, 'VENUE').recommended).toBe(30000);
    expect(alloc(r, 'CATERING').recommended).toBe(20000);
  });

  it('always sums the category recommendations to the budget when feasible (rounding case)', () => {
    // 3-way split of 100000 by equal weight → 33334/33333/33333.
    const r = optimizeBudget(base({
      budgetTotal: 100000,
      baseline: { VENUE: 1, CATERING: 1, MUSIC: 1 },
    }));
    const sum = r.perCategory.reduce((s, p) => s + p.recommended, 0);
    expect(sum).toBe(100000);
  });
});
```

- [ ] **Step 14: Run it to verify it fails**

Run: `npm run test -- lib/budget/optimize.test.ts`
Expected: FAIL ("Cannot find module './optimize'").

- [ ] **Step 15: Implement the optimizer**

`lib/budget/optimize.ts`:

```typescript
import type { Priority, TaskCategory } from '@prisma/client';
import { priorityBoostFor } from './priority-map';

export interface ConceptRange {
  min: number;
  max: number;
}

export interface OptimizeInput {
  budgetTotal: number;
  baseline: Partial<Record<TaskCategory, number>>;
  priorities: Priority[];
  conceptRanges: Partial<Record<TaskCategory, ConceptRange>>;
  committed: Partial<Record<TaskCategory, number>>;
  pinned: Partial<Record<TaskCategory, number>>;
}

export interface CategoryAllocation {
  category: TaskCategory;
  recommended: number;
  committed: number;
  open: number;
  ceiling: number | null;
  pinned: boolean;
}

export type BudgetFeedback =
  | { type: 'ok' }
  | { type: 'committed_overrun'; overrun: number }
  | { type: 'over_budget'; shortfall: number; underfunded: TaskCategory[] }
  | { type: 'headroom'; unallocated: number };

export interface OptimizeResult {
  perCategory: CategoryAllocation[];
  distributable: number;
  feedback: BudgetFeedback;
}

/** Largest-remainder rounding: turn fractional `raw` into ints summing to `total`. */
function roundToTotal(cats: TaskCategory[], raw: Record<string, number>, total: number): Record<string, number> {
  const rows = cats.map((c) => ({ c, floor: Math.floor(raw[c]), frac: raw[c] - Math.floor(raw[c]) }));
  const out: Record<string, number> = {};
  let used = 0;
  for (const r of rows) { out[r.c] = r.floor; used += r.floor; }
  let remainder = total - used;
  rows.sort((a, b) => b.frac - a.frac);
  for (let i = 0; i < rows.length && remainder > 0; i++) { out[rows[i].c] += 1; remainder -= 1; }
  if (remainder < 0) {
    rows.sort((a, b) => a.frac - b.frac);
    for (let i = 0; i < rows.length && remainder < 0; i++) {
      if (out[rows[i].c] > 0) { out[rows[i].c] -= 1; remainder += 1; }
    }
  }
  return out;
}

export function optimizeBudget(input: OptimizeInput): OptimizeResult {
  const { budgetTotal } = input;
  const committed = input.committed ?? {};
  const pinned = input.pinned ?? {};
  const baseline = input.baseline ?? {};
  const conceptRanges = input.conceptRanges ?? {};

  // Category universe: active baseline ∪ committed>0 ∪ pinned (money is never hidden).
  const universe = new Set<TaskCategory>();
  (Object.keys(baseline) as TaskCategory[]).forEach((c) => universe.add(c));
  (Object.keys(committed) as TaskCategory[]).forEach((c) => { if ((committed[c] ?? 0) > 0) universe.add(c); });
  (Object.keys(pinned) as TaskCategory[]).forEach((c) => universe.add(c));

  const com = (c: TaskCategory) => Math.max(0, committed[c] ?? 0);
  const ceilingTotal = (c: TaskCategory): number | null => {
    const r = conceptRanges[c];
    return r ? r.max : null;
  };

  const cats = [...universe];
  const pinnedCats = cats.filter((c) => pinned[c] != null);
  const nonPinned = cats.filter((c) => pinned[c] == null);

  const pinnedAlloc: Record<string, number> = {};
  let sumPinned = 0;
  for (const c of pinnedCats) {
    const v = Math.max(pinned[c] ?? 0, com(c));
    pinnedAlloc[c] = v;
    sumPinned += v;
  }

  const committedNonPinned = nonPinned.reduce((s, c) => s + com(c), 0);
  let R = budgetTotal - sumPinned - committedNonPinned;

  const openInt: Record<string, number> = {};
  for (const c of nonPinned) openInt[c] = 0;
  let feedback: BudgetFeedback = { type: 'ok' };

  if (R < 0) {
    feedback = { type: 'committed_overrun', overrun: sumPinned + committedNonPinned - budgetTotal };
    R = 0;
  } else {
    const floorOpen: Record<string, number> = {};
    const ceilOpen: Record<string, number> = {};
    for (const c of nonPinned) {
      const r = conceptRanges[c];
      const maxAbove = r ? Math.max(0, r.max - com(c)) : Infinity;
      const minAbove = r ? Math.max(0, r.min - com(c)) : 0;
      ceilOpen[c] = maxAbove;
      floorOpen[c] = Math.min(minAbove, maxAbove);
    }
    const sumFloors = nonPinned.reduce((s, c) => s + floorOpen[c], 0);

    if (sumFloors >= R) {
      // Can't fund all concept-minimums → proportional trim to fit R.
      const scale = sumFloors > 0 ? R / sumFloors : 0;
      const raw: Record<string, number> = {};
      for (const c of nonPinned) raw[c] = floorOpen[c] * scale;
      Object.assign(openInt, roundToTotal(nonPinned, raw, R));
      const shortfall = Math.round(sumFloors - R);
      const underfunded = nonPinned.filter((c) => openInt[c] < floorOpen[c] - 0.5);
      feedback = shortfall > 0 ? { type: 'over_budget', shortfall, underfunded } : { type: 'ok' };
    } else {
      // Fund floors, water-fill the leftover by weight, capped at ceilings.
      const openF: Record<string, number> = {};
      for (const c of nonPinned) openF[c] = floorOpen[c];
      let leftover = R - sumFloors;
      const weight: Record<string, number> = {};
      for (const c of nonPinned) weight[c] = (baseline[c] ?? 0) * priorityBoostFor(c, input.priorities);
      const free = new Set(nonPinned.filter((c) => openF[c] < ceilOpen[c] && weight[c] > 0));

      while (leftover > 1e-6 && free.size > 0) {
        const totalW = [...free].reduce((s, c) => s + weight[c], 0);
        if (totalW <= 0) break;
        let capped = false;
        for (const c of [...free]) {
          const share = (leftover * weight[c]) / totalW;
          const room = ceilOpen[c] - openF[c];
          if (share >= room) { openF[c] = ceilOpen[c]; leftover -= room; free.delete(c); capped = true; }
        }
        if (!capped) {
          for (const c of free) openF[c] += (leftover * weight[c]) / totalW;
          leftover = 0;
        }
      }

      const distributed = Math.round(R - leftover);
      Object.assign(openInt, roundToTotal(nonPinned, openF, distributed));
      if (leftover > 0.5) feedback = { type: 'headroom', unallocated: Math.round(leftover) };
    }
  }

  const perCategory: CategoryAllocation[] = [
    ...pinnedCats.map((c): CategoryAllocation => ({
      category: c,
      recommended: pinnedAlloc[c],
      committed: com(c),
      open: Math.max(0, pinnedAlloc[c] - com(c)),
      ceiling: ceilingTotal(c),
      pinned: true,
    })),
    ...nonPinned.map((c): CategoryAllocation => ({
      category: c,
      recommended: com(c) + (openInt[c] ?? 0),
      committed: com(c),
      open: openInt[c] ?? 0,
      ceiling: ceilingTotal(c),
      pinned: false,
    })),
  ];

  return { perCategory, distributable: Math.max(0, R), feedback };
}
```

- [ ] **Step 16: Run it to verify it passes**

Run: `npm run test -- lib/budget/optimize.test.ts`
Expected: PASS (all 11 cases).

- [ ] **Step 17: Write the schema test**

`lib/budget/schema.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { budgetTotalInput, categoryAllocationInput, taskAmountInput, budgetTemplateInput } from './schema';

describe('budget schemas', () => {
  it('accepts a non-negative integer budget and null to clear', () => {
    expect(budgetTotalInput.safeParse({ amount: 150000 }).success).toBe(true);
    expect(budgetTotalInput.safeParse({ amount: null }).success).toBe(true);
  });

  it('rejects a negative or fractional amount', () => {
    expect(budgetTotalInput.safeParse({ amount: -1 }).success).toBe(false);
    expect(taskAmountInput.safeParse({ amount: 10.5 }).success).toBe(false);
  });

  it('validates a category allocation', () => {
    expect(categoryAllocationInput.safeParse({ category: 'MUSIC', amount: 5000 }).success).toBe(true);
    expect(categoryAllocationInput.safeParse({ category: 'NOPE', amount: 5000 }).success).toBe(false);
  });

  it('bounds a template percent to 0..100', () => {
    expect(budgetTemplateInput.safeParse({ defaultPercent: 25, active: true, sortOrder: 10 }).success).toBe(true);
    expect(budgetTemplateInput.safeParse({ defaultPercent: 101, active: true, sortOrder: 10 }).success).toBe(false);
  });
});
```

- [ ] **Step 18: Run it to verify it fails**

Run: `npm run test -- lib/budget/schema.test.ts`
Expected: FAIL ("Cannot find module './schema'").

- [ ] **Step 19: Implement the schemas**

`lib/budget/schema.ts`:

```typescript
import { z } from 'zod';
import { TaskCategory } from '@prisma/client';

export const CATEGORY_OPTIONS = Object.values(TaskCategory);

const amount = z.number().int().min(0).max(100_000_000);

export const budgetTotalInput = z.object({ amount: amount.nullable() });
export const avgGiftInput = z.object({ amount: amount.nullable() });
export const taskAmountInput = z.object({ amount: amount.nullable() });
export const categoryAllocationInput = z.object({
  category: z.nativeEnum(TaskCategory),
  amount,
});
export const budgetTemplateInput = z.object({
  defaultPercent: z.number().int().min(0).max(100),
  active: z.boolean(),
  sortOrder: z.number().int(),
});
```

- [ ] **Step 20: Run it to verify it passes; run the whole budget suite**

Run: `npm run test -- lib/budget`
Expected: all five files PASS.

- [ ] **Step 21: Commit**

```bash
git add lib/budget
git commit -m "feat: add budget domain — priority map, gifts, rollup, optimizer, schemas"
```

---

### Task 3: Couple budget server actions (+ checklist completion amount)

**Files:**
- Create: `lib/actions/budget.ts`, `lib/actions/budget.test.ts`
- Modify: `lib/actions/checklist.ts` (extend `setTaskStatus`), `lib/actions/checklist.test.ts`
- Modify: `lib/concepts/queries.ts` (`elementToTaskPayload` seeds `estimatedCost`), `lib/concepts/queries.test.ts`

**Interfaces:**
- Consumes: `auth` from `@/lib/auth`; `prisma`; `getCurrentWedding` from `@/lib/wedding/queries`; schemas from `@/lib/budget/schema`.
- Produces:
  - `type BudgetActionResult = { ok: true } | { ok: false; error: 'UNAUTHENTICATED' | 'INVALID' | 'NOT_FOUND' }`
  - `setBudgetTotal(amount: number | null)`, `setAvgGiftPerGuest(amount: number | null)`
  - `setCategoryAllocation(category, amount)`, `clearCategoryAllocation(category)`
  - `setTaskAmountPaid(taskId, amount | null)`, `setTaskEstimatedCost(taskId, amount | null)`
  - Extended `setTaskStatus(taskId, done, amountPaid?)` in `checklist.ts`.

- [ ] **Step 1: Write the budget actions test**

`lib/actions/budget.test.ts` — mock in the style of `lib/actions/concepts.test.ts` (read it first for the exact idiom). Cover: unauthenticated rejection; set total/gift happy path; invalid (negative) rejected; pin upsert + clear delete; set task paid/estimate on an owned task; ownership rejection when the task's `weddingId` differs.

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/wedding/queries', () => ({ getCurrentWedding: vi.fn() }));
vi.mock('@/lib/db', () => ({
  prisma: {
    wedding: { update: vi.fn() },
    budgetAllocation: { upsert: vi.fn(), deleteMany: vi.fn() },
    task: { findFirst: vi.fn(), update: vi.fn() },
  },
}));

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getCurrentWedding } from '@/lib/wedding/queries';
import {
  setBudgetTotal, setAvgGiftPerGuest, setCategoryAllocation, clearCategoryAllocation,
  setTaskAmountPaid,
} from './budget';

beforeEach(() => {
  vi.clearAllMocks();
  (auth as unknown as vi.Mock).mockResolvedValue({ user: { id: 'u1' } });
  (getCurrentWedding as unknown as vi.Mock).mockResolvedValue({ id: 'wed1' });
});

describe('setBudgetTotal', () => {
  it('rejects when unauthenticated', async () => {
    (auth as unknown as vi.Mock).mockResolvedValue(null);
    expect(await setBudgetTotal(150000)).toEqual({ ok: false, error: 'UNAUTHENTICATED' });
  });

  it('updates the wedding budget', async () => {
    expect(await setBudgetTotal(150000)).toEqual({ ok: true });
    expect(prisma.wedding.update).toHaveBeenCalledWith({ where: { id: 'wed1' }, data: { budgetTotal: 150000 } });
  });

  it('rejects a negative amount', async () => {
    expect(await setBudgetTotal(-5)).toEqual({ ok: false, error: 'INVALID' });
    expect(prisma.wedding.update).not.toHaveBeenCalled();
  });

  it('accepts null to clear', async () => {
    expect(await setBudgetTotal(null)).toEqual({ ok: true });
    expect(prisma.wedding.update).toHaveBeenCalledWith({ where: { id: 'wed1' }, data: { budgetTotal: null } });
  });
});

describe('setAvgGiftPerGuest', () => {
  it('updates the gift average', async () => {
    expect(await setAvgGiftPerGuest(500)).toEqual({ ok: true });
    expect(prisma.wedding.update).toHaveBeenCalledWith({ where: { id: 'wed1' }, data: { avgGiftPerGuest: 500 } });
  });
});

describe('category allocation (pin)', () => {
  it('upserts a pin', async () => {
    expect(await setCategoryAllocation('MUSIC', 8000)).toEqual({ ok: true });
    expect(prisma.budgetAllocation.upsert).toHaveBeenCalledWith({
      where: { weddingId_category: { weddingId: 'wed1', category: 'MUSIC' } },
      create: { weddingId: 'wed1', category: 'MUSIC', amount: 8000 },
      update: { amount: 8000 },
    });
  });

  it('rejects an unknown category', async () => {
    expect(await setCategoryAllocation('NOPE' as never, 8000)).toEqual({ ok: false, error: 'INVALID' });
  });

  it('clears a pin', async () => {
    expect(await clearCategoryAllocation('MUSIC')).toEqual({ ok: true });
    expect(prisma.budgetAllocation.deleteMany).toHaveBeenCalledWith({ where: { weddingId: 'wed1', category: 'MUSIC' } });
  });
});

describe('setTaskAmountPaid', () => {
  it('updates paid amount on an owned task', async () => {
    (prisma.task.findFirst as vi.Mock).mockResolvedValue({ id: 't1' });
    expect(await setTaskAmountPaid('t1', 10000)).toEqual({ ok: true });
    expect(prisma.task.update).toHaveBeenCalledWith({ where: { id: 't1' }, data: { amountPaid: 10000 } });
  });

  it('rejects a task the couple does not own', async () => {
    (prisma.task.findFirst as vi.Mock).mockResolvedValue(null);
    expect(await setTaskAmountPaid('tX', 10000)).toEqual({ ok: false, error: 'NOT_FOUND' });
    expect(prisma.task.update).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test -- lib/actions/budget.test.ts`
Expected: FAIL ("Cannot find module './budget'").

- [ ] **Step 3: Implement the couple actions**

`lib/actions/budget.ts`:

```typescript
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
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm run test -- lib/actions/budget.test.ts`
Expected: PASS.

- [ ] **Step 5: Extend `setTaskStatus` to capture a paid amount on completion**

In `lib/actions/checklist.ts`, change the `setTaskStatus` signature and body (lines 37–49) to accept an optional `amountPaid`, applied only when completing:

```typescript
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
  const paid =
    done && amountPaid !== undefined && amountPaid !== null
      ? Math.trunc(amountPaid)
      : undefined;
  if (paid !== undefined && (!Number.isInteger(paid) || paid < 0)) {
    return { ok: false, error: 'INVALID' };
  }
  await prisma.task.update({
    where: { id: task.id },
    data: done
      ? { status: 'DONE', completedAt: new Date(), ...(paid !== undefined ? { amountPaid: paid } : {}) }
      : { status: 'OPEN', completedAt: null },
  });
  return { ok: true };
}
```

Note: `ActionResult` in `checklist.ts` already includes `'INVALID'`; if it does not, add it to the union at `lib/actions/checklist.ts:9`.

- [ ] **Step 6: Add a checklist test for the new param**

Append to `lib/actions/checklist.test.ts` (match the file's existing mocking idiom — read it first):

```typescript
describe('setTaskStatus with amountPaid', () => {
  it('records the paid amount when completing', async () => {
    // (arrange an owned task per this file's existing helpers)
    const r = await setTaskStatus('t1', true, 10000);
    expect(r).toEqual({ ok: true });
    expect(prisma.task.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'DONE', amountPaid: 10000 }),
    }));
  });

  it('ignores a paid amount when re-opening', async () => {
    const r = await setTaskStatus('t1', false, 10000);
    expect(r).toEqual({ ok: true });
    expect(prisma.task.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.not.objectContaining({ amountPaid: expect.anything() }),
    }));
  });

  it('skips amount capture when none is provided', async () => {
    const r = await setTaskStatus('t1', true);
    expect(r).toEqual({ ok: true });
    expect(prisma.task.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.not.objectContaining({ amountPaid: expect.anything() }),
    }));
  });
});
```

- [ ] **Step 7: Seed `estimatedCost` when pushing a concept idea to the checklist**

In `lib/concepts/queries.ts`, update `elementToTaskPayload` so a pushed idea carries an estimated cost = midpoint of its range (when both bounds exist). Add `estCostMin`/`estCostMax` to the `Pick` type and set `estimatedCost`:

```typescript
export function elementToTaskPayload(
  weddingId: string,
  element: Pick<ConceptElement, 'id' | 'title_en' | 'title_he' | 'titleLocale' | 'category' | 'estCostMin' | 'estCostMax'>,
  sortOrder: number,
): Prisma.TaskUncheckedCreateInput {
  const estimatedCost =
    element.estCostMin != null && element.estCostMax != null
      ? Math.round((element.estCostMin + element.estCostMax) / 2)
      : (element.estCostMin ?? element.estCostMax ?? null);
  return {
    weddingId,
    title_en: element.title_en,
    title_he: element.title_he,
    titleLocale: element.titleLocale,
    category: element.category,
    dueOffsetDays: null,
    isCustom: true,
    sourceConceptElementId: element.id,
    estimatedCost,
    sortOrder,
  };
}
```

In `lib/concepts/queries.test.ts`, extend the `elementToTaskPayload` fixture with `estCostMin: 6000, estCostMax: 14000` and assert `estimatedCost: 10000` in the `toMatchObject`.

- [ ] **Step 8: Run the affected suites, typecheck & lint**

Run: `npm run test -- lib/actions/budget.test.ts lib/actions/checklist.test.ts lib/concepts/queries.test.ts && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add lib/actions/budget.ts lib/actions/budget.test.ts lib/actions/checklist.ts lib/actions/checklist.test.ts lib/concepts/queries.ts lib/concepts/queries.test.ts
git commit -m "feat: add couple budget actions; capture paid amount on task completion; seed pushed-idea estimate"
```

---

### Task 4: Admin budget-template server actions

**Files:**
- Create: `lib/actions/admin-budget.ts`, `lib/actions/admin-budget.test.ts`

**Interfaces:**
- Consumes: `auth`, `prisma`; `budgetTemplateInput` from `@/lib/budget/schema`.
- Produces:
  - `type AdminResult = { ok: true; id?: string } | { ok: false; error: 'FORBIDDEN' | 'INVALID' | 'NOT_FOUND' }`
  - `updateBudgetTemplate(category, input)`, `setBudgetTemplateActive(category, active)`, `reorderBudgetTemplate(category, sortOrder)`.

- [ ] **Step 1: Write the admin actions test**

`lib/actions/admin-budget.test.ts` — mirror `lib/actions/admin-concepts.test.ts` (read it first for the `requireAdmin` mocking idiom). Include the **parametrized non-admin `FORBIDDEN`** check across every export (the Phase 4 hardening pattern).

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/db', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    budgetTemplate: { findUnique: vi.fn(), update: vi.fn() },
  },
}));

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import * as adminBudget from './admin-budget';
import { updateBudgetTemplate, setBudgetTemplateActive, reorderBudgetTemplate } from './admin-budget';

function asAdmin(isAdmin: boolean) {
  (auth as unknown as vi.Mock).mockResolvedValue(isAdmin ? { user: { id: 'a1' } } : null);
  (prisma.user.findUnique as vi.Mock).mockResolvedValue(isAdmin ? { role: 'ADMIN' } : { role: 'USER' });
}

beforeEach(() => vi.clearAllMocks());

describe('admin gate', () => {
  const calls: Record<string, () => Promise<unknown>> = {
    updateBudgetTemplate: () => updateBudgetTemplate('MUSIC', { defaultPercent: 10, active: true, sortOrder: 10 }),
    setBudgetTemplateActive: () => setBudgetTemplateActive('MUSIC', false),
    reorderBudgetTemplate: () => reorderBudgetTemplate('MUSIC', 5),
  };

  it('exports exactly the gated actions covered here', () => {
    expect(Object.keys(adminBudget).sort()).toEqual(Object.keys(calls).sort());
  });

  it.each(Object.entries(calls))('%s rejects a non-admin', async (_name, call) => {
    asAdmin(false);
    expect(await call()).toEqual({ ok: false, error: 'FORBIDDEN' });
  });
});

describe('updateBudgetTemplate', () => {
  it('updates for an admin', async () => {
    asAdmin(true);
    (prisma.budgetTemplate.findUnique as vi.Mock).mockResolvedValue({ id: 'bt1' });
    const r = await updateBudgetTemplate('MUSIC', { defaultPercent: 12, active: true, sortOrder: 40 });
    expect(r).toEqual({ ok: true });
    expect(prisma.budgetTemplate.update).toHaveBeenCalledWith({
      where: { category: 'MUSIC' }, data: { defaultPercent: 12, active: true, sortOrder: 40 },
    });
  });

  it('rejects invalid input', async () => {
    asAdmin(true);
    expect(await updateBudgetTemplate('MUSIC', { defaultPercent: 200, active: true, sortOrder: 40 }))
      .toEqual({ ok: false, error: 'INVALID' });
  });

  it('returns NOT_FOUND for an unseeded category row', async () => {
    asAdmin(true);
    (prisma.budgetTemplate.findUnique as vi.Mock).mockResolvedValue(null);
    expect(await updateBudgetTemplate('MUSIC', { defaultPercent: 12, active: true, sortOrder: 40 }))
      .toEqual({ ok: false, error: 'NOT_FOUND' });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test -- lib/actions/admin-budget.test.ts`
Expected: FAIL ("Cannot find module './admin-budget'").

- [ ] **Step 3: Implement the admin actions**

`lib/actions/admin-budget.ts`:

```typescript
'use server';

import type { TaskCategory } from '@prisma/client';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { budgetTemplateInput } from '@/lib/budget/schema';

export type AdminResult =
  | { ok: true; id?: string }
  | { ok: false; error: 'FORBIDDEN' | 'INVALID' | 'NOT_FOUND' };

async function requireAdmin(): Promise<string | null> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (user?.role !== 'ADMIN') return null;
  return userId;
}

export async function updateBudgetTemplate(category: TaskCategory, input: unknown): Promise<AdminResult> {
  if (!(await requireAdmin())) return { ok: false, error: 'FORBIDDEN' };
  const parsed = budgetTemplateInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'INVALID' };
  const existing = await prisma.budgetTemplate.findUnique({ where: { category }, select: { id: true } });
  if (!existing) return { ok: false, error: 'NOT_FOUND' };
  await prisma.budgetTemplate.update({ where: { category }, data: parsed.data });
  return { ok: true };
}

export async function setBudgetTemplateActive(category: TaskCategory, active: boolean): Promise<AdminResult> {
  if (!(await requireAdmin())) return { ok: false, error: 'FORBIDDEN' };
  const existing = await prisma.budgetTemplate.findUnique({ where: { category }, select: { id: true } });
  if (!existing) return { ok: false, error: 'NOT_FOUND' };
  await prisma.budgetTemplate.update({ where: { category }, data: { active } });
  return { ok: true };
}

export async function reorderBudgetTemplate(category: TaskCategory, sortOrder: number): Promise<AdminResult> {
  if (!(await requireAdmin())) return { ok: false, error: 'FORBIDDEN' };
  if (!Number.isInteger(sortOrder)) return { ok: false, error: 'INVALID' };
  const existing = await prisma.budgetTemplate.findUnique({ where: { category }, select: { id: true } });
  if (!existing) return { ok: false, error: 'NOT_FOUND' };
  await prisma.budgetTemplate.update({ where: { category }, data: { sortOrder } });
  return { ok: true };
}
```

- [ ] **Step 4: Run it to verify it passes; typecheck & lint**

Run: `npm run test -- lib/actions/admin-budget.test.ts && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/actions/admin-budget.ts lib/actions/admin-budget.test.ts
git commit -m "feat: add admin budget-template actions (live-DB admin-gated)"
```

---

### Task 5: Proxy login-gate + i18n message namespaces

**Files:**
- Modify: `lib/auth/authorize.ts:7`, `lib/auth/authorize.test.ts`
- Modify: `messages/he.json`, `messages/en.json`

**Interfaces:**
- Produces: `/budget` login-gated; `Budget` + `AdminBudget` i18n namespaces; extended `Dashboard` + `Checklist` keys.

- [ ] **Step 1: Add `/budget` to the app login-gate**

In `lib/auth/authorize.ts`, line 7, add `'/budget'` to `APP_PREFIXES`:

```typescript
const APP_PREFIXES = ['/dashboard', '/onboarding', '/settings', '/checklist', '/concepts', '/budget'];
```

- [ ] **Step 2: Assert `/budget` is gated**

In `lib/auth/authorize.test.ts`, add two assertions alongside the existing `/concepts` gate tests (the file calls `authorizeRoute({ pathname, isLoggedIn, role })` directly):

```typescript
it('redirects logged-out users away from /budget', () => {
  expect(authorizeRoute({ pathname: '/budget', isLoggedIn: false, role: null }))
    .toEqual({ type: 'redirect', to: '/login' });
});

it('allows logged-in users to reach /budget', () => {
  expect(authorizeRoute({ pathname: '/budget', isLoggedIn: true, role: 'USER' }))
    .toEqual({ type: 'next' });
});
```

- [ ] **Step 3: Run the authorize test**

Run: `npm run test -- lib/auth/authorize.test.ts`
Expected: PASS.

- [ ] **Step 4: Add the `Budget` and `AdminBudget` namespaces (English)**

In `messages/en.json`, add these namespaces (place near `Concepts`/`AdminConcepts`). Also add the new `Dashboard` and `Checklist` keys shown.

```json
"Budget": {
  "title": "Budget",
  "subtitle": "Plan and optimize your wedding budget",
  "totalLabel": "Total budget",
  "setTotalCta": "Set budget",
  "editTotalCta": "Edit",
  "noBudget": "Set a total budget to see your category plan.",
  "save": "Save",
  "cancel": "Cancel",
  "currencySymbol": "₪",
  "giftTitle": "Estimated gifts",
  "giftAvgLabel": "Average gift per guest",
  "giftGuestsLabel": "Guests",
  "giftTotalLabel": "Estimated gift total",
  "giftSurplus": "Estimated surplus",
  "giftShortfall": "Estimated shortfall",
  "giftNeedsGuests": "Add a guest count in your wedding profile to estimate gifts.",
  "breakdownTitle": "Category plan",
  "recommended": "Recommended",
  "committed": "Committed",
  "open": "Open",
  "pinCta": "Pin",
  "pinnedLabel": "Pinned",
  "unpinCta": "Unpin",
  "overBudget": "Your plan is over budget by {amount}. Underfunded: {categories}.",
  "headroom": "You have {amount} unallocated.",
  "committedOverrun": "You've already committed {amount} over your total budget.",
  "spentAbovePin": "Spent above your pinned amount here.",
  "taskPaidLabel": "Paid",
  "taskEstimateLabel": "Estimated",
  "error": "Something went wrong. Please try again."
},
"AdminBudget": {
  "title": "Budget Baseline",
  "subtitle": "Default percentage split applied to every couple's budget",
  "categoryLabel": "Category",
  "percentLabel": "Percent",
  "activeLabel": "Active",
  "orderLabel": "Order",
  "sumOk": "Active percentages total {sum}%.",
  "sumWarn": "Active percentages total {sum}% (should be 100%).",
  "save": "Save",
  "error": "Something went wrong. Please try again."
}
```

Add to the existing `Dashboard` namespace:

```json
"budgetTitle": "Plan your budget",
"budgetBody": "Set a total and let us split it across your categories.",
"budgetCta": "Open budget",
"budgetSummary": "Budget: {committed} committed of {total}"
```

Add to the existing `Checklist` namespace:

```json
"paidPrompt": "How much did you pay? (optional)",
"paidSkip": "Skip",
"paidSave": "Save",
"paidLabel": "Paid {amount}"
```

- [ ] **Step 5: Add the same namespaces (Hebrew)**

In `messages/he.json`, add the parallel Hebrew translations:

```json
"Budget": {
  "title": "תקציב",
  "subtitle": "תכננו ומטבו את תקציב החתונה",
  "totalLabel": "תקציב כולל",
  "setTotalCta": "הגדרת תקציב",
  "editTotalCta": "עריכה",
  "noBudget": "הגדירו תקציב כולל כדי לראות את חלוקת הקטגוריות.",
  "save": "שמירה",
  "cancel": "ביטול",
  "currencySymbol": "₪",
  "giftTitle": "מתנות משוערות",
  "giftAvgLabel": "מתנה ממוצעת לאורח",
  "giftGuestsLabel": "אורחים",
  "giftTotalLabel": "סך המתנות המשוער",
  "giftSurplus": "עודף משוער",
  "giftShortfall": "גירעון משוער",
  "giftNeedsGuests": "הוסיפו מספר אורחים בפרופיל החתונה כדי לחשב מתנות.",
  "breakdownTitle": "חלוקת קטגוריות",
  "recommended": "מומלץ",
  "committed": "שולם",
  "open": "פנוי",
  "pinCta": "קיבוע",
  "pinnedLabel": "מקובע",
  "unpinCta": "ביטול קיבוע",
  "overBudget": "התוכנית חורגת מהתקציב ב-{amount}. בתת-מימון: {categories}.",
  "headroom": "נותרו {amount} לא מוקצים.",
  "committedOverrun": "כבר שולמו {amount} מעל התקציב הכולל.",
  "spentAbovePin": "שולם כאן מעל הסכום המקובע.",
  "taskPaidLabel": "שולם",
  "taskEstimateLabel": "הערכה",
  "error": "משהו השתבש. נסו שוב."
},
"AdminBudget": {
  "title": "בסיס תקציב",
  "subtitle": "חלוקת ברירת המחדל באחוזים לכל זוג",
  "categoryLabel": "קטגוריה",
  "percentLabel": "אחוז",
  "activeLabel": "פעיל",
  "orderLabel": "סדר",
  "sumOk": "סך האחוזים הפעילים {sum}%.",
  "sumWarn": "סך האחוזים הפעילים {sum}% (צריך להיות 100%).",
  "save": "שמירה",
  "error": "משהו השתבש. נסו שוב."
}
```

Add to the Hebrew `Dashboard`:

```json
"budgetTitle": "תכננו את התקציב",
"budgetBody": "הגדירו סכום כולל ואנחנו נחלק אותו בין הקטגוריות.",
"budgetCta": "פתחו תקציב",
"budgetSummary": "תקציב: {committed} שולמו מתוך {total}"
```

Add to the Hebrew `Checklist`:

```json
"paidPrompt": "כמה שילמתם? (אופציונלי)",
"paidSkip": "דילוג",
"paidSave": "שמירה",
"paidLabel": "שולם {amount}"
```

- [ ] **Step 6: Verify both message files parse and stay in sync**

Run: `npm run test && npm run lint`
Expected: PASS (the repo's i18n key-parity check, if present, passes; JSON is valid).

- [ ] **Step 7: Commit**

```bash
git add lib/auth/authorize.ts lib/auth/authorize.test.ts messages/he.json messages/en.json
git commit -m "feat: login-gate /budget and add Budget/AdminBudget i18n namespaces"
```

---

### Task 6: Couple UI — /budget page + checklist completion popup

**Files:**
- Create: `app/[locale]/(app)/budget/page.tsx`, `budget-view.tsx`, `budget-total-card.tsx`, `gift-estimator-card.tsx`, `category-breakdown.tsx`, `budget-view.test.tsx`
- Modify: `app/[locale]/(app)/checklist/checklist-view.tsx`, `checklist/page.tsx`, `checklist/task-row.tsx`

**Interfaces:**
- Consumes: `optimizeBudget`, `rollupTasks`, `sumConceptRanges`, `estimateGifts` from `@/lib/budget/*`; the couple actions from `@/lib/actions/budget`; `TaskCategory` labels via the existing `TaskCategory` i18n namespace.
- Produces: the `/budget` route and the serialized `BudgetCategory` view type consumed by `category-breakdown.tsx`.

**Intentional scope note (not a gap):** the category breakdown is **category-level** (recommended/committed/open + pin). Per-task paid amounts are captured and shown on `/checklist` (the completion popup + paid badge from Task 3/Step 2 below), which is what "shows on the task and rolls into the category committed total" (acceptance criterion 3) requires. `setTaskEstimatedCost` is implemented as an action (Task 3) and reserved as the API for a future in-budget per-task editor; it is intentionally not wired into UI this phase. Do not add per-task rows inside the breakdown — that is deferred.

- [ ] **Step 1: Thread the two new fields through the checklist serialization**

In `app/[locale]/(app)/checklist/checklist-view.tsx`, add to the `SerializedTask` interface (after `notes`):

```typescript
  estimatedCost: number | null;
  amountPaid: number | null;
```

In `app/[locale]/(app)/checklist/page.tsx`, add to `serializeTask` (after `notes: task.notes,`):

```typescript
    estimatedCost: task.estimatedCost,
    amountPaid: task.amountPaid,
```

- [ ] **Step 2: Add the skippable paid-amount prompt to `task-row.tsx`**

In `app/[locale]/(app)/checklist/task-row.tsx`, replace `handleToggleDone` so that completing a task opens an inline paid-amount prompt instead of immediately toggling; re-opening still toggles directly. Add state and a small inline form. Full changes:

Add state near the other `useState` calls:

```typescript
  const [askingPaid, setAskingPaid] = useState(false);
  const [paidInput, setPaidInput] = useState('');
```

Replace `handleToggleDone` with:

```typescript
  async function completeWith(amountPaid: number | null) {
    setError(false);
    setPending(true);
    const result = await setTaskStatus(task.id, true, amountPaid);
    setPending(false);
    setAskingPaid(false);
    setPaidInput('');
    if (!result.ok) { setError(true); return; }
    onChanged();
  }

  async function handleToggleDone() {
    if (!done) { setAskingPaid(true); return; }
    setError(false);
    setPending(true);
    const result = await setTaskStatus(task.id, false);
    setPending(false);
    if (!result.ok) { setError(true); return; }
    onChanged();
  }
```

In the row's JSX (the non-editing return), after the category/priority spans block, add the prompt and the paid badge:

```tsx
      {askingPaid ? (
        <div className="flex flex-wrap items-center gap-2 rounded-card bg-background p-2">
          <label className="text-xs text-muted" htmlFor={`paid-${task.id}`}>
            {t('paidPrompt')}
          </label>
          <input
            id={`paid-${task.id}`}
            type="number"
            min="0"
            dir="ltr"
            value={paidInput}
            onChange={(e) => setPaidInput(e.target.value)}
            className="w-28 rounded-card border border-muted/30 bg-surface px-2 py-1 text-sm text-text"
          />
          <button
            type="button"
            disabled={pending}
            onClick={() => completeWith(paidInput === '' ? null : Math.trunc(Number(paidInput)))}
            className="rounded-card bg-primary px-3 py-1 text-sm text-background disabled:opacity-60"
          >
            {t('paidSave')}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => completeWith(null)}
            className="rounded-card border border-muted/30 px-3 py-1 text-sm text-text"
          >
            {t('paidSkip')}
          </button>
        </div>
      ) : null}

      {done && task.amountPaid != null ? (
        <span className="text-xs text-muted">
          {t('paidLabel', { amount: `₪${task.amountPaid.toLocaleString(locale)}` })}
        </span>
      ) : null}
```

- [ ] **Step 3: Run the checklist component tests**

Run: `npm run test -- app/[locale]/(app)/checklist`
Expected: PASS (existing tests still pass; the toggle now opens the prompt — update any existing assertion that expected an immediate toggle-to-done to first click the checkbox then the "Skip" button).

- [ ] **Step 4: Write the budget view component test**

`app/[locale]/(app)/budget/budget-view.test.tsx` — render with `NextIntlClientProvider` (read `app/[locale]/(app)/concepts/concepts-view.test.tsx` for the exact provider setup). Assert: over-budget banner renders from feedback; a category shows recommended/committed/open; the gift delta shows surplus vs shortfall wording.

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';
import { BudgetView } from './budget-view';

function renderView(props: Parameters<typeof BudgetView>[0]) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <BudgetView {...props} />
    </NextIntlClientProvider>,
  );
}

const baseProps = {
  locale: 'en',
  budgetTotal: 100000,
  avgGiftPerGuest: 500,
  guestCount: 200,
  categories: [
    { category: 'VENUE' as const, recommended: 50000, committed: 0, open: 50000, ceiling: null, pinned: false },
    { category: 'CATERING' as const, recommended: 50000, committed: 20000, open: 30000, ceiling: null, pinned: false },
  ],
  feedback: { type: 'ok' as const },
  gift: { estimatedGifts: 100000, delta: 0 },
};

describe('BudgetView', () => {
  it('renders category rows with committed amounts', () => {
    renderView(baseProps);
    expect(screen.getByText('VENUE')).toBeTruthy();
    expect(screen.getAllByText(/committed/i).length).toBeGreaterThan(0);
  });

  it('shows an over-budget banner', () => {
    renderView({ ...baseProps, feedback: { type: 'over_budget', shortfall: 20000, underfunded: ['VENUE'] } });
    expect(screen.getByText(/over budget/i)).toBeTruthy();
  });

  it('labels a shortfall when gifts are below budget', () => {
    renderView({ ...baseProps, gift: { estimatedGifts: 80000, delta: -20000 } });
    expect(screen.getByText(/shortfall/i)).toBeTruthy();
  });
});
```

- [ ] **Step 5: Run it to verify it fails**

Run: `npm run test -- app/[locale]/(app)/budget/budget-view.test.tsx`
Expected: FAIL ("Cannot find module './budget-view'").

- [ ] **Step 6: Implement the page loader**

`app/[locale]/(app)/budget/page.tsx`:

```tsx
import { setRequestLocale } from 'next-intl/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getCurrentWedding } from '@/lib/wedding/queries';
import { redirect } from '@/lib/i18n/navigation';
import { rollupTasks, sumConceptRanges } from '@/lib/budget/rollup';
import { optimizeBudget } from '@/lib/budget/optimize';
import { estimateGifts } from '@/lib/budget/gifts';
import { BudgetView } from './budget-view';

export default async function BudgetPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user?.id) redirect({ href: '/login', locale });
  const wedding = await getCurrentWedding(session!.user.id);
  if (!wedding) redirect({ href: '/onboarding', locale });

  const [tasks, allocations, baselineRows, selectedConcept] = await Promise.all([
    prisma.task.findMany({
      where: { weddingId: wedding!.id, deletedAt: null },
      select: { category: true, status: true, amountPaid: true, estimatedCost: true, deletedAt: true },
    }),
    prisma.budgetAllocation.findMany({ where: { weddingId: wedding!.id } }),
    prisma.budgetTemplate.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } }),
    wedding!.selectedConceptId
      ? prisma.concept.findUnique({
          where: { id: wedding!.selectedConceptId },
          include: { elements: { where: { active: true } } },
        })
      : Promise.resolve(null),
  ]);

  const { committed } = rollupTasks(tasks);
  const conceptRanges = selectedConcept ? sumConceptRanges(selectedConcept.elements) : {};
  const baseline = Object.fromEntries(baselineRows.map((b) => [b.category, b.defaultPercent]));
  const pinned = Object.fromEntries(allocations.map((a) => [a.category, a.amount]));

  const result =
    wedding!.budgetTotal != null
      ? optimizeBudget({
          budgetTotal: wedding!.budgetTotal,
          baseline,
          priorities: wedding!.priorities,
          conceptRanges,
          committed,
          pinned,
        })
      : null;

  const gift = estimateGifts({
    avgGiftPerGuest: wedding!.avgGiftPerGuest,
    guestCount: wedding!.guestCount,
    budgetTotal: wedding!.budgetTotal,
  });

  return (
    <main className="mx-auto w-full max-w-3xl p-6 sm:p-8">
      <BudgetView
        locale={locale}
        budgetTotal={wedding!.budgetTotal}
        avgGiftPerGuest={wedding!.avgGiftPerGuest}
        guestCount={wedding!.guestCount}
        categories={result?.perCategory ?? []}
        feedback={result?.feedback ?? { type: 'ok' }}
        gift={gift}
      />
    </main>
  );
}
```

- [ ] **Step 7: Implement `budget-view.tsx` (client shell)**

`app/[locale]/(app)/budget/budget-view.tsx`:

```tsx
'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from '@/lib/i18n/navigation';
import type { CategoryAllocation, BudgetFeedback } from '@/lib/budget/optimize';
import type { GiftEstimate } from '@/lib/budget/gifts';
import { BudgetTotalCard } from './budget-total-card';
import { GiftEstimatorCard } from './gift-estimator-card';
import { CategoryBreakdown } from './category-breakdown';

interface BudgetViewProps {
  locale: string;
  budgetTotal: number | null;
  avgGiftPerGuest: number | null;
  guestCount: number | null;
  categories: CategoryAllocation[];
  feedback: BudgetFeedback;
  gift: GiftEstimate;
}

export function BudgetView(props: BudgetViewProps) {
  const t = useTranslations('Budget');
  const tCategory = useTranslations('TaskCategory');
  const router = useRouter();
  const refresh = () => router.refresh();

  const fmt = (n: number) => `₪${n.toLocaleString(props.locale)}`;

  function feedbackBanner() {
    const f = props.feedback;
    if (f.type === 'over_budget') {
      return t('overBudget', {
        amount: fmt(f.shortfall),
        categories: f.underfunded.map((c) => tCategory(c)).join(', '),
      });
    }
    if (f.type === 'headroom') return t('headroom', { amount: fmt(f.unallocated) });
    if (f.type === 'committed_overrun') return t('committedOverrun', { amount: fmt(f.overrun) });
    return null;
  }

  const banner = feedbackBanner();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-2xl text-text">{t('title')}</h1>
        <p className="font-body text-sm text-muted">{t('subtitle')}</p>
      </header>

      <BudgetTotalCard locale={props.locale} budgetTotal={props.budgetTotal} onChanged={refresh} />

      <GiftEstimatorCard
        locale={props.locale}
        avgGiftPerGuest={props.avgGiftPerGuest}
        guestCount={props.guestCount}
        gift={props.gift}
        onChanged={refresh}
      />

      {banner ? (
        <p className="rounded-card bg-accent/20 p-4 text-sm text-text">{banner}</p>
      ) : null}

      {props.budgetTotal == null ? (
        <p className="rounded-card bg-surface p-6 text-center text-sm text-muted shadow-sm">{t('noBudget')}</p>
      ) : (
        <CategoryBreakdown locale={props.locale} categories={props.categories} onChanged={refresh} />
      )}
    </div>
  );
}
```

- [ ] **Step 8: Implement `budget-total-card.tsx`**

`app/[locale]/(app)/budget/budget-total-card.tsx` — inline-editable total calling `setBudgetTotal`:

```tsx
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { setBudgetTotal } from '@/lib/actions/budget';

export function BudgetTotalCard({
  locale, budgetTotal, onChanged,
}: { locale: string; budgetTotal: number | null; onChanged: () => void }) {
  const t = useTranslations('Budget');
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(budgetTotal != null ? String(budgetTotal) : '');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  async function save() {
    setError(false);
    setPending(true);
    const amount = value === '' ? null : Math.trunc(Number(value));
    const result = await setBudgetTotal(amount);
    setPending(false);
    if (!result.ok) { setError(true); return; }
    setEditing(false);
    onChanged();
  }

  return (
    <section className="rounded-card bg-surface p-5 shadow-sm">
      <h2 className="font-display text-lg text-text">{t('totalLabel')}</h2>
      {editing ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            type="number" min="0" dir="ltr" value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-40 rounded-card border border-muted/30 bg-background px-3 py-2 text-sm text-text"
          />
          <button type="button" disabled={pending} onClick={save}
            className="rounded-card bg-primary px-3 py-1.5 text-sm text-background disabled:opacity-60">
            {t('save')}
          </button>
          <button type="button" disabled={pending} onClick={() => setEditing(false)}
            className="rounded-card border border-muted/30 px-3 py-1.5 text-sm text-text">
            {t('cancel')}
          </button>
          {error ? <span className="text-sm text-red-600">{t('error')}</span> : null}
        </div>
      ) : (
        <div className="mt-2 flex items-center gap-3">
          <span className="text-xl text-text">
            {budgetTotal != null ? `₪${budgetTotal.toLocaleString(locale)}` : '—'}
          </span>
          <button type="button" onClick={() => setEditing(true)} className="text-sm text-primary">
            {budgetTotal != null ? t('editTotalCta') : t('setTotalCta')}
          </button>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 9: Implement `gift-estimator-card.tsx`**

`app/[locale]/(app)/budget/gift-estimator-card.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { GiftEstimate } from '@/lib/budget/gifts';
import { setAvgGiftPerGuest } from '@/lib/actions/budget';

export function GiftEstimatorCard({
  locale, avgGiftPerGuest, guestCount, gift, onChanged,
}: {
  locale: string; avgGiftPerGuest: number | null; guestCount: number | null;
  gift: GiftEstimate; onChanged: () => void;
}) {
  const t = useTranslations('Budget');
  const [value, setValue] = useState(avgGiftPerGuest != null ? String(avgGiftPerGuest) : '');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const fmt = (n: number) => `₪${n.toLocaleString(locale)}`;

  async function save() {
    setError(false);
    setPending(true);
    const amount = value === '' ? null : Math.trunc(Number(value));
    const result = await setAvgGiftPerGuest(amount);
    setPending(false);
    if (!result.ok) { setError(true); return; }
    onChanged();
  }

  return (
    <section className="rounded-card bg-surface p-5 shadow-sm">
      <h2 className="font-display text-lg text-text">{t('giftTitle')}</h2>
      {guestCount == null ? (
        <p className="mt-1 text-sm text-muted">{t('giftNeedsGuests')}</p>
      ) : (
        <div className="mt-2 flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm text-muted" htmlFor="gift-avg">{t('giftAvgLabel')}</label>
            <input
              id="gift-avg" type="number" min="0" dir="ltr" value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-32 rounded-card border border-muted/30 bg-background px-3 py-2 text-sm text-text"
            />
            <button type="button" disabled={pending} onClick={save}
              className="rounded-card bg-primary px-3 py-1.5 text-sm text-background disabled:opacity-60">
              {t('save')}
            </button>
          </div>
          <p className="text-sm text-muted">
            {t('giftGuestsLabel')}: {guestCount} · {t('giftTotalLabel')}: {fmt(gift.estimatedGifts)}
          </p>
          {gift.delta != null ? (
            <p className="text-sm text-text">
              {gift.delta >= 0
                ? `${t('giftSurplus')}: ${fmt(gift.delta)}`
                : `${t('giftShortfall')}: ${fmt(Math.abs(gift.delta))}`}
            </p>
          ) : null}
          {error ? <span className="text-sm text-red-600">{t('error')}</span> : null}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 10: Implement `category-breakdown.tsx`**

`app/[locale]/(app)/budget/category-breakdown.tsx` — per-category rows with recommended/committed/open and a pin/unpin control:

```tsx
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { CategoryAllocation } from '@/lib/budget/optimize';
import { setCategoryAllocation, clearCategoryAllocation } from '@/lib/actions/budget';

export function CategoryBreakdown({
  locale, categories, onChanged,
}: { locale: string; categories: CategoryAllocation[]; onChanged: () => void }) {
  const t = useTranslations('Budget');
  const tCategory = useTranslations('TaskCategory');
  const fmt = (n: number) => `₪${n.toLocaleString(locale)}`;
  const [pinningCategory, setPinningCategory] = useState<string | null>(null);
  const [pinValue, setPinValue] = useState('');
  const [pending, setPending] = useState(false);

  async function savePin(category: string) {
    setPending(true);
    const amount = pinValue === '' ? 0 : Math.trunc(Number(pinValue));
    const result = await setCategoryAllocation(category as never, amount);
    setPending(false);
    if (result.ok) { setPinningCategory(null); setPinValue(''); onChanged(); }
  }

  async function unpin(category: string) {
    setPending(true);
    const result = await clearCategoryAllocation(category as never);
    setPending(false);
    if (result.ok) onChanged();
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-lg text-text">{t('breakdownTitle')}</h2>
      {categories.map((c) => (
        <div key={c.category} className="flex flex-col gap-2 rounded-card bg-surface p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium text-text">{tCategory(c.category)}</span>
            <span className="text-sm text-text">{fmt(c.recommended)}</span>
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-muted">
            <span>{t('committed')}: {fmt(c.committed)}</span>
            <span>{t('open')}: {fmt(c.open)}</span>
            {c.pinned ? <span className="text-primary">{t('pinnedLabel')}</span> : null}
          </div>
          {pinningCategory === c.category ? (
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="number" min="0" dir="ltr" value={pinValue}
                onChange={(e) => setPinValue(e.target.value)}
                className="w-32 rounded-card border border-muted/30 bg-background px-2 py-1 text-sm text-text"
              />
              <button type="button" disabled={pending} onClick={() => savePin(c.category)}
                className="rounded-card bg-primary px-3 py-1 text-sm text-background disabled:opacity-60">
                {t('save')}
              </button>
              <button type="button" disabled={pending} onClick={() => setPinningCategory(null)}
                className="rounded-card border border-muted/30 px-3 py-1 text-sm text-text">
                {t('cancel')}
              </button>
            </div>
          ) : (
            <div className="flex gap-3 text-xs">
              <button type="button" onClick={() => { setPinningCategory(c.category); setPinValue(String(c.recommended)); }}
                className="text-primary">
                {t('pinCta')}
              </button>
              {c.pinned ? (
                <button type="button" disabled={pending} onClick={() => unpin(c.category)} className="text-muted">
                  {t('unpinCta')}
                </button>
              ) : null}
            </div>
          )}
        </div>
      ))}
    </section>
  );
}
```

- [ ] **Step 11: Run the budget component test; typecheck & lint**

Run: `npm run test -- app/[locale]/(app)/budget && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 12: Commit**

```bash
git add "app/[locale]/(app)/budget" "app/[locale]/(app)/checklist"
git commit -m "feat: add /budget couple UI and skippable paid-amount prompt on task completion"
```

---

### Task 7: Admin UI — budget-baseline CMS

**Files:**
- Create: `app/[locale]/admin/budget-templates/page.tsx`, `budget-templates-admin.tsx`, `budget-templates-admin.test.tsx`
- Modify: `app/[locale]/admin/page.tsx` (nav link)

**Interfaces:**
- Consumes: `updateBudgetTemplate` from `@/lib/actions/admin-budget`; category labels via `TaskCategory` namespace.

- [ ] **Step 1: Write the admin component test**

`app/[locale]/admin/budget-templates/budget-templates-admin.test.tsx` — render with `NextIntlClientProvider` (mirror `concepts-admin.test.tsx`). Assert the active-sum indicator: 100 → ok message, else warn message.

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';
import { BudgetTemplatesAdmin } from './budget-templates-admin';

function renderAdmin(rows: Parameters<typeof BudgetTemplatesAdmin>[0]['rows']) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <BudgetTemplatesAdmin rows={rows} />
    </NextIntlClientProvider>,
  );
}

describe('BudgetTemplatesAdmin', () => {
  it('shows the ok message when active percentages total 100', () => {
    renderAdmin([
      { category: 'VENUE', defaultPercent: 60, active: true, sortOrder: 10 },
      { category: 'CATERING', defaultPercent: 40, active: true, sortOrder: 20 },
    ]);
    expect(screen.getByText(/total 100%/i)).toBeTruthy();
  });

  it('warns when active percentages do not total 100', () => {
    renderAdmin([
      { category: 'VENUE', defaultPercent: 60, active: true, sortOrder: 10 },
      { category: 'CATERING', defaultPercent: 30, active: true, sortOrder: 20 },
    ]);
    expect(screen.getByText(/should be 100/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test -- app/[locale]/admin/budget-templates/budget-templates-admin.test.tsx`
Expected: FAIL ("Cannot find module './budget-templates-admin'").

- [ ] **Step 3: Implement the admin page loader**

`app/[locale]/admin/budget-templates/page.tsx` — mirror `app/[locale]/admin/checklist-templates/page.tsx` (read it first: same `auth` + live-DB `role` gate + redirect). Load rows and pass to the client component:

```tsx
import { setRequestLocale } from 'next-intl/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { redirect } from '@/lib/i18n/navigation';
import { BudgetTemplatesAdmin } from './budget-templates-admin';

export default async function BudgetTemplatesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user?.id) redirect({ href: '/login', locale });
  const user = await prisma.user.findUnique({ where: { id: session!.user.id }, select: { role: true } });
  if (user?.role !== 'ADMIN') redirect({ href: '/dashboard', locale });

  const rows = await prisma.budgetTemplate.findMany({ orderBy: { sortOrder: 'asc' } });

  return (
    <main className="mx-auto w-full max-w-3xl p-8">
      <BudgetTemplatesAdmin
        rows={rows.map((r) => ({
          category: r.category, defaultPercent: r.defaultPercent, active: r.active, sortOrder: r.sortOrder,
        }))}
      />
    </main>
  );
}
```

- [ ] **Step 4: Implement the admin client component**

`app/[locale]/admin/budget-templates/budget-templates-admin.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/lib/i18n/navigation';
import type { TaskCategory } from '@prisma/client';
import { updateBudgetTemplate } from '@/lib/actions/admin-budget';

export interface BudgetTemplateRow {
  category: TaskCategory;
  defaultPercent: number;
  active: boolean;
  sortOrder: number;
}

export function BudgetTemplatesAdmin({ rows }: { rows: BudgetTemplateRow[] }) {
  const t = useTranslations('AdminBudget');
  const tCategory = useTranslations('TaskCategory');
  const router = useRouter();
  const [draft, setDraft] = useState<BudgetTemplateRow[]>(rows);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  const activeSum = draft.filter((r) => r.active).reduce((s, r) => s + r.defaultPercent, 0);

  function patch(category: TaskCategory, over: Partial<BudgetTemplateRow>) {
    setDraft((d) => d.map((r) => (r.category === category ? { ...r, ...over } : r)));
  }

  async function save(row: BudgetTemplateRow) {
    setError(false);
    setPending(true);
    const result = await updateBudgetTemplate(row.category, {
      defaultPercent: row.defaultPercent, active: row.active, sortOrder: row.sortOrder,
    });
    setPending(false);
    if (!result.ok) { setError(true); return; }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-2xl text-text">{t('title')}</h1>
        <p className="text-sm text-muted">{t('subtitle')}</p>
      </header>

      <p className={activeSum === 100 ? 'text-sm text-muted' : 'text-sm text-red-600'}>
        {activeSum === 100 ? t('sumOk', { sum: activeSum }) : t('sumWarn', { sum: activeSum })}
      </p>

      <div className="flex flex-col gap-2">
        {draft.map((row) => (
          <div key={row.category} className="flex flex-wrap items-center gap-3 rounded-card bg-surface p-3 shadow-sm">
            <span className="w-32 text-sm text-text">{tCategory(row.category)}</span>
            <label className="flex items-center gap-1 text-xs text-muted">
              {t('percentLabel')}
              <input
                type="number" min="0" max="100" dir="ltr" value={row.defaultPercent}
                onChange={(e) => patch(row.category, { defaultPercent: Math.trunc(Number(e.target.value)) })}
                className="w-20 rounded-card border border-muted/30 bg-background px-2 py-1 text-sm text-text"
              />
            </label>
            <label className="flex items-center gap-1 text-xs text-muted">
              {t('activeLabel')}
              <input
                type="checkbox" checked={row.active}
                onChange={(e) => patch(row.category, { active: e.target.checked })}
              />
            </label>
            <button type="button" disabled={pending} onClick={() => save(row)}
              className="ms-auto rounded-card bg-primary px-3 py-1.5 text-sm text-background disabled:opacity-60">
              {t('save')}
            </button>
          </div>
        ))}
      </div>
      {error ? <p className="text-sm text-red-600">{t('error')}</p> : null}
    </div>
  );
}
```

- [ ] **Step 5: Add the admin nav link**

In `app/[locale]/admin/page.tsx`, add a translations hook and a list item. After `const tTemplates = ...`:

```tsx
  const tBudget = await getTranslations('AdminBudget');
```

Add this `<li>` after the Concepts one:

```tsx
        <li>
          <Link href="/admin/budget-templates" className="text-primary underline">
            {tBudget('title')}
          </Link>
        </li>
```

- [ ] **Step 6: Run the admin component test; typecheck & lint**

Run: `npm run test -- app/[locale]/admin/budget-templates && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add "app/[locale]/admin/budget-templates" "app/[locale]/admin/page.tsx"
git commit -m "feat: add admin budget-baseline CMS with active-sum indicator"
```

---

### Task 8: Dashboard entry + E2E flows + acceptance verification

**Files:**
- Modify: `app/[locale]/(app)/dashboard/page.tsx`
- Create: `e2e/budget.spec.ts`

**Interfaces:**
- Consumes: everything built above.

- [ ] **Step 1: Add the budget entry to the dashboard**

In `app/[locale]/(app)/dashboard/page.tsx`, add a budget card. The `wedding` object already loads; use `budgetTotal` to choose nudge vs summary. Add this after the concept nudge section (before `</main>`):

```tsx
      <section className="rounded-card bg-surface p-5">
        <h2 className="font-display text-lg text-text">{t('budgetTitle')}</h2>
        {wedding?.budgetTotal == null ? (
          <p className="mt-1 text-sm text-muted">{t('budgetBody')}</p>
        ) : (
          <p className="mt-1 text-sm text-muted">
            {t('budgetSummary', {
              committed: `₪${(0).toLocaleString(locale)}`,
              total: `₪${wedding.budgetTotal.toLocaleString(locale)}`,
            })}
          </p>
        )}
        <Link
          href="/budget"
          className="mt-3 inline-block rounded-card bg-primary px-4 py-2 text-sm font-medium text-background"
        >
          {t('budgetCta')}
        </Link>
      </section>
```

(The mini-summary's `committed` is shown as `₪0` here to avoid a second DB rollup in the dashboard loader; the full breakdown lives on `/budget`. If a live committed total is wanted on the dashboard later, compute it via `rollupTasks` in this loader — deferred to keep the dashboard read cheap.)

- [ ] **Step 2: Write the E2E spec**

`e2e/budget.spec.ts` — the sibling specs define their register/onboard helpers **inline** (there is no shared `./helpers` module). Copy the helper block verbatim from the top of `e2e/concepts.spec.ts` (`uniqueEmail`, `registerAndLogin`, `fillNamesAndContinue`, `skipRemainingSteps`, `finishOnboarding`, and the `registerAndOnboard` wrapper), changing only the `uniqueEmail` prefix to `e2e-budget-`. Then add the tests below.

```typescript
import { test, expect, type Page } from '@playwright/test';

// ---- paste the inline helpers from e2e/concepts.spec.ts here ----
// function uniqueEmail() { return `e2e-budget-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`; }
// async function registerAndLogin(page, email) { ... }
// async function fillNamesAndContinue(page) { ... }
// async function skipRemainingSteps(page) { ... }
// async function finishOnboarding(page) { ... }
// async function registerAndOnboard(page) { ... }  // registers a fresh couple, lands on /dashboard

test.describe('Budget planning', () => {
  test('set a budget, complete a task with a paid amount, see it in the split', async ({ page }) => {
    await registerAndOnboard(page); // lands on /dashboard

    // Open the budget page and set a total.
    await page.goto('/budget');
    await page.getByRole('button', { name: /set budget/i }).click();
    await page.getByRole('spinbutton').first().fill('100000');
    await page.getByRole('button', { name: /^save$/i }).click();

    // The category plan renders.
    await expect(page.getByText(/category plan/i)).toBeVisible();

    // Complete a checklist task with a paid amount.
    await page.goto('/checklist');
    const firstCheckbox = page.getByRole('checkbox').first();
    await firstCheckbox.check();
    await page.getByRole('spinbutton').first().fill('8000');
    await page.getByRole('button', { name: /^save$/i }).click();
    await expect(page.getByText(/paid.*8[,]?000/i).first()).toBeVisible();

    // Back on the budget page, that category shows committed money.
    await page.goto('/budget');
    await expect(page.getByText(/committed/i).first()).toBeVisible();
  });

  test('logged-out visitor is redirected from /budget', async ({ page }) => {
    await page.goto('/budget');
    await expect(page).toHaveURL(/\/login/);
  });
});
```

Adjust selectors to match the sibling specs' conventions (they may key off `data-testid` or specific labels). Keep the flow: set budget → complete task w/ amount → verify committed.

- [ ] **Step 3: Run the E2E spec**

Run: `npm run test:e2e -- budget.spec.ts`
Expected: PASS. If the Playwright webserver is reusing a stale `next dev` with an old Prisma client (Phase 4 lesson), kill it and let Playwright spawn a fresh server (with `npm run db:generate` re-run).

- [ ] **Step 4: Full verification sweep against acceptance criteria**

Run each and confirm green:

```bash
npm run lint          # --max-warnings 0
npm run typecheck
npm run test          # all unit + component
npm run test:e2e      # all e2e
```

Walk the spec's Acceptance criteria (1–12) and confirm each maps to a passing test or a manual check:
1. `/budget` inline-editable total + breakdown — Task 6 + e2e.
2. Optimizer split/clamp/degrade — `optimize.test.ts`.
3. Skippable paid prompt → committed — `checklist.test.ts` + e2e.
4. Committed frozen; re-open returns to open pool — `optimize.test.ts` + `rollup.test.ts`.
5. Pin excluded / `max(pin, committed)` — `optimize.test.ts` + `budget.test.ts`.
6. Over-budget + headroom feedback — `optimize.test.ts` + `budget-view.test.tsx`.
7. Gift estimator delta — `gifts.test.ts` + `budget-view.test.tsx`.
8. Admin baseline edit + non-admin reject — `admin-budget.test.ts` + `budget-templates-admin.test.tsx`.
9. Non-negative ₪ integers; ownership — schemas + `budget.test.ts`.
10. No hard-coded strings; RTL logical props — `npm run lint`.
11. Seed sums to 100, idempotent — Task 1 Step 6.
12. Lint/typecheck/tests green — this step.

- [ ] **Step 5: Commit**

```bash
git add "app/[locale]/(app)/dashboard/page.tsx" e2e/budget.spec.ts
git commit -m "feat: add dashboard budget entry and budget e2e flows"
```

---

### Final: Whole-branch review

- [ ] **Step 1: Run the full gate one more time**

```bash
npm run lint && npm run typecheck && npm run test && npm run test:e2e
```
Expected: all green. Record the unit + e2e counts.

- [ ] **Step 2: Adversarial whole-branch review**

Request a code review of the entire `phase-5-budget` branch diff (`superpowers:requesting-code-review` or `/code-review high`). Focus areas:
- **Optimizer correctness** — does `optimizeBudget` always keep `Σ recommended == budgetTotal` when feasible? Are the `committed_overrun`, `over_budget`, and `headroom` branches mutually exclusive and correct? Any rounding path where `roundToTotal` can produce a negative allocation?
- **Ownership** — every couple action resolves `weddingId` from the DB and scopes task lookups by it (`setTaskAmountPaid`/`setTaskEstimatedCost` use `findFirst({ where: { id, weddingId } })`).
- **Admin gate** — the parametrized `FORBIDDEN` test covers every export of `admin-budget.ts` (the export-parity assertion enforces this).
- **The `setTaskStatus` change** — re-opening never writes `amountPaid`; a negative/fractional paid amount is rejected; existing checklist tests still green.
- **i18n parity** — `he.json` and `en.json` have identical key sets for the new namespaces.

- [ ] **Step 3: Address findings, then update the implementation log**

Apply any Critical/Important fixes (commit each). Then add the Phase 5 section to `docs/superpowers/IMPLEMENTATION-LOG.md` (mirror the Phase 4 entry: delivered summary, verification counts, key decisions/deviations, and move the relevant backlog items — e.g. the Phase 5 "budget optimization consuming concepts" item is now done; note any new deferrals such as a live dashboard committed total or deposit-before-done). Commit.

- [ ] **Step 4: Push and open the PR** (only on the user's explicit go-ahead — never commit/push without per-request permission)

```bash
git push -u origin phase-5-budget
gh pr create --title "Phase 5 — Budget Planning & Optimization" --body "..."
```
