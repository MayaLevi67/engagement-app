# Implementation Log — Wedding Planner AI

Durable per-phase record of what was actually built, the key decisions/deviations from each plan, and the running backlog of deferred follow-ups. The specs (`docs/superpowers/specs/`), plans (`docs/superpowers/plans/`), and git commit history are the primary record; this file consolidates the decisions and the "fix later" backlog that would otherwise live only in scratch notes.

Each phase was built via the superpowers brainstorm → spec → plan → subagent-driven-development (implement + adversarial review per task) → final whole-branch review flow.

---

## Phase 1 — Foundation & Core Domain ✅ merged to `main`

**Spec:** `specs/2026-07-04-foundation-design.md` · **Plan:** `plans/2026-07-04-phase1-foundation.md`
**PR #1**, merged (merge commit `15c0cab`). 11 tasks.
**Delivered:** Next.js 16 monolith; Vitest + Playwright + GitHub Actions CI; Tailwind v4 design tokens + per-locale fonts; Docker Postgres + Prisma; `User`/`Wedding` (couple-sharing) + Auth.js tables; next-intl (Hebrew default/RTL + English); email/password + Google auth, JWT sessions `{id, role, weddingId}`, password reset (Resend), route protection (`proxy.ts`); localized login/register/forgot/reset UI; dormant Inngest + Sentry wiring.
**Verification at merge:** lint (`--max-warnings 0`), typecheck, 27 unit + 3 e2e — all green.

**Key decisions / deviations:**
- **Prisma pinned to 6.19.3** (not 7.x) — Prisma 7 moved datasource URL to `prisma.config.ts` + requires the new `prisma-client` generator; stay on mature 6.x for docs/stability. *(Prisma 7 upgrade = deliberate future task.)*
- **Removed `allowDangerousEmailAccountLinking`** from Google provider (account-takeover vector without email verification). Verified account-linking = future task.
- **Per-locale fonts:** Hebrew = Frank Ruhl Libre (display) + Assistant (body); English = Playfair Display + Inter — applied via inline `--font-display/--font-body` override on `<html>`.
- **Docker Postgres on host port 5433** (5432 taken by another local container). Test DB URL resolves from `.env.test` locally / `process.env` in CI.
- **`proxy.ts` `getToken({ secureCookie: protocol==='https:' })`** — required so the correct `__Secure-authjs` cookie is read in prod HTTPS.
- **CI pins `npm@11`** to match the dev machine's npm (lockfile-resolution consistency).
- next-intl `localeDetection` is ON: an English-preferring browser at `/` routes to `/en` (Hebrew is the fallback default, not forced). *(Product choice — easy to disable if `/` should always be Hebrew.)*

---

## Phase 2 — Onboarding & Wedding Profile ✅ merged to `main`

**Spec:** `specs/2026-07-04-onboarding-wedding-profile-design.md` · **Plan:** `plans/2026-07-04-phase2-onboarding.md`
**PR #2**, merged (merge commit `0056032`). 7 tasks + fixes.
**Delivered:** wedding-profile schema (typed columns + enums on `Wedding`); single field-definition source of truth (`profile-fields.ts`) + Zod; ownership-scoped server actions (create/link wedding, save steps, complete, edit); onboarding gate (redirect to `/onboarding` until `onboardingCompletedAt`, DB-resolved); the localized centered "old-money" onboarding wizard (6 steps, skippable/resumable, he+en); the `/settings/wedding` edit page (reuses the wizard steps).
**Verification at merge:** lint, typecheck, 53 unit + 6 e2e — all green. 12/12 acceptance criteria (countdown *widget* deferred to Phase 7; null-date data behavior works).

**Key decisions / deviations:**
- **Wedding ownership = many `User`s via nullable FK** (couple-sharing), not 1:1. Partner *co-login invite* flow deferred; Phase 2 captures the partner's name only.
- **Dropped a separate `Wedding.language`** field — language is the per-user `User.locale` (avoids two sources of truth; lets partners view in different languages).
- **Hybrid onboarding gate** — only partner names required; everything else skippable/fillable later.
- **Per-item nothing here** — priorities captured as ordered top-3.
- **Final-review fix:** nullable fields couldn't be *cleared* once set (empty → `undefined`, which Prisma ignores) — fixed to send `null` for cleared fields.
- Removed dangerous Google linking (carried from Phase 1 decision).

