# Wedding Planner AI — Phase 8: Admin Panel

**Status:** Approved for planning
**Date:** 2026-07-08
**Builds on:** Phase 1 (Foundation), Phase 2 (Onboarding & Wedding Profile), Phase 3 (Checklist & Timeline), Phase 4 (Wedding Concepts), Phase 5 (Budget Planning & Optimization), Phase 6 (Vendor Database), Phase 7 (Dashboard)

## Context

Phases 1–7 built four admin CMSes as **standalone pages** under `/admin`, each authored in its own phase: `/admin/checklist-templates` (Phase 3), `/admin/concepts` (Phase 4), `/admin/budget-templates` (Phase 5), `/admin/vendors` (Phase 6). The `/admin` landing page today is a bare `<ul>` of links plus a placeholder string, and there is **no shared admin layout** — each CMS page re-implements its own auth/role gate and outer page wrapper. Those gates are **inconsistent**: `budget-templates` and `vendors` read the role from the **live DB** (correct), but `checklist-templates` and `concepts` still gate on the **stale JWT claim** (`session.user.role`) — a logged follow-up (view-only exposure for a stale-JWT demoted admin; mutations already re-check live-DB, so it's not privilege escalation). Admin authorization on every *mutation* is already live-DB-gated via each module's `requireAdmin()`.

Phase 8 is the **Admin Panel**: a **polished shared shell** over those four CMSes. It introduces one shared `/admin` **layout** that enforces admin access **once** (live-DB), provides consistent chrome (header + section nav), and turns the landing page into a real **overview**. It also folds in the accumulated admin-related **cleanups** (the stale-JWT gate, `updateConcept`'s flag-stomp, the `admin-concepts` export-parity test gap, and the image add/delete `AdminResult.ok` checks). It adds **no new admin data domains** — no user/couple management, no role changing, no audit log (explicitly out of scope).

## Goals

- A **shared `/admin` layout** (`app/[locale]/admin/layout.tsx`) that gates all `/admin/*` routes with a single **live-DB** admin check and renders the shared chrome (header + section nav), so the four CMS pages stop re-implementing the gate and wrapper.
- A real **admin overview** at `/admin` — read-only counts of admin-managed content (checklist templates, concepts, active vendors, budget-baseline sum with a ≠100 warning) as cards that double as quick links — replacing the bare link list.
- A consistent **section nav** (sidebar on desktop, collapsing above content on mobile; RTL-mirrored) linking the overview + the four CMSes, with the active section highlighted.
- **Consolidation:** the two stale-JWT page loaders are fixed by the shared layout's live-DB gate; the four CMS pages shed their bespoke gate + outer wrapper and render inside the shell.
- **Backlog cleanups folded in:** `updateConcept` writes content fields only (leaving `isPremium`/`active`/`sortOrder` to their dedicated setters); `admin-concepts` gains the `Object.keys(module)` export-parity test; the concepts + vendors admin **image** add/delete surface errors / refresh only on success.
- No new schema, no new admin capabilities beyond the shell + overview.

## Non-goals (deferred)

- **User / couple management & role changing.** No listing users, editing couples, or promoting/demoting `User.role` — a privileged operation with its own guardrails; deferred (you scoped it out).
- **Audit log** of admin actions. Not modeled this phase.
- **New admin data domains / seed controls.** No re-seed buttons, no new managed entity.
- **Premium / AI admin surfaces.** Phase 9/10.
- **Reworking the four CMSes' internals.** They keep their existing forms/actions/tests; Phase 8 only rehosts them in the shell, removes their duplicated gate/wrapper, and applies the named cleanups (`updateConcept`, image-ok, export-parity) — not a redesign of their editors.

## Key decisions

1. **One gate in the layout, live-DB.** `app/[locale]/admin/layout.tsx` performs the single server-side admin check for the whole `/admin` subtree: `auth()` (→ `/login` if none) then a fresh `prisma.user.findUnique({ select: { role } })` (→ `/dashboard` if not `ADMIN`) — the exact pattern `budget-templates`/`vendors` already use. A Next.js layout wraps and short-circuits its pages on `redirect()`, so this protects every current and future `/admin/*` route. The four page loaders **drop their own auth/role checks** (DRY; the stale-JWT ones are thereby fixed). Mutation-level `requireAdmin()` in the action modules stays as the real security boundary (defense-in-depth). The edge `proxy.ts` `/admin` gate (JWT-based) stays as a first-pass.
2. **Overview is read-only aggregation, no new schema.** The landing page runs a few cheap indexed `count()` queries (+ the budget-baseline sum) and renders cards. Mirrors the Phase 7 dashboard-aggregation approach: a small `lib/admin/overview.ts` composer keeps the counts logic out of the page and unit-testable where pure.
3. **Shell chrome lives in the layout, content in the pages.** The layout owns the header + section nav + the max-width container; each CMS page renders only its own content (list/forms). This removes the duplicated `<main className="mx-auto ...">` wrappers from the four pages.
4. **Section nav is data-driven + RTL-aware.** A single `ADMIN_SECTIONS` list (path + i18n label key) drives the nav; the active section is derived from the current path. Logical Tailwind props mirror the sidebar to the right under Hebrew.
5. **`updateConcept` content-only update** (the flag-stomp fix, mirroring the Phase 6 `updateVendor` fix): strip `isPremium`/`active`/`sortOrder` from the update payload — those are owned by `setConceptActive`/`setConceptPremium`/`reorderConcept` — and write only the content fields (`title_*`, `titleLocale`, `tagline_*`, `description_*`, `palette`). Add a regression test.
6. **`admin-concepts` export-parity test** — add the `Object.keys(adminConcepts)` reflection assertion (matching `admin-budget`/`admin-vendors`) so a newly-added ungated export can't slip the non-admin `FORBIDDEN` gate.
7. **Image `AdminResult.ok` handling** — in the concepts + vendors admin image editors, the add/delete handlers check the returned `AdminResult.ok` and surface an error / only refresh on success, instead of refreshing unconditionally (matching the `templates-admin` precedent).
8. **No new schema; no privileged new operations.** The panel only reads counts and re-hosts existing CMSes.

## Scale & cost calibration

Right-sized to a few thousand couples and a tiny admin set. The layout adds one indexed `User.role` read per admin page navigation (negligible, admin-only traffic). The overview is a handful of `count()` queries — cheap and admin-only. No new tables, no new services, no background jobs. The shell is static chrome; nav state is derived from the path (no persistence).

## Data model

**No changes.** Phase 8 reads existing models for counts (`ChecklistTemplate`, `Concept`, `Vendor`, `BudgetTemplate`, `User`) and re-hosts existing CMSes.

## Domain logic & queries

**`lib/admin/overview.ts` (counts composer — thin, tested where pure):**
- `getAdminOverview(): Promise<AdminOverview>` — runs the counts in parallel: `checklistTemplates` (total + active), `concepts` (total + active), `vendors` (global total + active — `weddingId: null`), `budgetBaselineSum` (Σ active `defaultPercent`) and a `budgetBalanced: boolean` (== 100). Uses `prisma.*.count()` / a small `findMany` for the sum.
- A pure helper `budgetBaselineStatus(rows): { sum: number; balanced: boolean }` extracted so the ≠100 logic is unit-tested without a DB.

**`lib/admin/sections.ts` (nav config — pure):**
- `ADMIN_SECTIONS: { key; href; labelKey }[]` — overview + the four CMSes.
- `activeSectionKey(pathname): string` — derive the highlighted section from the current path (locale-prefix tolerant). Pure, unit-tested.

**Auth:** no new auth module — the layout reuses the established `auth()` + live-DB `User.role` read (the `budget-templates`/`vendors` pattern). No new server actions for the shell/overview (read-only).

**Cleanup targets (existing modules):**
- `lib/actions/admin-concepts.ts` — `updateConcept` content-only write (decision 5).
- `lib/actions/admin-concepts.test.ts` — export-parity assertion (decision 6) + a flag-preservation regression test.
- `app/[locale]/admin/concepts/concept-form.tsx` + `app/[locale]/admin/vendors/vendor-form.tsx` — image add/delete `AdminResult.ok` handling (decision 7).

## UI & navigation

**`app/[locale]/admin/layout.tsx` (RSC):** the single gate + the shell. `auth()` → `/login`; live-DB role → `/dashboard` for non-admins. Renders: an admin **header** (title + a link back to the app), a **section nav** (from `ADMIN_SECTIONS`, active section highlighted), and `{children}` inside a shared max-width container. Sidebar on `sm+`, collapsing to a top strip on mobile; logical props so the sidebar sits on the right in Hebrew.

**`app/[locale]/admin/page.tsx` (RSC, overview):** calls `getAdminOverview()` and renders **cards** — one per section — showing its count(s) and linking to the CMS. The budget card shows the baseline sum and a warning when `!balanced`. Replaces the bare `<ul>`.

**`nav.tsx` (client, small):** the section nav list; uses the current pathname (via the i18n navigation helper) to highlight the active section; all labels via i18n.

**The four CMS pages** (`checklist-templates`, `concepts`, `budget-templates`, `vendors`): remove their own `auth`/role gate and their outer `<main className="mx-auto ...">` wrapper (now the layout's); keep their content components + loaders' data fetching. Their client components, forms, and actions are otherwise unchanged (except the concepts/vendors image-ok cleanup).

**i18n / RTL:** the **section-nav labels reuse the existing per-CMS `title` keys** (`AdminTemplates.title`, `AdminConcepts.title`, `AdminBudget.title`, `AdminVendors.title` — as the current `/admin` list already does), so no duplicate label keys are introduced. The `Admin` namespace is expanded (he + en, identical keys) only for the panel-level chrome: panel title, an "Overview" nav label, the overview card labels/counts, and the budget-imbalance warning. No hard-coded strings (ESLint-enforced). Logical Tailwind props (sidebar mirrors under RTL); design tokens; `font-display` for the panel header.

## Error handling & edge cases

- **Non-admin / logged-out** — the layout redirects (`/dashboard` for a logged-in non-admin, `/login` for anonymous) before any `/admin/*` page renders. A **stale-JWT** demoted admin is now correctly bounced (live-DB read), closing the backlog gap.
- **Defense-in-depth** — mutation actions keep their own `requireAdmin()` (live-DB); the layout gate does not replace it. The edge `proxy.ts` `/admin` prefix gate remains.
- **Overview counts** — pure `count()`s; an empty catalog shows `0` (no crash). The budget-baseline card warns when the active sum ≠ 100 (reuses the same rule as the budget-templates CMS).
- **Active-section highlight** — `activeSectionKey` tolerates the optional `/en` locale prefix and trailing segments (a CMS sub-path still highlights its section); an unknown path highlights nothing (no crash).
- **`updateConcept`** — a partial content edit no longer resets `isPremium`/`active`/`sortOrder` (regression-tested); those change only via their dedicated setters.
- **Image actions** — a failed `addImage`/`deleteImage`/`addVendorImage`/`deleteVendorImage` now surfaces the error instead of silently refreshing as if it succeeded.
- **RTL** — the sidebar and active-highlight render correctly mirrored in Hebrew.

## Testing strategy

Mirrors prior phases (unit-heavy + focused e2e).

- **Unit (Vitest):**
  - `lib/admin/overview.test.ts` — `budgetBaselineStatus` (sum + balanced at exactly 100, under, over); `getAdminOverview` count wiring is exercised in e2e (DB-backed).
  - `lib/admin/sections.test.ts` — `activeSectionKey` for each section path, with/without the `/en` prefix, sub-paths, and an unknown path.
  - `lib/actions/admin-concepts.test.ts` — **the export-parity `Object.keys` assertion**; a **`updateConcept` flag-preservation** regression (a payload omitting `isPremium`/`active`/`sortOrder` does not write them); existing cases stay green.
- **Component (Vitest + RTL):** the section nav (renders all sections, highlights the active one); an overview card (count + link, budget warning when imbalanced); the concepts/vendors image editor surfaces an error when the action returns `{ ok: false }`.
- **E2E (Playwright):** a **USER** (non-admin) is redirected away from `/admin` **and** each `/admin/*` sub-route (`/admin/concepts`, `/admin/vendors`, …) — verifying the shared gate; an **ADMIN** sees the shell nav + the overview cards and can navigate to each CMS via the nav; the active section highlights. (Admin e2e needs an admin user — seed/promote one in the test setup, mirroring how existing admin-touching tests obtain an admin, or via a direct DB role set in the spec's setup.)

## Acceptance criteria

1. All `/admin/*` routes are gated by a single **live-DB** admin check in the shared layout; a logged-in non-admin is redirected to `/dashboard`, an anonymous visitor to `/login` — including a **stale-JWT** demoted admin (previously able to view the checklist-templates/concepts pages).
2. The four CMS pages render inside the shared shell (header + section nav) and no longer carry their own auth gate or outer wrapper; their editing behavior is otherwise unchanged.
3. `/admin` shows an **overview** of read-only counts (checklist templates, concepts, active vendors, budget-baseline sum with a ≠100 warning) as cards linking to each CMS — replacing the bare link list.
4. The section nav lists the overview + four CMSes, highlights the active section, and mirrors correctly under RTL (Hebrew).
5. `updateConcept` no longer resets `isPremium`/`active`/`sortOrder` on a partial content edit (regression-tested); those change only via their dedicated setters.
6. `admin-concepts` has the `Object.keys(module)` export-parity test; the concepts + vendors admin image add/delete surface errors instead of refreshing unconditionally.
7. No new schema; no user/role-management or other new admin capability.
8. No hard-coded strings (ESLint clean); he/en key parity; logical properties render RTL + LTR.
9. `lint --max-warnings 0`, typecheck, and all unit + component + e2e tests green.

## Roadmap position

Done: Phase 1 (Foundation), Phase 2 (Onboarding & Profile), Phase 3 (Checklist & Timeline), Phase 4 (Wedding Concepts), Phase 5 (Budget Planning & Optimization), Phase 6 (Vendor Database), Phase 7 (Dashboard).
**This: Phase 8 — Admin Panel.** Next: Premium/Payments (9, enforces `isPremium` + real transactions), AI Multi-Agent Layer (10). User/couple management, an audit log, and in-app vendor messaging remain candidate future additions that the shared shell now has a clean home for.
