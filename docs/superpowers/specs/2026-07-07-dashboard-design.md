# Wedding Planner AI — Phase 7: Dashboard

**Status:** Approved for planning
**Date:** 2026-07-07
**Builds on:** Phase 1 (Foundation), Phase 2 (Onboarding & Wedding Profile), Phase 3 (Checklist & Timeline), Phase 4 (Wedding Concepts), Phase 5 (Budget Planning & Optimization), Phase 6 (Vendor Database)

## Context

Phases 1–6 delivered the full feature set: auth + i18n (he default/RTL + en), the `Wedding` profile (partner names, `weddingDate` + `dateIsApproximate`, `guestCount`, `budgetTotal`, `city`, `venueSetting`, `selectedConceptId`), the checklist (`Task` with `category`/`status`/`dueDate`, `getTasks`), the concepts library (`selectedConcept`), the budget engine (`rollupTasks` → committed/planned), and the vendor directory (`getWeddingQuotes` → shortlist/quote rows with a status lifecycle). The `/dashboard` route today is a placeholder string plus three static nudge cards (choose-concept / set-budget / find-vendors) — it does not yet aggregate anything.

Phase 7 is the **Dashboard**: turn `/dashboard` into a real post-onboarding **home view** that pulls the phases together at a glance. It is a **read-only aggregation + presentation layer** — no new data, no inline mutations. It finally delivers the **wedding-date countdown widget explicitly deferred from Phase 2**, plus per-section overview cards (checklist progress, budget committed-vs-total, vendors shortlisted/booked, chosen concept) and a "next up" task list. Each overview card is **dual-mode**: a live summary when the section has data, or a nudge (preserving today's behavior) when it doesn't.

This is a couple-facing presentation feature only — no admin surface, no new schema, no charts library.

## Goals

- A **countdown hero**: partner names + "N days to go" derived from `weddingDate`, with graceful states for no date and `dateIsApproximate`.
- **Four dual-mode overview cards**, each linking to its section: **Checklist** (done/total + progress + overdue count), **Budget** (committed ₪ of total ₪ + remaining), **Vendors** (shortlisted / booked counts), **Concept** (chosen name + palette swatches). Each renders a **nudge** when its data is absent.
- A **"Next up"** list — the next few upcoming/overdue open tasks (title + due date), linking into `/checklist`.
- A small, unit-tested **aggregation seam** (`lib/dashboard/aggregate.ts`) that composes the existing per-phase queries and computes the pure derivations (countdown, progress %, budget remaining, vendor counts, next-up ordering, dual-mode selection).
- No new Prisma models/fields; no new external services.

## Non-goals (deferred)

- **Inline actions.** The dashboard is read-only (per the design decision) — completing a task, adding to the budget, etc. happen on the feature pages. Only navigation links here.
- **New schema / new data.** Pure aggregation of what phases 1–6 already store.
- **A charting library.** Progress is a simple token-styled bar; no external chart dependency.
- **Realtime / websockets.** Server-rendered on each load (data is small and cheap).
- **Admin dashboard / analytics.** Out of scope; a separate admin surface is Phase 8.
- **Premium / AI dashboard variants.** Phase 9/10.
- **Reordering / customization / dismissible widgets.** Fixed layout this phase (no per-couple dashboard state).

## Key decisions

1. **Read-only aggregation layer, one composer.** A single `lib/dashboard/aggregate.ts` `getDashboardData(wedding)` composes `getTasks`, `rollupTasks`, `getWeddingQuotes`, and the selected-concept lookup into one `DashboardData` object, and computes all derived values. The `/dashboard` page loader calls it once and renders — no query logic in the page. This keeps the derivations pure and testable and the page thin.
2. **Pure derivations, separately unit-tested.** The value logic — `daysUntilWedding`, checklist progress, budget summary, vendor counts, `nextUpTasks`, and the dual-mode summary-vs-nudge decision — are pure functions over already-fetched data (no I/O), so they unit-test without a DB. The DB composition is covered by e2e.
3. **Dual-mode cards, not separate "nudge" vs "summary" components.** Each card takes its section's summary (possibly "empty") and renders a live summary or a nudge accordingly — preserving the current nudge UX while adding real data. One component per section, one clear responsibility.
4. **Countdown is computed, not stored.** `daysUntilWedding(weddingDate, now)` returns days (0 = today, negative = past → "the big day has passed / just married" state), or `null` when no date; `dateIsApproximate` renders a soft "~around" label instead of a hard count. No new field — this is the Phase 2-deferred widget, implemented purely.
5. **"Next up" = soonest open tasks.** Derived from `getTasks` (non-deleted): filter to `status: OPEN`, sort by `dueDate` (nulls last), flag overdue (`dueDate < today`), take the first few. Reuses the checklist's existing date semantics; no new query.
6. **No new schema, no per-couple dashboard state.** Layout is fixed; there is no "dismiss" or "reorder" persistence this phase (a deliberate YAGNI cut).
7. **Behind the existing onboarding gate.** `/dashboard` is already inside the `(app)` layout that redirects to `/onboarding` until complete, so a `Wedding` always exists; the aggregator assumes a wedding and handles per-section emptiness, not a missing couple.

## Scale & cost calibration

Right-sized to a few thousand couples. The dashboard load is a handful of indexed per-wedding reads (tasks, vendor quotes, one concept row) plus O(tasks) in-memory derivations — the same queries the feature pages already run, just composed once. Nothing is persisted, no new services, no background jobs. Server-rendered per request; the data is small enough that caching is unnecessary at this scale.

## Data model

**No changes.** Phase 7 reads existing models only (`Wedding`, `Task`, `VendorQuote`, `Concept`). All fields it needs already exist.

## Domain logic & queries

**`lib/dashboard/aggregate.ts` (composition + pure derivations, unit-tested):**

Pure helpers (no I/O — unit-tested):
- `daysUntilWedding(weddingDate: Date | null, now: Date): number | null` — whole days from `now` (start-of-day) to the date; `null` if no date; negative if past.
- `checklistProgress(tasks): { done: number; total: number; pct: number; overdue: number }` — `total` = non-deleted tasks, `done` = `status DONE`, `overdue` = open tasks with `dueDate < today`.
- `budgetSummary(wedding, tasks): { total: number | null; committed: number; remaining: number | null; pct: number } | null` — reuses `rollupTasks` (committed = Σ `amountPaid` of DONE); `null` when `budgetTotal` is null (nudge).
- `vendorCounts(quotes): { shortlisted: number; booked: number }` — `shortlisted` = all quote rows, `booked` = `status BOOKED`.
- `nextUpTasks(tasks, now, limit): Array<{ id; title fields; dueDate; overdue: boolean }>` — soonest open tasks, overdue flagged.

Composer (I/O — thin, e2e-covered):
- `getDashboardData(wedding): Promise<DashboardData>` — runs `getTasks(wedding.id)`, `getWeddingQuotes(wedding.id)`, and the selected-concept lookup (name + palette) in parallel, then assembles `{ countdownDays, dateIsApproximate, partner1Name, partner2Name, checklist, budget, vendors, concept, nextUp }`. Each section is either a summary or a null/empty marker the card reads for dual-mode.

The selected concept is fetched with a minimal select (id, `title_en`/`title_he`/`titleLocale`, `palette`) — resolved for display via the existing `resolveConceptTitle`. No new query file needed beyond the aggregator (or reuse `getConceptDetail` and pick the fields).

**No new server actions** — the dashboard performs no mutations.

## UI & navigation

**`app/[locale]/(app)/dashboard/page.tsx`** (RSC) — auth + `getCurrentWedding` (already gated by the `(app)` layout), calls `getDashboardData`, serializes, renders the hero + card grid + next-up. Replaces the current placeholder + three nudge cards.

**Components (`app/[locale]/(app)/dashboard/`):**
- `countdown-hero.tsx` — partner names + days-to-go (or the no-date / approximate / passed states). Server or client component (static; no interactivity).
- `overview-cards.tsx` (or one file per card kept small) — the four dual-mode cards (`checklist-card`, `budget-card`, `vendors-card`, `concept-card`); each shows a summary or its nudge and links to the section.
- `next-up.tsx` — the upcoming/overdue task list.
- Keep files focused; if a single file grows past ~200 lines, split per card.

**i18n / RTL:** expand the `Dashboard` namespace (he + en, **identical key sets**, ICU for counts/day-plurals) — countdown labels, card titles/summaries/nudges, "next up", empty states. No hard-coded strings (ESLint-enforced). Logical Tailwind props (`ps-`/`pe-`/`text-start`); `₪`/number/date formatting via the locale helpers; old-money design tokens; `font-display` hero.

**Layout:** a countdown hero, then a responsive grid of the four cards (1 column mobile, 2-up wider), then the "next up" list. No new nav item (the dashboard *is* the home).

## Error handling & edge cases

- **No `weddingDate`** → countdown shows a "set your date" state linking to `/settings/wedding`; no crash.
- **`dateIsApproximate`** → soft "~around \<month/year\>" label instead of a hard day count.
- **Wedding date today / in the past** → `daysUntilWedding` returns `0` / negative; render "today's the day" / a gentle post-wedding state (no negative counts shown as a bare number).
- **Empty sections** — no budget / no concept / no vendors / no tasks → the relevant card renders its nudge (dual-mode); "next up" shows an all-done / no-tasks empty state.
- **Tasks not yet seeded** (rare) — the checklist page has the seed backfill; the dashboard reads whatever exists and shows 0/0 (or a "get started" nudge) rather than seeding (seeding stays the checklist page's job).
- **Deleted/soft-deleted tasks** excluded from all counts (reuse `getTasks`, which filters `deletedAt: null`).
- **Ownership** — the loader uses the session-resolved wedding (the `(app)` layout guarantees an onboarded couple); no cross-wedding data.
- **Locale/RTL** — day/plural strings via ICU; the hero and cards mirror correctly under Hebrew.

## Testing strategy

Mirrors prior phases (unit-heavy + focused e2e).

- **Unit (Vitest):** `lib/dashboard/aggregate.test.ts` — `daysUntilWedding` (future/today/past/null/approximate-ignored-by-the-number); `checklistProgress` (done/total/pct rounding, overdue count, all-empty); `budgetSummary` (committed via rollup, remaining, null-budget → null, pct); `vendorCounts` (shortlisted vs booked); `nextUpTasks` (open-only, dueDate ordering with nulls last, overdue flag, limit). Dual-mode selection helpers (summary vs nudge) asserted.
- **Component (Vitest + RTL):** countdown hero states (days / no-date / approximate / passed); each overview card in summary mode and nudge mode; next-up list (items + empty state).
- **E2E (Playwright):** after register→onboard (+seeded checklist), the dashboard shows the countdown (or set-date state), the checklist progress card, and the section cards; setting a budget then reloading shows the budget summary (not the nudge); an empty section shows its nudge. Reuse the inline register/onboard helper idiom from the sibling specs.

## Acceptance criteria

1. `/dashboard` shows a **countdown hero** (partner names + days-to-go) from `weddingDate`, with graceful no-date / approximate / passed states — he + en, RTL correct.
2. Four **overview cards** render: checklist (done/total + progress + overdue), budget (committed of total + remaining), vendors (shortlisted / booked), concept (name + palette) — each links to its section.
3. Each card is **dual-mode**: a live summary when data exists, a nudge when it doesn't (e.g. no budget → "set a budget" nudge).
4. A **"Next up"** list shows the soonest open tasks (overdue flagged), linking to `/checklist`; an empty/all-done state renders when there are none.
5. All values are computed by **pure, unit-tested derivations** over existing queries; **no new schema** and **no mutations** are introduced.
6. Empty/edge states (no date, no budget, no concept, no vendors, no tasks, past date) all render friendly states — nothing errors.
7. No hard-coded strings (ESLint clean); he/en key parity; logical properties render RTL + LTR; `₪`/dates locale-formatted.
8. `lint --max-warnings 0`, typecheck, and all unit + component + e2e tests green.

## Roadmap position

Done: Phase 1 (Foundation), Phase 2 (Onboarding & Profile), Phase 3 (Checklist & Timeline), Phase 4 (Wedding Concepts), Phase 5 (Budget Planning & Optimization), Phase 6 (Vendor Database).
**This: Phase 7 — Dashboard.** Next: Admin Panel (8), Premium/Payments (9, enforces `isPremium` + real transactions), AI Multi-Agent Layer (10). The read-only aggregation seam (`lib/dashboard/`) is a natural place a future AI "what should I do next?" summary could plug in.