---

## Phase 3 — Checklist & Timeline ✅ complete (branch `phase-3-checklist`, awaiting push/PR)

**Spec:** `specs/2026-07-05-checklist-timeline-design.md` · **Plan:** `plans/2026-07-05-phase3-checklist.md`
**Branch `phase-3-checklist`**, HEAD `9c0ef45`, 13 commits. 9 tasks + fixes.
**Delivered:** `ChecklistTemplate` (admin master, 44-item bilingual seed) → per-couple `Task` **snapshot copy** at `completeOnboarding()` (idempotent + atomic); relative due-date timeline (compute on copy, recompute on wedding-date change except hand-overridden); couple task actions (complete/edit/soft-delete/restore/permanent-delete/add-custom/reminder-toggle, all ownership-scoped); `/checklist` UI (progress, category/timeline grouping, filters, trash-restore); ADMIN-only template CRUD (`/admin/checklist-templates` + actions, live-DB-role enforced).
**Verification:** lint, typecheck, 113 unit + 9 e2e — all green. 10/10 acceptance criteria.

**Key decisions / deviations:**
- **Snapshot copy, not reference** — template edits/deletes affect **future couples only**; each `Task` is self-contained. `sourceTemplateId` is provenance-only (plain nullable string, nulled on template delete).
- **Per-item `titleLocale` (AUTO/EN/HE)** override — titles render through one resolver defaulting to the couple's locale; admin can pin an item to a language.
- **Soft-delete / trash** (chosen over lightweight re-add) so any task (custom included) is restorable in its exact prior state.
- **Backfill safety net** in the `/checklist` page loader (seeds if `tasksSeededAt` is null) — covers the rare seed-on-complete failure; the underlying `seedTasksForWedding` is idempotent + unit-tested.
- **Admin role enforced via live DB `User.role`** on every template mutation (rejects a stale-JWT admin).
- **Final-review fix:** `/checklist` was missing from the proxy's `APP_PREFIXES` (edge login-gate) — added.

---

## Phase 4 — Wedding Concepts ✅ complete (branch `phase-4-concepts`)

**Spec:** `specs/2026-07-05-wedding-concepts-design.md` · **Plan:** `plans/2026-07-05-phase4-concepts.md`
**Branch `phase-4-concepts`**, base `bdef949` (includes Phase 1–3 merges). 8 tasks.
**Delivered:** `Concept`/`ConceptImage`/`ConceptElement`/`ConceptFavorite` (admin master library) + `Wedding.selectedConceptId`/`favorites` + `Task.sourceConceptElementId` provenance; a bilingual, idempotent seed of 4 concepts (Party Time, Italian Summer, Old Money, Modern Luxury) each with a palette, a cover image, and 3 ideas; `lib/concepts/` (title resolver, Zod schemas, queries incl. `elementToTaskPayload`); couple actions (`chooseConcept`/`clearSelectedConcept`/`toggleFavorite`/`addElementToChecklist`, ownership-scoped, add-once-while-live); admin CMS actions (14 mutations across concept/element/image, live-DB `ADMIN`-gated); `/concepts` login-gated gallery (favorite, selected badge, PREMIUM badge) + detail page (hero, palette, grouped ideas, select/add-to-checklist); minimal `ADMIN` `/concepts` CMS (list + nested element/image editors) mirroring the Phase 3 template admin; a light dashboard nudge ("Choose your wedding concept") shown when `!wedding?.selectedConceptId`; `e2e/concepts.spec.ts` covering the browse→select→push→verify-in-checklist flow and the logged-out redirect.
**Verification:** lint (`--max-warnings 0`), typecheck, 166 unit + 11 e2e — all green. 11/11 acceptance criteria. (Final whole-branch review: **ready to merge**, no Critical/Important; a post-review fix wave added a parametrized non-admin `FORBIDDEN` test across all 14 admin mutations and removed dead code.)

