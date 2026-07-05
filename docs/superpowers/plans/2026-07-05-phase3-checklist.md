# Phase 3: Checklist & Timeline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An admin-managed master checklist that each couple receives a snapshot copy of on completing onboarding, with a relative-due-date timeline, full couple task management (complete/edit/soft-delete/restore/add-custom/reminders), and a minimal admin template CRUD.

**Architecture:** Snapshot copy-on-create: `ChecklistTemplate` (admin master, seeded) → per-couple `Task` copies at `completeOnboarding()`, in one idempotent transaction. Template edits affect future couples only (tasks are self-contained snapshots). Due dates derive from `Wedding.weddingDate − dueOffsetDays`, recomputed on date change except hand-overridden tasks. All couple actions are ownership-scoped (DB-resolved session); templates are `ADMIN`-only. Titles render through one resolver with a per-item `titleLocale` (AUTO/EN/HE) override.

**Tech Stack:** Next.js 16 App Router, Prisma 6.19.3 + Postgres, Auth.js v5, next-intl, Tailwind v4 tokens, Zod, Vitest + Playwright, tsx (seed).

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-07-05-checklist-timeline-design.md` — its 10 acceptance criteria are the definition of done.
- **Next.js 16:** App Router; `proxy.ts` (no middleware). Verify version-sensitive APIs vs `node_modules/next/dist/docs/` / context7.
- **Snapshot, not reference:** `Task` copies `title_en/title_he/titleLocale/category/priority/dueOffsetDays` at creation; template edits/deletes never mutate existing tasks. `Task.sourceTemplateId` is provenance-only (nullable, set null on template delete).
- **Copy trigger:** on successful `completeOnboarding()`, idempotent via `Wedding.tasksSeededAt`, atomic (`prisma.$transaction`), + backfill when a couple reaches the checklist unseeded.
- **Due dates:** `dueDate = weddingDate − dueOffsetDays` (both present, else null); recompute on wedding-date change where `dueDateOverridden = false`; hand-set due date sets `dueDateOverridden = true`.
- **Soft-delete:** delete sets `deletedAt`; restore clears it; permanent-delete removes; all normal reads filter `deletedAt: null`.
- **Ownership:** every couple task action resolves the task and confirms `task.weddingId` == the caller's own wedding (DB-resolved via `auth()` session user id, NOT the JWT claim). Templates: `ADMIN` role only.
- **Enums:** `TaskCategory {VENUE,CATERING,PHOTOGRAPHY,MUSIC,ATTIRE,DESIGN,FLOWERS,GUESTS,CEREMONY,PLANNING,BUDGET,OTHER}`, `TaskPriority {LOW,MEDIUM,HIGH}`, `TaskStatus {OPEN,DONE}`, `TitleLocale {AUTO,EN,HE}`.
- **Titles:** bilingual DB columns via `resolveTaskTitle(item, locale)` (AUTO→by locale, EN→title_en, HE→title_he, fallback to the other if empty). All UI chrome + enum labels via next-intl; NO hardcoded JSX strings (lint gate `eslint --max-warnings 0`, `react/jsx-no-literals` error). Message values genuine Hebrew.
- **Tailwind logical properties only** (`ps-*`/`pe-*`/`text-start`/`text-center`, never `pl-*`/`text-left`); on-brand design tokens; RTL-correct.
- **Scale/cost:** copy = one txn of ~40–60 inserts once; reads indexed by `weddingId`; reminder delivery + trash purge deferred to Inngest.
- **Commits:** per task on `phase-3-checklist`. Do NOT push/PR without explicit user permission.
- **Local dev:** Docker Postgres on 5433; tests use `.env.test` (`wedding_test`).

---

## File Structure

```
prisma/schema.prisma                              # + 4 enums, ChecklistTemplate, Task; Wedding.tasks + tasksSeededAt
prisma/migrations/<ts>_add_checklist/             # generated migration
prisma/seed.ts                                    # idempotent default-checklist seed (upsert)
lib/checklist/
  title.ts                                        # resolveTaskTitle
  schema.ts                                       # Zod: task edit, custom task, template CRUD + option constants
  copy.ts                                         # seedTasksForWedding, computeDueDate, recomputeDueDates
  queries.ts                                      # getTasks, getTrashedTasks, getTemplates
lib/actions/
  checklist.ts                                    # couple task actions (ownership-scoped)
  admin-templates.ts                              # admin template CRUD (ADMIN-only)
  onboarding.ts                                   # MODIFY: seed on complete; recompute on date change
