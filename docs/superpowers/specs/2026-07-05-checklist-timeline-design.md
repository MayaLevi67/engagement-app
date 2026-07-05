# Wedding Planner AI — Phase 3: Checklist & Timeline

**Status:** Approved for planning
**Date:** 2026-07-05
**Builds on:** Phase 1 (Foundation), Phase 2 (Onboarding & Wedding Profile)

## Context

Phases 1–2 delivered auth, i18n (he default/RTL + en), the `Wedding` model with profile fields + `onboardingCompletedAt`, the onboarding wizard, and the `/settings/wedding` edit page. `completeOnboarding()` is the hook where a couple finishes setup. Admin role-gating (`/admin`, `ADMIN`) exists from Phase 1.

Phase 3 is the checklist engine — the signature copy-on-create architecture: an admin-managed master `ChecklistTemplate` list that each couple receives a **snapshot copy** of when they finish onboarding, plus the couple-facing checklist (complete/reopen/edit/delete/restore/add-custom/reminders), relative due-date timeline, and a minimal admin CRUD for the templates.

## Goals

- An admin-managed master checklist (`ChecklistTemplate`) plus a seeded sensible default set.
- Snapshot copy-on-create: each couple gets an independent copy of the active templates when onboarding completes; **template edits affect future couples only**.
- Couple-facing checklist with progress, categories, a relative-due-date timeline, and full task management (complete/reopen/edit/delete-to-trash/restore/add-custom/reminder-toggle) — strictly scoped to their own wedding.
- A minimal `ADMIN`-only CRUD to author/reorder/activate/delete template items.

## Non-goals (deferred)