**Key decisions / deviations:**
- **Reference model, not full snapshot (Approach A)** — a couple's relationship to a concept is a live reference (`Wedding.selectedConceptId` + `ConceptFavorite`), so admin edits to inspiration content are reflected. The Phase 3 snapshot pattern is reused only for the one place it earns its keep: pushing an idea creates a self-contained `Task` (`sourceConceptElementId` provenance, `isCustom: true`), frozen against later concept edits.
- **`ConceptElement.category` reuses `TaskCategory`** (no new taxonomy) — makes push-to-checklist a trivial 1:1 field copy and gives the UI free category grouping.
- **Vision board = `ConceptImage` rows with a plain `url` string** (no upload flow this phase) — the schema is upload-ready; a future R2/S3 uploader drops in with no migration.
- **Add-once-while-live via lookup, not a unique constraint** — respects the checklist's soft-delete semantics (`addElementToChecklist` is a no-op while a non-deleted `Task` with that `sourceConceptElementId` exists; re-addable after the couple trashes it).
- **Dashboard nudge is a server-rendered card**, not a dismissible client widget — reads `getCurrentWedding` directly in the dashboard page; gated purely on `selectedConceptId == null` (no separate "dismissed" state modeled this phase).
- **`/concepts` e2e reuses the exact `checklist.spec.ts` register/onboard helper idiom** (fresh-email register → fill partner names → skip remaining steps → land on `/dashboard`) rather than a new auth fixture, per the brief's explicit instruction not to invent a new flow.
- **Premium flag modeled, not enforced** — `Concept.isPremium` renders a badge; actual gating is Phase 9.

**Fix during verification:** the Playwright webserver was reusing a stale `next dev` process holding an un-regenerated Prisma Client from before the Phase 4 migration, causing `prisma.concept` to be `undefined` at runtime (`Cannot read properties of undefined (reading 'findMany')`). Not a code defect — killing the stale process and letting Playwright spawn a fresh server (with `npm run db:generate` re-run) resolved it. Documented here since it can recur for any branch that adds Prisma models while a dev server from an older schema is still running.

---

## Phase 5 — Budget Planning & Optimization ✅ complete (branch `phase-5-budget`)