app/[locale]/(app)/checklist/
  page.tsx                                         # server: load tasks (backfill if unseeded)
  checklist-view.tsx                               # client: list/progress/group/filter
  task-row.tsx, add-custom-task.tsx, trash-view.tsx
app/[locale]/admin/checklist-templates/
  page.tsx                                         # server (ADMIN): load templates
  templates-admin.tsx, template-form.tsx           # client CRUD
messages/he.json, messages/en.json                # + Checklist, TaskCategory, TaskPriority, Trash, AdminTemplates
e2e/checklist.spec.ts
```

---

## Task 1: Schema + enums + migration + default-checklist seed

**Files:** Modify `prisma/schema.prisma`; migration via CLI; Create `prisma/seed.ts`; Modify `package.json` (prisma.seed + tsx). Test: `lib/checklist/queries.test.ts` (partial — seed/relation smoke here; full queries in Task 2).

**Interfaces:** Produces `ChecklistTemplate`, `Task` models + enums `TaskCategory/TaskPriority/TaskStatus/TitleLocale`; `Wedding.tasks`, `Wedding.tasksSeededAt`.

- [ ] **Step 1: Add enums + models to `prisma/schema.prisma`** (exact per spec's Data model section — copy the `ChecklistTemplate` and `Task` models and the four enums verbatim from `docs/superpowers/specs/2026-07-05-checklist-timeline-design.md`). Add to `Wedding`: `tasks Task[]` and `tasksSeededAt DateTime?`.

- [ ] **Step 2: Migration** — `npm run db:migrate -- --name add_checklist` → applies to `wedding_dev`, regenerates client.

- [ ] **Step 3: Add seed tooling** — `npm install -D tsx`; add to `package.json`: `"prisma": { "seed": "tsx prisma/seed.ts" }` (keep the existing `"prisma": "6.19.3"` DEPENDENCY version pin — note `prisma` appears both as a dep version and, separately, this seed config object; add the config object, do not remove the version pin). Add script `"db:seed": "prisma db seed"`.

- [ ] **Step 4: Write `prisma/seed.ts`** — an **idempotent** seed of a default bilingual wedding checklist. Use a stable natural key to upsert (there's no unique column; create a deterministic id per item, e.g. `id: 'tmpl-venue-book'`, and `prisma.checklistTemplate.upsert({ where: { id }, create: {...}, update: {...} })`). Include ~35–45 realistic items across the categories, each with genuine Hebrew `title_he` + English `title_en`, a `category`, `priority`, a sensible `dueOffsetDays` (e.g. book venue ~365, send invitations ~60, final headcount ~14), `active: true`, and an increasing `sortOrder`. `titleLocale: 'AUTO'`. Provide real Hebrew (e.g. `{ id:'tmpl-venue-book', title_en:'Book the venue', title_he:'להזמין את האולם', category:'VENUE', priority:'HIGH', dueOffsetDays:365, sortOrder:10 }`). The implementer authors the full set; keep it sensible and bilingual.

- [ ] **Step 5: Run the seed** — `npm run db:seed` → templates upserted into `wedding_dev`. Re-running is a no-op (idempotent) — run twice to confirm no duplicates.

- [ ] **Step 6: DB smoke test — `lib/checklist/queries.test.ts`**

```ts
import { describe, it, expect, afterEach } from 'vitest';
import { prisma } from '@/lib/db';

afterEach(async () => {
  await prisma.task.deleteMany();
  await prisma.wedding.deleteMany();
  await prisma.checklistTemplate.deleteMany();
});