- **Reminder delivery.** Phase 3 stores the reminder preference (flag + optional date); actually sending reminder emails runs later on the Inngest queue (wired dormant in Phase 1).
- **Auto-purging trashed tasks.** Soft-deleted tasks persist until manually permanently-deleted; a scheduled purge (e.g. 30 days) is a later Inngest job.
- **Rich admin shell.** The admin CRUD here is minimal/functional; the polished shared admin panel is Phase 8.
- **Dependencies / estimated cost** on template items (original spec's "later" list) — not now.
- **The dashboard "Upcoming & Timeline" widget** — Phase 7 (Phase 3 provides the data + a `/checklist` page).

## Key decisions

1. **Snapshot copy, not reference.** Each `Task` stores its own `title_en/title_he/category/priority/dueOffsetDays` copied at creation, so editing/deleting a template never mutates existing couples' checklists (future-couples-only — user-confirmed).
2. **Relative due dates.** Templates carry `dueOffsetDays` ("days before the wedding"); on copy, `Task.dueDate = weddingDate − dueOffsetDays` (null if no date). Recomputed when the wedding date changes, except hand-overridden tasks.
3. **Copy fires on `completeOnboarding()`**, idempotent + atomic, with a backfill safety net.
4. **Soft-delete / trash.** Deleting a task sets `deletedAt`; it's restorable (exact state) from a "Recently deleted" view or permanently deletable. Chosen over a lightweight re-add so *any* task (custom included) can be recovered.
5. **Per-item title language override.** Titles render through one resolver defaulting to the couple's locale, but each item has a `titleLocale` (`AUTO`/`EN`/`HE`) admin override so specific items can be pinned to a language regardless of UI language. Both titles are always stored.
6. **Minimal admin CRUD now** (user-chosen over deferring to Phase 8), plus a committed seed of a default bilingual checklist.

## Scale & cost calibration

Right-sized to a few thousand couples. Copy = one transaction of ~40–60 inserts per couple, once. Checklist reads are indexed by `weddingId`. No new external services; reminder delivery + trash purge deferred to the already-wired Inngest queue. Soft-deleted rows are negligible storage at this scale.

## Data model

New enums (shared by `ChecklistTemplate` and `Task`):
- `TaskCategory`: `VENUE, CATERING, PHOTOGRAPHY, MUSIC, ATTIRE, DESIGN, FLOWERS, GUESTS, CEREMONY, PLANNING, BUDGET, OTHER`.
- `TaskPriority`: `LOW, MEDIUM, HIGH`.
- `TaskStatus`: `OPEN, DONE`.
- `TitleLocale`: `AUTO, EN, HE`.

```prisma
model ChecklistTemplate {
  id            String       @id @default(cuid())
  title_en      String
  title_he      String
  titleLocale   TitleLocale  @default(AUTO)
  category      TaskCategory
  priority      TaskPriority @default(MEDIUM)
  dueOffsetDays Int?         // days before the wedding; null = no timeline
  active        Boolean      @default(true)
  sortOrder     Int          @default(0)
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt
}

model Task {
  id                String       @id @default(cuid())
  weddingId         String
  wedding           Wedding      @relation(fields: [weddingId], references: [id], onDelete: Cascade)

  // snapshot of the template at copy time (stands alone)
  title_en          String
  title_he          String
  titleLocale       TitleLocale  @default(AUTO)
  category          TaskCategory
  priority          TaskPriority @default(MEDIUM)
  dueOffsetDays     Int?

  dueDate           DateTime?    // computed = weddingDate − dueOffsetDays
  dueDateOverridden Boolean      @default(false)

  status            TaskStatus   @default(OPEN)
  completedAt       DateTime?

  isCustom          Boolean      @default(false)
  sourceTemplateId  String?      // provenance only; null on template delete

  reminderEnabled   Boolean      @default(false)
  remindAt          DateTime?

  notes             String?
  sortOrder         Int          @default(0)
  deletedAt         DateTime?    // soft-delete / trash

  createdAt         DateTime     @default(now())
  updatedAt         DateTime     @updatedAt

  @@index([weddingId, deletedAt])
}
```

Add to the existing `Wedding` model: `tasks Task[]` and `tasksSeededAt DateTime?` (idempotency/backfill marker).

`sourceTemplateId` is a plain nullable string (provenance), NOT a hard FK — deleting a template must not affect existing tasks (they're snapshots); if modeled as an FK it must be `onDelete: SetNull`.

## Copy-on-create engine

- **Trigger:** on successful `completeOnboarding()`.
- **Snapshot:** read every `active` `ChecklistTemplate` ordered by `sortOrder`; insert one `Task` per item into the couple's wedding copying `title_en/title_he/titleLocale/category/priority/dueOffsetDays/sortOrder`, `status = OPEN`, `isCustom = false`, `sourceTemplateId = template.id`.
- **Due dates at copy:** `dueDate = weddingDate − dueOffsetDays` when both present; else null.
- **Idempotent + atomic:** guarded by `Wedding.tasksSeededAt`; the inserts + stamping `tasksSeededAt` run in one `prisma.$transaction`. Never runs twice.
- **Backfill:** the checklist loader seeds a couple whose `tasksSeededAt` is null using the same engine (covers pre-Phase-3 weddings / rare failures).
- **Ownership:** operates only on the caller's own wedding (DB-resolved session).

## Due-date recompute

- When a couple sets/changes `weddingDate` (onboarding date step or `/settings/wedding`), recompute `dueDate` for their tasks where `dueDateOverridden = false` and `dueOffsetDays != null`: `dueDate = newWeddingDate − dueOffsetDays`.
- Hand-overridden tasks (`dueDateOverridden = true`) are untouched.
- Clearing the date sets derived due dates back to null; overridden ones stay.
- Only runs if the checklist is already seeded (during onboarding the tasks don't exist yet; `completeOnboarding` seeds with the correct date).

## Couple task actions (ownership-scoped server actions)

Each loads the task, confirms `task.weddingId` == the caller's wedding (DB-resolved session), rejects otherwise. Affect only the caller's own `Task` rows; never templates; never other couples.

- **Complete / reopen** — toggle `status` OPEN↔DONE, set/clear `completedAt`.
- **Edit** — `title_en/title_he/titleLocale/category/priority/dueDate/notes`; hand-setting `dueDate` sets `dueDateOverridden = true`.
- **Delete (soft)** — set `deletedAt = now`; task retains all state, leaves the main list.
- **Restore** — clear `deletedAt` (task returns exactly as it was).
- **Delete permanently** — hard-remove a trashed task.
- **Add custom task** — `isCustom = true`, `sourceTemplateId = null`, appended `sortOrder`; couple supplies title/category/priority and optional due date.
- **Toggle reminder** — `reminderEnabled` + optional `remindAt` (preference only; delivery deferred).

All list/read queries filter `deletedAt: null` (except the trash view, which shows `deletedAt != null`).

## Admin template CRUD (`ADMIN` only)

`/admin/checklist-templates` (existing Phase 1 admin gating):
- **List** all items (incl. inactive), ordered by `sortOrder`, both languages + category/priority/offset/active/titleLocale.
- **Create / edit** — `title_en, title_he, titleLocale, category, priority, dueOffsetDays?, active, sortOrder`.
- **Activate / deactivate** — only `active` items copy to new couples.
- **Reorder** — via `sortOrder` (simple).
- **Delete** — removes the template item; existing couples unaffected (snapshots); `Task.sourceTemplateId` set null.
- Chrome localized; validation via shared Zod.

## Title rendering

Single resolver `resolveTaskTitle(task | template, locale)`:
- `titleLocale === 'EN'` → `title_en`; `=== 'HE'` → `title_he`; `=== 'AUTO'` → `locale === 'he' ? title_he : title_en`.
- Fallback: if the chosen side is empty, use the other. All UI reads titles through this one function so the policy is changeable in one place.

## Couple-facing checklist UI

`/checklist` (inside the onboarding-gated `(app)` group):
- Tasks with a **progress indicator** (X of Y done), groupable/sortable by **category** or **timeline** (overdue / soon / upcoming / no-date / done); filters (category, status, priority).
- Row: complete/reopen checkbox, resolved localized title, category + priority badges, due date, reminder toggle, edit, delete.
- "Add custom task" and a "Recently deleted" (restore / permanently delete) view.
- On-brand (design tokens), RTL, logical properties, no hardcoded chrome strings.

## Localization

- Task/template **titles** = bilingual DB columns rendered via `resolveTaskTitle` (per-item `titleLocale` override).
- All UI **chrome** + `TaskCategory`/`TaskPriority` labels via next-intl (message keys), he default + en, no hardcoded JSX strings (lint gate `--max-warnings 0`).

## Testing

- **Unit:** copy engine (snapshot correctness, idempotency, due-date math), recompute logic, soft-delete/restore, `resolveTaskTitle` (AUTO/EN/HE + fallback), ownership checks on every task action, admin template Zod validation.
- **Integration:** `completeOnboarding` seeds tasks atomically once; a template edit/delete does NOT change existing couples' tasks; recompute on wedding-date change (skips overridden); a couple cannot read/write another couple's tasks; admin CRUD persists.
- **e2e:** onboard → checklist populated; complete a task (progress updates); add a custom task; delete → restore from trash; admin creates a template → a new couple gets it, an already-onboarded couple does not.

## Acceptance criteria

1. Completing onboarding seeds the couple's checklist from active templates (snapshot), exactly once, atomically.
2. A backfill seeds any couple who reaches the checklist unseeded.
3. Editing/deleting a template affects only future couples; existing couples' tasks are untouched.
4. Due dates compute from the wedding date on copy and recompute when it changes, except hand-overridden ones.
5. Couples can complete/reopen/edit/add-custom/set-reminder — only on their own tasks.
6. Delete is soft; tasks are restorable from trash in their exact prior state, and can be permanently deleted.
7. Admin (`ADMIN` only) can create/edit/reorder/activate/delete template items; a seed provides a default bilingual checklist.
8. Titles render through a single resolver that defaults to the couple's language but honors a per-item `titleLocale` override (`AUTO`/`EN`/`HE`); all UI chrome localized (he default + en), no hardcoded strings.
9. A couple can never read or modify another couple's tasks, and only `ADMIN` can touch templates.
10. Full gate green: lint (`--max-warnings 0`), typecheck, unit + e2e.

## Open items / future considerations

- Reminder delivery (Inngest + Resend) and trash auto-purge (Inngest) — later.
- Dependencies / estimated cost on templates — later.
- Folding the admin CRUD into the Phase 8 admin shell.
- "Add from default checklist" (pull in skipped/newly-added defaults) could complement trash-restore later.