**Spec:** `specs/2026-07-06-budget-planning-design.md` · **Plan:** `plans/2026-07-06-phase5-budget.md`
**Branch `phase-5-budget`**, base `d34a894` (includes Phase 1–4 merges), HEAD `31c1499`, 13 commits. 8 tasks + final review.
**Delivered:** `BudgetTemplate` (admin-editable baseline % master, seeded to sum 100 across all 12 `TaskCategory`s) + `BudgetAllocation` (per-couple category "pin") + `Wedding.avgGiftPerGuest` + `Task.estimatedCost`/`amountPaid`; pure `lib/budget/` (`priority-map`, `gifts`, `rollup`, a deterministic water-filling `optimize`, Zod `schema`); couple actions (`setBudgetTotal`/`setAvgGiftPerGuest`/`setCategoryAllocation`/`clearCategoryAllocation`/`setTaskAmountPaid`/`setTaskEstimatedCost`, ownership-scoped) + the Phase 3 `setTaskStatus` extended to capture a **skippable paid amount on completion**; admin CMS actions (`admin-budget.ts`, live-DB `ADMIN`-gated, parametrized non-admin `FORBIDDEN` + export-parity reflection); couple `/budget` UI (RSC loader wiring rollup→optimizer→gift, inline-editable total, gift estimator with surplus/shortfall delta, category breakdown with recommended/committed/open + pin/unpin + over-budget/headroom feedback); the checklist completion paid-amount prompt + paid badge; minimal `ADMIN` `/admin/budget-templates` CMS (percent editor + live active-sum indicator) + nav link; dashboard budget card (nudge when no budget, real committed-vs-total summary otherwise); `e2e/budget.spec.ts` (set-budget → complete-task-with-paid → verify it rolls into that category's committed total; logged-out redirect).
**Verification at HEAD:** lint (`--max-warnings 0`), typecheck, **232 unit + 13 e2e** — all green. 12/12 acceptance criteria. (Final whole-branch review: **ready to merge with fixes**, no Critical/Important beyond the dashboard fix, which was applied in `31c1499`.)

**Key decisions / deviations:**
- **Tasks *are* the budget line items** — no parallel expense table. `committed` per category is **derived** (Σ `amountPaid` of DONE, non-deleted tasks), never stored, so revising a paid amount (the "swapped the DJ" case) instantly re-rolls the whole optimization; re-opening a task returns its money to the open pool. The only new per-couple table is `BudgetAllocation` (manual pins).
- **Deterministic water-filling optimizer, not AI.** Baseline % × priority boost, `committed` as a hard floor, pins fixed at `max(pin, committed)`, concept `[min,max]` as soft-floor/hard-ceiling on the open portion, largest-remainder rounding so category totals sum exactly to `budgetTotal`. Feedback = one of `ok`/`over_budget`(shortfall+underfunded)/`headroom`/`committed_overrun`. AI-driven optimization stays **Phase 10**.
- **Three allocation signals, all optional** — the engine degrades: no concept → no clamps; no priorities → no boost; baseline always present. Post-review hardening added `conceptRanges` categories to the allocation universe so a concept's cost in an admin-deactivated category isn't silently dropped.
- **Paid amount on completion is optional/skippable**; validated (reject fractional/negative, `≤100M`) through the shared `taskAmountInput` Zod schema — the same schema both paid-amount entry points use (a post-review fix unified them; the checklist path had been truncating instead of rejecting).
- **Priority→category** is a fixed documented map (`FOOD→CATERING`, `PARTY→MUSIC`, `PHOTOGRAPHY→PHOTOGRAPHY`, `GUEST_EXPERIENCE→GUESTS`, `DESIGN→{DESIGN,FLOWERS}`, `FASHION→ATTIRE`), ×1.5 per matched priority.
- **Gift estimator** = `avgGiftPerGuest × guestCount`, net surplus/shortfall vs the total — a helper to size the budget, not part of the optimizer.
- **Baseline % is an admin-editable master** (chosen over a code constant) for consistency with the Phase 3/4 admin-master pattern; the optimizer normalizes by the active-weight sum, so it stays correct even if the percentages don't total 100.

**Regressions the e2e caught (fixed in `2f21a13`):**
- **Two `lib/actions/budget.ts` Server Action exports were non-async** (the plan's own code wrote them that way) — Next.js 16 rejects non-async exports from a `'use server'` module at **build time**, silently breaking all of `/budget`. Invisible to unit tests + typecheck; only a real build/e2e surfaced it. All six exports are now `async`. *(Lesson: a `'use server'` file requires every export to be an async function — worth a lint rule or CI build step, since unit tests import the functions directly and never hit the boundary.)*
- **`e2e/checklist.spec.ts` was stale** against the new completion prompt (didn't dismiss it) — updated to click "Skip", completion assertion intact.

---

## Deferred follow-ups backlog (non-blocking)

Nothing here blocks any merge. Grouped for future phases/cleanups.

### Security / robustness
- **Concurrent double-seed** (P3): a truly-simultaneous double-submit of `completeOnboarding` could double-seed a wedding (READ COMMITTED, no row lock/unique constraint). Fix: partial unique index `@@unique([weddingId, sourceTemplateId])` or an endpoint guard.
- **`ensureWeddingId` non-atomic** (P2): wedding create + user-link are two statements with no transaction / no unique constraint on `User.weddingId`. Add a transaction / unique constraint.
- **Constant-time login** (P1): `authorize()` returns early on user-not-found without a dummy bcrypt compare — a timing side channel. Add a dummy compare.
- **Password-reset enumeration timing** (P1): the user-exists path awaits the email send while user-missing returns instantly. Fix path: move email delivery to the Inngest queue so both paths enqueue + return immediately (already documented in `reset-password.ts`).
- **`updateTemplate` full-object replace** (P3): omitting a field resets it to a default (the form always sends all fields, so no live bug). Consider a partial-update variant or a doc note.
- **`reorderTemplate`/`setTemplateActive` P2025 race** (P3) and **admin reorder non-atomic** (two writes) — admin-only, self-correcting on refresh.
- **`performPasswordReset` expired-token P2025 race** (P1) — very low likelihood.
- **`addElementToChecklist` read-then-create TOCTOU** (P4, Phase 4): a genuinely concurrent double-click could push the same idea twice (mirrors the existing `addCustomTask` pattern; right-sized for scale, not a unique constraint since soft-delete semantics require a lookup, not an index).
- **Admin `deleteConcept`/`deleteImage`/`deleteElement` don't check `AdminResult.ok`** (P4, Phase 4): the admin CMS UI refreshes its list regardless of whether the delete action actually succeeded, unlike the `templates-admin` precedent which surfaces errors. Low risk (admin-only, self-correcting on refresh) but worth aligning for consistency.
- ~~**Admin non-admin-gate tests only transitive for 13 of 14 Phase 4 admin exports**~~ **RESOLVED** in the post-review fix wave (commit `46586ac`): a parametrized `it.each` now asserts `FORBIDDEN` for a non-admin across all 14 admin exports. *(The equivalent Phase 3 template-action gap remains open — apply the same pattern there.)*

### Reminders / background jobs (arrive with Inngest delivery)
- **Reminder delivery** (P3): the reminder preference (`reminderEnabled` + `remindAt`) is stored but not sent. Build the Inngest job. It must **re-derive** the reminder time (currently `remindAt` = the due date exactly and can go stale if the due date is edited) rather than trust the stored value, and ideally fire *ahead* of the due date.
- **Trash auto-purge** (P3): soft-deleted tasks persist until manually purged; add a scheduled Inngest purge (e.g. 30 days).

### UX / i18n / cosmetics
- **Semantic error-color token** (P2): error text uses raw `text-red-600` in the wizard + edit form; add a token for the "old-money" palette.
- **Date "don't know yet" pre-checked** for new users (P2) — consider default-unchecked.
- **Admin templates list: add a `titleLocale` column** (P3) — the form exposes it, the list doesn't.
- **Couple task edit UI is a subset** (P3): edits only the active-locale title/category/priority/dueDate; `titleLocale` + `notes` + the other-locale title aren't editable by couples yet.
- **Edit prefill fallback-locale** (P3): editing a task whose active-locale title is empty prefills the other locale's text and can copy it cross-locale on save.
- **Localize document `<title>` metadata** (P1): `app/layout.tsx` title is hard-coded English.
- **Date-only timezone off-by-one** (P3): a UTC-midnight `dueDate` can shift a day in zones behind UTC (benign for Israel, UTC+2/3). Consider date-only normalization.
- **Bilingual `pick(he, en)` helper duplicated** (P3, Phase 4): the `locale === 'he' ? (he ?? en ?? '') : (en ?? he ?? '')` ternary is repeated in both `concepts/page.tsx` and `concepts/[conceptId]/page.tsx` loaders instead of living in `lib/concepts/title.ts` alongside the title resolver. Cosmetic; extract when a third call site appears.
- **Favorite button nested inside the concept card's `Link`** (P3, Phase 4): works via `preventDefault()` but is a borderline a11y pattern (interactive-inside-interactive); consider restructuring if an accessibility audit flags it.
- **Back-arrow `←` not RTL-mirrored in Hebrew** (P3, Phase 4): `formatBackLabel` prepends a literal `←` regardless of locale; should flip to `→` (or use a logical/mirrored icon) under RTL.
- **Hardcoded inactive-concept label was fixed during Phase 4 Task 7 review**, but the render path for `AdminConcepts.inactiveLabel` isn't auto-tested (P4) — manual-only verification so far.

### Tooling / tech-debt
- **Prisma 7 upgrade** (P1/P3): currently pinned 6.19.3; `package.json#prisma` seed config emits a 6.19.3 deprecation warning. Migrate to `prisma.config.ts` when upgrading to 7.
- **zod v4 deprecated APIs** (P2/P3): `z.nativeEnum`/`.merge` are deprecated-but-functional; swap to `z.enum`/`.extend` when a zod major forces it.
- **`db:seed` reverts admin edits** (P3): re-running the default-checklist seed overwrites admin-edited template fields; the same is now true of the Phase 4 concept seed (deleteMany+createMany replaces child rows on every re-seed). Fine for dev/seed-once; note when Phase 8 admin work lands.
- **Weak/tautological tests to strengthen**: `design-tokens.test.tsx` (P1, asserts class strings not CSS), a dedicated `authorizeRoute` login-gate unit test (P1), an explicit logged-out-hits-`/admin` assertion (P1), a direct test for the `/checklist` page backfill wiring (P3).
- **JWT callback inline casts** (P1): augment the `authorize` User return type to catch field-rename typos at compile time.
- **Concept-child cuid churn on reseed** (P3, Phase 4): `deleteMany`+`createMany` regenerates `ConceptImage`/`ConceptElement` cuids on every `db:seed` run; a pushed `Task.sourceConceptElementId` referencing a re-seeded element id would go stale after a reseed. Mitigated by `elementToTaskPayload` snapshotting the title/category (not just the id) — no user-visible bug, just a provenance-tracing limitation in dev.
- **Image-upload flow deferred** (Phase 4 non-goal, tracked for a later phase): vision-board photos are admin-pasted URL references; the `ConceptImage` schema (`url` + alt text + `sortOrder`) is upload-ready, so a drag-drop uploader (e.g. Cloudflare R2) is purely additive whenever it's prioritized.
- ~~**Budget optimization consuming concepts** (Phase 5)~~ **DONE** in Phase 5 — the optimizer sums the selected concept's `estCostMin`/`estCostMax` by category into floor/ceiling clamps (`sumConceptRanges` + `optimizeBudget`).
- **Unwired-but-shipped budget surface** (P5): `setTaskAmountPaid`/`setTaskEstimatedCost`, the `planned` half of `rollupTasks`, and the concept-midpoint `estimatedCost` seeding are implemented + tested but have no UI consumer yet — reserved for a future per-task budget editor. Wire when that editor is built.
- **Older admin PAGE loaders gate on stale JWT role** (P3/P4): `admin/checklist-templates/page.tsx` + `admin/concepts/page.tsx` redirect based on `session.user.role` (JWT), not a live-DB read — a stale-JWT demoted admin can *view* (not mutate — mutations re-check live DB) those pages. Phase 5's `admin/budget-templates/page.tsx` does it right; back-port the live-DB read to the two older loaders.
- **Orphan i18n keys** (P5): `Budget.currencySymbol/spentAbovePin/taskPaidLabel/taskEstimateLabel` + `AdminBudget.categoryLabel/orderLabel` are defined (he+en) but unused; prune or wire.
- **Reopen→skip→recomplete keeps old `amountPaid`** (P5): re-opening a DONE task leaves its paid amount; re-completing via "Skip" (null) doesn't clear it, so it silently returns to committed, and the prompt doesn't prefill the prior value. Edge-case UX.
- **`admin-concepts.test.ts` lacks export-parity reflection** (P4): back-port the `admin-budget.test.ts` `Object.keys(module)` parity assertion so a new ungated admin-concepts export can't slip the non-admin gate.
- **`e2e/budget.spec.ts` selector brittleness** (P5): keys off `getByRole('spinbutton').first()`, which only works because skipped onboarding leaves `guestCount` null; add a `data-testid` before the flow grows a second number input.
- **Vendor recommendations per idea** (Phase 6): not started; concept ideas are the anchor Phase 6 will hang recommendations off.
- **Premium paywall enforcement** (Phase 9): `Concept.isPremium` renders a badge only; every couple can currently open/select premium concepts. Real gating arrives with payments.

---

## Roadmap position

Done: Phase 1 (Foundation), Phase 2 (Onboarding & Profile), Phase 3 (Checklist & Timeline), Phase 4 (Wedding Concepts), Phase 5 (Budget Planning & Optimization).
Next: **Phase 6 — Vendor Database** (recommendations per concept idea + vendor quotes). Then Dashboard (7), Admin Panel (8), Premium/Payments (9, enforces `isPremium` + real transactions), AI Multi-Agent Layer (10, AI-driven budget optimization on top of Phase 5's engine).