describe('checklist schema', () => {
  it('creates a template and a snapshot task linked to a wedding', async () => {
    const t = await prisma.checklistTemplate.create({
      data: { title_en: 'Book venue', title_he: 'להזמין אולם', category: 'VENUE', priority: 'HIGH', dueOffsetDays: 365, sortOrder: 1 },
    });
    const w = await prisma.wedding.create({ data: {} });
    const task = await prisma.task.create({
      data: {
        weddingId: w.id, title_en: t.title_en, title_he: t.title_he,
        category: t.category, priority: t.priority, dueOffsetDays: t.dueOffsetDays,
        sourceTemplateId: t.id,
      },
    });
    expect(task.status).toBe('OPEN');
    expect(task.deletedAt).toBeNull();
    const withTasks = await prisma.wedding.findUnique({ where: { id: w.id }, include: { tasks: true } });
    expect(withTasks?.tasks).toHaveLength(1);
  });
});
```

- [ ] **Step 7: Run test** — `npm test -- lib/checklist/queries.test.ts` → PASS. `npm run typecheck` clean. Full suite still passes.

- [ ] **Step 8: Commit** — do NOT commit `.env`. Commit schema, migration, seed, package.json, test.
```bash
git add prisma/ package.json package-lock.json lib/checklist/queries.test.ts
git commit -m "feat: add checklist schema, migration, and default-checklist seed"
```

---

## Task 2: Title resolver + query helpers + Zod schemas

**Files:** Create `lib/checklist/title.ts`, `lib/checklist/queries.ts` (extend), `lib/checklist/schema.ts`; tests `lib/checklist/title.test.ts`, `lib/checklist/schema.test.ts`.

**Interfaces:**
- Produces:
  - `resolveTaskTitle(item: { title_en: string; title_he: string; titleLocale: TitleLocale }, locale: string): string`.
  - `getTasks(weddingId)` (deletedAt null, ordered), `getTrashedTasks(weddingId)`, `getTemplates()` (all, ordered by sortOrder).
  - `taskEditSchema`, `customTaskSchema`, `templateSchema`, `CATEGORY_OPTIONS`, `PRIORITY_OPTIONS`, `TITLE_LOCALE_OPTIONS`.

- [ ] **Step 1: Failing test `lib/checklist/title.test.ts`**
```ts
import { describe, it, expect } from 'vitest';
import { resolveTaskTitle } from './title';

const base = { title_en: 'Book venue', title_he: 'להזמין אולם' };
describe('resolveTaskTitle', () => {
  it('AUTO uses he for he locale, en for en locale', () => {
    expect(resolveTaskTitle({ ...base, titleLocale: 'AUTO' }, 'he')).toBe('להזמין אולם');
    expect(resolveTaskTitle({ ...base, titleLocale: 'AUTO' }, 'en')).toBe('Book venue');
  });
  it('EN/HE pin regardless of locale', () => {
    expect(resolveTaskTitle({ ...base, titleLocale: 'EN' }, 'he')).toBe('Book venue');
    expect(resolveTaskTitle({ ...base, titleLocale: 'HE' }, 'en')).toBe('להזמין אולם');
  });
  it('falls back to the other side when the chosen one is empty', () => {
    expect(resolveTaskTitle({ title_en: '', title_he: 'רק עברית', titleLocale: 'AUTO' }, 'en')).toBe('רק עברית');
  });
});
```
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement `lib/checklist/title.ts`**
```ts
import type { TitleLocale } from '@prisma/client';

export function resolveTaskTitle(
  item: { title_en: string; title_he: string; titleLocale: TitleLocale },
  locale: string,
): string {
  const pickHe = item.titleLocale === 'HE' || (item.titleLocale === 'AUTO' && locale === 'he');
  const primary = pickHe ? item.title_he : item.title_en;
  const secondary = pickHe ? item.title_en : item.title_he;
  return primary?.trim() ? primary : secondary;
}
```
- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Implement `lib/checklist/queries.ts`** (add to the file from Task 1's test):
```ts
import { prisma } from '@/lib/db';

export function getTasks(weddingId: string) {
  return prisma.task.findMany({
    where: { weddingId, deletedAt: null },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
}
export function getTrashedTasks(weddingId: string) {
  return prisma.task.findMany({
    where: { weddingId, deletedAt: { not: null } },
    orderBy: { deletedAt: 'desc' },
  });
}
export function getTemplates() {
  return prisma.checklistTemplate.findMany({ orderBy: { sortOrder: 'asc' } });
}
```
- [ ] **Step 6: Implement `lib/checklist/schema.ts`** — Zod + option constants:
```ts
import { z } from 'zod';
import { TaskCategory, TaskPriority, TitleLocale } from '@prisma/client';

export const CATEGORY_OPTIONS = Object.values(TaskCategory);
export const PRIORITY_OPTIONS = Object.values(TaskPriority);
export const TITLE_LOCALE_OPTIONS = Object.values(TitleLocale);

export const customTaskSchema = z.object({
  title_en: z.string().trim().max(200).optional().default(''),
  title_he: z.string().trim().max(200).optional().default(''),
  category: z.nativeEnum(TaskCategory).default(TaskCategory.OTHER),
  priority: z.nativeEnum(TaskPriority).default(TaskPriority.MEDIUM),
  dueDate: z.coerce.date().nullable().optional(),
}).refine((v) => v.title_en.trim() || v.title_he.trim(), { message: 'title required' });

export const taskEditSchema = z.object({
  title_en: z.string().trim().max(200).optional(),
  title_he: z.string().trim().max(200).optional(),
  titleLocale: z.nativeEnum(TitleLocale).optional(),
  category: z.nativeEnum(TaskCategory).optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
  dueDate: z.coerce.date().nullish(),
  notes: z.string().trim().max(2000).nullish(),
});

export const templateSchema = z.object({
  title_en: z.string().trim().min(1).max(200),
  title_he: z.string().trim().min(1).max(200),
  titleLocale: z.nativeEnum(TitleLocale).default(TitleLocale.AUTO),
  category: z.nativeEnum(TaskCategory),
  priority: z.nativeEnum(TaskPriority).default(TaskPriority.MEDIUM),
  dueOffsetDays: z.number().int().min(0).max(3650).nullish(),
  active: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});
```
- [ ] **Step 7: Test `lib/checklist/schema.test.ts`** — assert: customTaskSchema rejects when both titles empty, accepts one title; templateSchema requires both title_en & title_he; taskEditSchema accepts null dueDate (clear). Run → PASS.
- [ ] **Step 8: typecheck clean; full suite passes. Commit.**
```bash
git add lib/checklist/
git commit -m "feat: add title resolver, checklist queries, and Zod schemas"
```

---

## Task 3: Copy engine + due-date compute/recompute

**Files:** Create `lib/checklist/copy.ts`, `lib/checklist/copy.test.ts`.

**Interfaces:**
- Consumes: `prisma`, `getTemplates`.
- Produces:
  - `computeDueDate(weddingDate: Date | null, dueOffsetDays: number | null): Date | null`.
  - `seedTasksForWedding(weddingId: string): Promise<void>` — idempotent (no-op if `tasksSeededAt` set), atomic; snapshot-copies active templates.
  - `recomputeDueDates(weddingId: string): Promise<void>` — updates non-overridden derived due dates from the current wedding date.

- [ ] **Step 1: Failing test `lib/checklist/copy.test.ts`** (integration, real DB):
```ts
import { describe, it, expect, afterEach } from 'vitest';
import { prisma } from '@/lib/db';
import { seedTasksForWedding, recomputeDueDates, computeDueDate } from './copy';

afterEach(async () => {
  await prisma.task.deleteMany();
  await prisma.wedding.deleteMany();
  await prisma.checklistTemplate.deleteMany();
});

async function seedTemplates() {
  await prisma.checklistTemplate.createMany({ data: [
    { title_en: 'A', title_he: 'א', category: 'VENUE', priority: 'HIGH', dueOffsetDays: 100, sortOrder: 1, active: true },
    { title_en: 'B', title_he: 'ב', category: 'MUSIC', priority: 'LOW', dueOffsetDays: null, sortOrder: 2, active: true },
    { title_en: 'C-inactive', title_he: 'ג', category: 'OTHER', priority: 'LOW', sortOrder: 3, active: false },
  ]});
}

describe('copy engine', () => {
  it('computeDueDate subtracts offset days from the wedding date', () => {
    const wd = new Date('2026-12-01T00:00:00Z');
    expect(computeDueDate(wd, 10)?.toISOString().slice(0,10)).toBe('2026-11-21');
    expect(computeDueDate(wd, null)).toBeNull();
    expect(computeDueDate(null, 10)).toBeNull();
  });

  it('seeds only active templates as snapshots with computed due dates, once', async () => {
    await seedTemplates();
    const w = await prisma.wedding.create({ data: { weddingDate: new Date('2026-12-01T00:00:00Z') } });
    await seedTasksForWedding(w.id);
    const tasks = await prisma.task.findMany({ where: { weddingId: w.id }, orderBy: { sortOrder: 'asc' } });
    expect(tasks).toHaveLength(2); // inactive excluded
    expect(tasks[0].title_he).toBe('א');
    expect(tasks[0].dueDate?.toISOString().slice(0,10)).toBe('2026-08-23'); // 100 days before
    expect(tasks[1].dueDate).toBeNull(); // no offset
    const w2 = await prisma.wedding.findUnique({ where: { id: w.id } });
    expect(w2?.tasksSeededAt).toBeInstanceOf(Date);
    // idempotent
    await seedTasksForWedding(w.id);
    expect(await prisma.task.count({ where: { weddingId: w.id } })).toBe(2);
  });

  it('editing a template after seeding does NOT change existing tasks (snapshot)', async () => {
    await seedTemplates();
    const w = await prisma.wedding.create({ data: {} });
    await seedTasksForWedding(w.id);
    const tmpl = await prisma.checklistTemplate.findFirst({ where: { title_en: 'A' } });
    await prisma.checklistTemplate.update({ where: { id: tmpl!.id }, data: { title_en: 'CHANGED' } });
    const task = await prisma.task.findFirst({ where: { weddingId: w.id, sourceTemplateId: tmpl!.id } });
    expect(task?.title_en).toBe('A'); // unchanged
  });

  it('recompute updates non-overridden derived due dates; leaves overridden ones', async () => {
    await seedTemplates();
    const w = await prisma.wedding.create({ data: { weddingDate: new Date('2026-12-01T00:00:00Z') } });
    await seedTasksForWedding(w.id);
    // override one task's due date
    const a = await prisma.task.findFirst({ where: { weddingId: w.id, title_en: 'A' } });
    await prisma.task.update({ where: { id: a!.id }, data: { dueDate: new Date('2027-01-01'), dueDateOverridden: true } });
    // change wedding date + recompute
    await prisma.wedding.update({ where: { id: w.id }, data: { weddingDate: new Date('2027-06-01T00:00:00Z') } });
    await recomputeDueDates(w.id);
    const a2 = await prisma.task.findFirst({ where: { id: a!.id } });
    expect(a2?.dueDate?.toISOString().slice(0,10)).toBe('2027-01-01'); // overridden kept
  });
});
```
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement `lib/checklist/copy.ts`**
```ts
import { prisma } from '@/lib/db';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function computeDueDate(weddingDate: Date | null, dueOffsetDays: number | null): Date | null {
  if (!weddingDate || dueOffsetDays == null) return null;
  return new Date(weddingDate.getTime() - dueOffsetDays * MS_PER_DAY);
}

export async function seedTasksForWedding(weddingId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const wedding = await tx.wedding.findUnique({ where: { id: weddingId } });
    if (!wedding || wedding.tasksSeededAt) return; // idempotent
    const templates = await tx.checklistTemplate.findMany({
      where: { active: true }, orderBy: { sortOrder: 'asc' },
    });
    if (templates.length > 0) {
      await tx.task.createMany({
        data: templates.map((t) => ({
          weddingId,
          title_en: t.title_en, title_he: t.title_he, titleLocale: t.titleLocale,
          category: t.category, priority: t.priority, dueOffsetDays: t.dueOffsetDays,
          dueDate: computeDueDate(wedding.weddingDate, t.dueOffsetDays),
          sourceTemplateId: t.id, sortOrder: t.sortOrder,
        })),
      });
    }
    await tx.wedding.update({ where: { id: weddingId }, data: { tasksSeededAt: new Date() } });
  });
}

export async function recomputeDueDates(weddingId: string): Promise<void> {
  const wedding = await prisma.wedding.findUnique({ where: { id: weddingId } });
  if (!wedding) return;
  const tasks = await prisma.task.findMany({
    where: { weddingId, deletedAt: null, dueDateOverridden: false, dueOffsetDays: { not: null } },
  });
  await prisma.$transaction(
    tasks.map((t) =>
      prisma.task.update({
        where: { id: t.id },
        data: { dueDate: computeDueDate(wedding.weddingDate, t.dueOffsetDays) },
      }),
    ),
  );
}
```
- [ ] **Step 4: Run → PASS (4 tests).** typecheck clean; full suite passes.
- [ ] **Step 5: Commit** — `git add lib/checklist/copy.ts lib/checklist/copy.test.ts && git commit -m "feat: add checklist copy engine and due-date compute/recompute"`

---

## Task 4: Wire copy + recompute into onboarding

**Files:** Modify `lib/actions/onboarding.ts`; extend `lib/actions/onboarding.test.ts`.

**Interfaces:** Consumes `seedTasksForWedding`, `recomputeDueDates`. `completeOnboarding` now seeds tasks; `saveStep('date', ...)` and `updateWeddingProfile` recompute due dates when already seeded.

- [ ] **Step 1: Extend `lib/actions/onboarding.test.ts`** — add tests: (a) `completeOnboarding` results in seeded tasks for the wedding (create ≥1 active template first); (b) after seeding, `updateWeddingProfile` changing `weddingDate` updates a derived task's `dueDate`. (Mock `auth` as in the existing tests.)
- [ ] **Step 2: Run → new tests FAIL.**
- [ ] **Step 3: Modify `lib/actions/onboarding.ts`:**
  - In `completeOnboarding`, after stamping `onboardingCompletedAt`, call `await seedTasksForWedding(weddingId)`.
  - In `saveStep` (when `step === 'date'`) and in `updateWeddingProfile`, after the wedding update, call `await recomputeDueDates(weddingId)` (guarded — it no-ops if not seeded / no tasks). Import both from `@/lib/checklist/copy`.
  - Keep all existing behavior/return contracts.
- [ ] **Step 4: Run → PASS.** typecheck clean; full suite passes.
- [ ] **Step 5: Commit** — `git add lib/actions/onboarding.ts lib/actions/onboarding.test.ts && git commit -m "feat: seed checklist on onboarding completion and recompute due dates on date change"`

---

## Task 5: Couple task actions (ownership-scoped)

**Files:** Create `lib/actions/checklist.ts`, `lib/actions/checklist.test.ts`.

**Interfaces:**
- Consumes: `auth`, `prisma`, `getCurrentWedding` (`@/lib/wedding/queries`), `taskEditSchema`/`customTaskSchema`, `seedTasksForWedding`.
- Produces (`ActionResult = {ok:true} | {ok:false; error:'UNAUTHENTICATED'|'INVALID'|'NOT_FOUND'}`):
  - `setTaskStatus(taskId, done: boolean)`, `editTask(taskId, input)`, `softDeleteTask(taskId)`, `restoreTask(taskId)`, `permanentlyDeleteTask(taskId)`, `addCustomTask(input)`, `setTaskReminder(taskId, enabled: boolean, remindAt?: Date | null)`.
- Ownership helper: resolve caller's wedding via `getCurrentWedding(session.user.id)`; a task op loads the task and confirms `task.weddingId === wedding.id`, else `NOT_FOUND` (don't leak existence).

- [ ] **Step 1: Failing test `lib/actions/checklist.test.ts`** — mock `auth`; cover: setTaskStatus done→completedAt set / reopen clears; editTask sets `dueDateOverridden` when a dueDate is provided; softDeleteTask sets deletedAt and excludes from getTasks; restoreTask clears it; permanentlyDeleteTask removes; addCustomTask creates `isCustom:true` with appended sortOrder; **cross-tenant: user B cannot edit/delete user A's task (returns NOT_FOUND, A's task unchanged)**; unauthenticated → UNAUTHENTICATED. (Follow the Phase-2 `onboarding.test.ts` mock pattern.)
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement `lib/actions/checklist.ts`** — `'use server'`. Each action: `requireUserId()` (session), resolve wedding via `getCurrentWedding`, load the task by id, verify `task.weddingId === wedding.id` (else NOT_FOUND), validate input with the matching Zod schema (else INVALID), update. `editTask`: if `dueDate` key present, also set `dueDateOverridden: true`. `addCustomTask`: compute next sortOrder = (max existing for the wedding) + 1; `isCustom: true`, `sourceTemplateId: null`, snapshot titles from input. Mirror Phase-2 action structure and the P2-Task-3 prototype-safety/branch-ordering (auth → validate → ownership → write).
- [ ] **Step 4: Run → PASS.** typecheck clean; full suite passes.
- [ ] **Step 5: Commit** — `git add lib/actions/checklist.ts lib/actions/checklist.test.ts && git commit -m "feat: add ownership-scoped couple task actions with soft-delete/restore"`

---

## Task 6: Admin template CRUD actions (ADMIN-only)

**Files:** Create `lib/actions/admin-templates.ts`, `lib/actions/admin-templates.test.ts`.

**Interfaces:**
- Consumes: `auth` (needs `session.user.role`), `prisma`, `templateSchema`.
- Produces (`AdminResult = {ok:true; id?:string} | {ok:false; error:'FORBIDDEN'|'INVALID'|'NOT_FOUND'}`):
  - `createTemplate(input)`, `updateTemplate(id, input)`, `deleteTemplate(id)`, `reorderTemplate(id, sortOrder)`, `setTemplateActive(id, active)`.
- Every action requires `session.user.role === 'ADMIN'` (else FORBIDDEN) — verified from the DB user, not just the JWT, for freshness (load `prisma.user.findUnique` role, or trust the session role per Phase-1 design; **verify via context7 what's safest** — the JWT role is set at login; for admin mutations prefer a DB role check).

- [ ] **Step 1: Failing test** — mock `auth` to control role; assert: non-admin → FORBIDDEN (no write); admin createTemplate persists; updateTemplate/deleteTemplate/reorder/setActive work; deleteTemplate nulls `sourceTemplateId` on existing tasks (create a task referencing it first, confirm it survives with `sourceTemplateId: null`); INVALID on bad input.
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement `lib/actions/admin-templates.ts`** — `'use server'`. `requireAdmin()`: session + confirm role ADMIN (DB check). `deleteTemplate`: within a transaction, `prisma.task.updateMany({ where: { sourceTemplateId: id }, data: { sourceTemplateId: null } })` then delete the template (or rely on `onDelete: SetNull` if `sourceTemplateId` is modeled as an FK — the spec keeps it a plain nullable string, so do the explicit updateMany). Validate with `templateSchema`.
- [ ] **Step 4: Run → PASS.** typecheck clean; full suite passes.
- [ ] **Step 5: Commit** — `git commit -m "feat: add ADMIN-only checklist template CRUD actions"`

---

## Task 7: Couple checklist UI + messages

Build the `/checklist` page, its client view (list, progress, group/filter, row actions, add-custom, trash), and all he+en copy. Follow the no-hardcoded-strings + logical-properties + design-token rules exactly (as enforced in Phase 2).

**Files:** Create `app/[locale]/(app)/checklist/page.tsx`, `checklist-view.tsx`, `task-row.tsx`, `add-custom-task.tsx`, `trash-view.tsx`; Modify `messages/{he,en}.json`; Create `app/[locale]/(app)/checklist/checklist-view.test.tsx`.

**Detailed requirements (mixed-model implementer — build to these; opus review verifies):**
- **Server `page.tsx`:** `setRequestLocale`; `auth()`; `getCurrentWedding`; if the wedding is unseeded (`tasksSeededAt` null) call `seedTasksForWedding` (backfill) then reload; fetch `getTasks` + counts; render `<ChecklistView tasks={serializable} locale={locale} />` (serialize dates to ISO/null).
- **`checklist-view.tsx` (`'use client'`):** progress indicator (done/total), a group/sort toggle (by **category** vs **timeline** buckets: overdue / this month / upcoming / no date / done), filters (category, status, priority). Renders `TaskRow`s. Uses `resolveTaskTitle(task, locale)` for titles. "Add custom task" opens `AddCustomTask`; a link/toggle to the "Recently deleted" `TrashView`.
- **`task-row.tsx`:** complete/reopen checkbox (calls `setTaskStatus`), resolved title, category + priority badges (labels via `t('TaskCategory.<VALUE>')`/`t('TaskPriority.<VALUE>')`), due date (localized), reminder toggle (`setTaskReminder`), edit (inline or modal → `editTask`), delete (`softDeleteTask`). Optimistic UI acceptable; on action error show a localized message.
- **`add-custom-task.tsx`:** title (he/en or a single field mapped by locale — but store both columns; simplest: one title input that fills the locale's column and leaves the other empty, resolver handles fallback), category, priority, optional due date → `addCustomTask`.
- **`trash-view.tsx`:** lists `getTrashedTasks` (passed from the page or fetched via a server action/loader), each with Restore (`restoreTask`) and Delete permanently (`permanentlyDeleteTask`).
- **Messages:** add `Checklist` (title, progress `{done}/{total}`, groupByCategory, groupByTimeline, buckets, filters, addCustom, empty, recentlyDeleted, restore, deleteForever, reminderOn/Off, edit, delete, save, cancel, error), `TaskCategory.{...12}`, `TaskPriority.{LOW,MEDIUM,HIGH}` — to BOTH files, genuine Hebrew.
- **Component test:** mock the actions + i18n (NextIntlClientProvider + real en.json); assert: rendering N tasks shows correct progress; clicking a task's checkbox calls `setTaskStatus`; adding a custom task calls `addCustomTask`. No hardcoded strings; logical properties only.

- [ ] Build the above; then `npm test` (full suite), `npm run lint` (`--max-warnings 0`), `npm run typecheck`, `npm run build` all green. Manually verify `/checklist` in he + en (log in as a seeded couple; if manual auth is hard, rely on tests + build + the Task 9 e2e).
- [ ] **Commit** — `git add "app/[locale]/(app)/checklist" messages/ && git commit -m "feat: add localized couple checklist UI with progress, timeline, and trash"`

---

## Task 8: Admin template UI + messages

**Files:** Create `app/[locale]/admin/checklist-templates/page.tsx`, `templates-admin.tsx`, `template-form.tsx`; Modify `messages/{he,en}.json` (`AdminTemplates` namespace); Create a component test.

**Detailed requirements:**
- **Server `page.tsx`:** `setRequestLocale`; `auth()`; confirm `role === 'ADMIN'` (else `redirect` to `/dashboard` — the proxy already gates `/admin`, this is defense-in-depth); `getTemplates()`; render `<TemplatesAdmin templates={...} />`.
- **`templates-admin.tsx` (`'use client'`):** a table of all templates (both titles, category, priority, offset, active, sortOrder) with create/edit (via `TemplateForm`), activate/deactivate (`setTemplateActive`), reorder (up/down or number → `reorderTemplate`), delete (`deleteTemplate`, with a confirm). Uses the admin actions from Task 6.
- **`template-form.tsx`:** fields title_en, title_he, titleLocale (AUTO/EN/HE), category, priority, dueOffsetDays, active, sortOrder; client-validate with `templateSchema`; submit → `createTemplate`/`updateTemplate`.
- **Messages:** `AdminTemplates` (title, new, edit, delete, confirmDelete, activate, deactivate, moveUp, moveDown, fields' labels or reuse where possible, save, cancel, saved, error) in both files (real Hebrew). Reuse `TaskCategory`/`TaskPriority` labels from Task 7.
- **Component test:** mock actions + i18n; assert creating a template calls `createTemplate` with the entered values; a non-admin path isn't reachable (server-gated) — test the form/table behavior. No hardcoded strings; logical properties.

- [ ] Build; `npm test`, `npm run lint`, `npm run typecheck`, `npm run build` green.
- [ ] **Commit** — `git add "app/[locale]/admin/checklist-templates" messages/ && git commit -m "feat: add minimal ADMIN checklist-template CRUD UI"`

---

## Task 9: e2e + acceptance verification

**Files:** Create `e2e/checklist.spec.ts`.

- [ ] **Step 1: Write `e2e/checklist.spec.ts`** — reuse the Phase-2 register helper (unique email; register auto-signs-in and, since a fresh couple isn't onboarded, lands in `/onboarding`). Flows:
  - **Seed on complete:** register → complete onboarding minimally (fill partner1 + skip) → land on dashboard → visit `/checklist` → assert it shows tasks (progress "0 of N" with N>0, from the seeded templates). (Requires the dev DB to have seeded templates — ensure `npm run db:seed` has run; the Playwright `webServer` uses `wedding_dev`.)
  - **Complete a task:** click a task's checkbox → progress increments.
  - **Add custom → appears; delete → moves to trash → restore → back.**
  - Keep URL/asserts real (don't weaken). Adjust selectors to the real he DOM (Playwright locale he-IL).
- [ ] **Step 2: Ensure dev templates exist** — run `npm run db:seed` before the e2e run so `/checklist` is populated.
- [ ] **Step 3: Run** `npm run test:e2e` (Docker PG up on 5433, port 3000 free) → all pass (incl. Phase-1/2 specs). Fix selectors to the real DOM; do not weaken assertions.
- [ ] **Step 4: Full gate** — `npm run lint && npm run typecheck && npm test` green; e2e green.
- [ ] **Step 5: Acceptance-criteria pass** — walk the spec's 10 criteria; note which test/check covers each; flag gaps.
- [ ] **Step 6: Commit** — `git add e2e/checklist.spec.ts && git commit -m "test: add checklist e2e flows and verify acceptance criteria"`

---

## Self-Review

**Spec coverage:** schema/enums/seed → T1; title resolver/queries/schemas → T2; copy engine + due-date compute/recompute → T3; onboarding wiring (seed on complete, recompute on date change) → T4; couple actions incl. soft-delete/restore/ownership → T5; admin CRUD (ADMIN-only, sourceTemplateId null on delete) → T6; couple UI + i18n → T7; admin UI + i18n → T8; e2e + acceptance → T9. All 10 acceptance criteria map to T1/T3/T4/T5/T6/T7/T8/T9. Deferrals (reminder delivery, purge) honored (no tasks add them).

**Placeholder scan:** logic tasks (T1–T6) carry complete code; UI tasks (T7–T8) are spec'd with exact interfaces, file lists, message-key lists, action wiring, and concrete tests for a mixed-model implementer — no vague "handle errors". Seed content is authored by the implementer to a concrete structure/sample (acceptable — it's editable bilingual data, not logic). Version-sensitive spots (admin role check, zod v4) carry verify notes.

**Type consistency:** `resolveTaskTitle`, `seedTasksForWedding`/`recomputeDueDates`/`computeDueDate`, the action `ActionResult`/`AdminResult` unions, `getTasks`/`getTrashedTasks`/`getTemplates`, and the Zod schema names are consistent across tasks. `sourceTemplateId` handled as nullable-string-nulled-on-delete in both T1 (schema) and T6 (delete).
