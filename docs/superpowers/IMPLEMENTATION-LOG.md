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

## Phase 9 — Premium / Payments ✅ complete (branch `phase-9-premium`)

**Spec:** `specs/2026-07-08-premium-payments-design.md` · **Plan:** `plans/2026-07-08-phase9-premium.md`
**Branch `phase-9-premium`**, base `9434104` (includes Phase 1–8 merges), HEAD `139f3b3`, 11 commits. 6 tasks + final review.
**Delivered:** a **one-time Premium unlock per wedding** (`Wedding.premiumUnlockedAt`, shared by partners) via **Stripe hosted Checkout**, granted **solely** by a signature-verified, idempotent webhook. New `Payment` model + `PaymentStatus`; pure `lib/premium/entitlement.ts` (`isPremium`, `capChecklist`); `lib/premium/gate.ts` (`requireWedding`/`requirePremiumWedding`); `lib/stripe/{client,checkout,webhook}.ts`; `lib/actions/premium.ts` (`startCheckout`); `app/api/stripe/webhook/route.ts` (Node runtime, raw-body signature verify). **Enforcement:** all six budget mutations + `pushQuoteToBudget` unconditionally premium; premium-concept (`chooseConcept`/`addElementToChecklist`) + premium-vendor (`toggleShortlist`/`setQuote*`/`linkQuoteToTask`) actions conditionally premium (item `isPremium` freshly loaded); checklist display-capped to 10 for free (`capChecklist`). **UI:** budget paywall, checklist "+N more" teaser, concept/vendor locks, dashboard upgrade card + `?upgraded=1` confirming state, a shared `UpgradeButton` — **no dedicated `/premium` page** (upgrade is an action). Stripe **mocked in all tests** (no live calls).
**Verification at HEAD:** lint (`--max-warnings 0`), typecheck, **366 unit + 22 e2e** — all green. 9/9 acceptance criteria. (Final whole-branch security review: **ready to merge — yes**, no Critical/Important; two recommended money-path hardenings applied in `139f3b3`.)

**Key decisions / deviations:**
- **The webhook is the sole authoritative grant.** `premiumUnlockedAt` is written in exactly one place (`handleStripeEvent`) — verified tree-wide, including that the onboarding `update({ data: parsed.data })` can't smuggle it (zod strips unknown keys). The client success redirect (`?upgraded=1`) never grants — it only shows a "confirming…" note until the near-instant webhook resolves.
- **Idempotent, settled-only grant.** `payment_status === 'paid'` required; `Payment` upsert keyed by the unique `stripeCheckoutSessionId`; grant is a `wedding.updateMany({ where: { premiumUnlockedAt: null } })` conditional set-once — replays/duplicates/concurrent deliveries are no-ops. The upsert + grant are wrapped in a `prisma.$transaction` (atomic single delivery — final-review hardening).
- **Enforcement gradient** (right-sized): budget + premium concepts/vendors are **server-enforced** (`PREMIUM_REQUIRED`); the checklist 10-cap is **loader-side display only** (own data, no cross-tenant risk).
- **Hosted Checkout, secret server-only.** `mode: 'payment'` + a configured Stripe **Price** (`STRIPE_PRICE_ID`; amount/currency never hardcoded); `STRIPE_SECRET_KEY` read only in `lib/stripe/*` (no `NEXT_PUBLIC_`, no client import); webhook route public + signature-gated (proxy matcher already excludes `/api/*`).
- **Upgrade is an action, not a page** — dashboard card + inline gate CTAs → `startCheckout` → Stripe → returns to `/dashboard`; nothing orphaned post-upgrade.
- **ACCEPTED product decision (user):** the free checklist cap is a hard first-10; a free couple's own added/pushed task can be hidden by the cap until they upgrade (the teaser targets the seeded checklist). The 5 pre-existing e2e specs that exercise now-premium features were fixed by promoting their test couples to premium (the free-gating is covered by `premium.spec.ts`).

**Required env (documented in `.env.example`, not committed):** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`. **CI:** Stripe is mocked in tests — no real keys needed; local webhooks via `stripe listen --forward-to /api/stripe/webhook`.

**Backlog RESOLVED:** ~~Premium paywall enforcement (Phase 9): `Concept.isPremium` renders a badge only; every couple can open/select premium concepts~~ — now enforced (+ premium vendors, budget, checklist cap).

**New follow-ups (logged, non-blocking):** validate `amount`/`currency` against the expected price when refund/dispute webhooks land (non-exploitable today — server-fixed price); add `import 'server-only'` to `lib/stripe/client.ts` (needs the package); an automated **he/en i18n key-parity test** (now assumed by four phases — the standing CI-evolution candidate); cosmetic (`catch→CONFIG` copy, missing-webhook-secret 400-vs-500).

---

## Phase 8 — Admin Panel ✅ complete (branch `phase-8-admin`)

**Spec:** `specs/2026-07-08-admin-panel-design.md` · **Plan:** `plans/2026-07-08-phase8-admin.md`
**Branch `phase-8-admin`**, base `70991b5` (includes Phase 1–7 merges), HEAD `3a46f96`, 7 commits. 5 tasks + final review.
**Delivered:** a **shared admin shell** over the four standalone CMSes. New `app/[locale]/admin/layout.tsx` performs the **single** server-side admin gate for all `/admin/*` — a fresh **live-DB** `User.role` read via the pure `adminGateDecision` (login/dashboard/allow) — and renders the chrome (header + data-driven section nav, sidebar on `sm+`, RTL-mirrored). The four CMS page loaders (`checklist-templates`, `concepts`, `budget-templates`, `vendors`) **dropped their own gate + outer wrapper** and now render inside the shell. `/admin` became a read-only **overview** (counts of checklist templates / concepts / global vendors + budget-baseline sum with a ≠100 warning) replacing the bare link list. New pure `lib/admin/` (`gate`, `sections` + `activeSectionKey`, `overview` + `budgetBaselineStatus`). Plus the named **cleanups**: `updateConcept` writes content-only (flag-stomp fix), `admin-concepts` gained the `Object.keys` export-parity test, and concept/vendor image add/delete now guard `AdminResult.ok`. New `e2e/admin.spec.ts`.
**Verification at HEAD:** lint (`--max-warnings 0`), typecheck, **312 unit + 20 e2e** — all green. 9/9 acceptance criteria. (Final whole-branch review: **ready to merge — yes**, no Critical/Important.)

**Key decisions / deviations:**
- **One live-DB gate in the layout, defense-in-depth preserved.** `adminGateDecision` consults ONLY the live-DB role (never the JWT claim), so a stale-JWT demoted admin is now bounced — removing the four per-page gates **closed** the stale-JWT read-exposure hole rather than opening one. Triple defense remains: edge `proxy.ts` (JWT) → layout (live-DB) → mutation `requireAdmin()` (live-DB, untouched). The per-mutation checks are the real security boundary (a layout+page render concurrently, so the mutation gate — not the layout — is what authoritatively protects writes).
- **Read-only overview, no new schema.** A small `lib/admin/overview.ts` composer runs cheap `count()`s; the pure `budgetBaselineStatus` (≠100 warning) is unit-tested.
- **Nav labels reuse the per-CMS `title` keys** (no duplicate label keys); the `Admin` namespace grew only for panel chrome (he/en parity).
- **No user/couple management, no role-changing, no audit log** — explicitly out of scope; the shell is a clean home for those as future additions.
- **E2E admin session** via spec-side `prisma` promote (`dotenv/config` + relative import) + `clearCookies()` + fresh relogin — no seeded credential left in the repo (the seeded-admin fallback was avoided as a security footgun).

**Backlog items RESOLVED this phase:**
- ~~Stale-JWT admin PAGE loaders (`checklist-templates` + `concepts`)~~ → the shared layout's live-DB gate.
- ~~Phase 4/6 `updateConcept` full-object flag-stomp~~ → content-only write + regression test.
- ~~`admin-concepts` export-parity test gap~~ → `Object.keys` reflection assertion added.
- ~~Admin image add/delete don't check `AdminResult.ok`~~ → concept + vendor image editors now surface errors.

**New follow-ups (logged, non-blocking):** no automated he/en i18n **key-parity test** exists (acceptance relies on manual inspection — a good CI-evolution add, ties to the CI-evolution strategy); the layout's live-DB negative path (stale-JWT demoted admin) has only unit coverage, not e2e; a cosmetic "Budget Baseline" (nav) vs "Budget baseline" (card) casing divergence; raw `text-red-600` (semantic-error-token backlog item); the nav test lacks a negative `aria-current` assertion and the vendor image-error path lacks its own test.

---

## Phase 7 — Dashboard ✅ complete (branch `phase-7-dashboard`)

**Spec:** `specs/2026-07-07-dashboard-design.md` · **Plan:** `plans/2026-07-07-phase7-dashboard.md`
**Branch `phase-7-dashboard`**, base `310ab67` (includes Phase 1–6 merges), HEAD `a4ad9b2`, 6 commits. 3 tasks + final review.
**Delivered:** a **read-only** home view replacing the placeholder `/dashboard`. New `lib/dashboard/aggregate.ts` — pure, unit-tested derivations (`daysUntilWedding`, `checklistProgress`, `budgetSummary`, `vendorCounts`, `nextUpTasks`) + a `getDashboardData(wedding, now)` composer that reuses the existing per-phase queries (`getTasks`, `rollupTasks`, `getWeddingQuotes`, one concept lookup) — **no new schema, no mutations, no server actions**. New UI: a **countdown hero** (partner names + days-to-go — the widget deferred from Phase 2 — with no-date/approximate/passed states), four **dual-mode overview cards** (checklist progress+overdue / budget committed·remaining·of-total / vendors shortlisted·booked / concept name+palette — each a live summary or a nudge), and a **"next up"** task list; the `Dashboard` i18n namespace expanded (he+en, ICU plurals); `e2e/dashboard.spec.ts` (hero + cards + budget nudge→summary flip + gated).
**Verification at HEAD:** lint (`--max-warnings 0`), typecheck, **298 unit + 18 e2e** — all green. 8/8 acceptance criteria. (Final whole-branch review: **ready to merge with fixes**, no Critical; the one Important — budget card omitting "remaining" — was fixed in `a4ad9b2`.)

**Key decisions / deviations:**
- **Read-only aggregation seam.** One `getDashboardData` composer + pure derivations; the page loader is thin. `now` is injected into every derivation (no internal `Date.now()`) so the math is deterministic and unit-tests without a DB. This closes the Phase 2 **countdown-widget deferral**.
- **UTC start-of-day for day math** — `daysUntilWedding`/overdue use UTC-based `startOfDay`, matching the repo's existing `computeDueDate` convention (dates are stored UTC-midnight); deterministic across hosts (the plan's local-time draft failed the UTC-semantics test on the UTC+3 dev host).
- **Dual-mode cards, not separate components** — each card renders a live summary or its nudge from the section's summary/empty marker, preserving the old nudge UX while adding real data; all pct computations divide-by-zero-guard.
- **`vendorCounts` shortlisted = all quote rows** — consistent with how `/vendors` already derives the shortlist from `getWeddingQuotes`.
- **Approximate date shows a soft label** — final-review fix: when `dateIsApproximate`, the hero shows "Around {month year}" (via the weddingDate) instead of a misleadingly-precise day count (spec decision #4), which also consumed a previously-dead `weddingDate` prop.
- **Budget card shows remaining** — final-review fix: the card now renders committed·of-total **and** remaining (acceptance #2); `budgetSummary` had computed `remaining` but nothing rendered it.

---

## Phase 6 — Vendor Database ✅ complete (branch `phase-6-vendors`)

**Spec:** `specs/2026-07-07-vendor-database-design.md` · **Plan:** `plans/2026-07-07-phase6-vendors.md`
**Branch `phase-6-vendors`**, base `c8c1abf` (includes Phase 1–5 merges), HEAD `0604e00`, 16 commits. 8 tasks + final review.
**Delivered:** a **two-tier** `Vendor` model (nullable `weddingId`: null = admin-curated **global**, set = **couple-private**) + `VendorImage` (URL-ref portfolio, global only) + `VendorQuote` (couple↔vendor, one row = shortlist *and* quote, `@@unique([weddingId, vendorId])`, status lifecycle CONSIDERING/QUOTED/BOOKED/DECLINED, `amount`/`notes`/bare-string `taskId`) + a `VendorQuoteStatus` enum; a seed of 4 bilingual global vendors; pure `lib/vendors/` (a deterministic `recommend` engine — category filter + city/price-fit/verified/premium score with sortOrder/id tiebreak; Zod `schema`; DB `queries`; a `title` delegate); couple actions `vendors.ts` (`toggleShortlist`, `setQuoteStatus`/`setQuoteAmount`/`setQuoteNotes`, `linkQuoteToTask`, `pushQuoteToBudget`, `addPrivateVendor`/`editPrivateVendor`/`deletePrivateVendor`, all ownership-scoped) + admin `admin-vendors.ts` (global-only, live-DB gated, parametrized `FORBIDDEN` + export-parity); couple `/vendors` UI (filterable directory + a **"For your wedding"** neutral-language matches section + disclaimer banner + detail with portfolio/contact-links/quote-panel + add-private-vendor form) + a per-idea **"vendors for this"** surface on the concept detail; admin `/admin/vendors` CMS (vendor form + nested portfolio-image editor, live-DB gate) + nav link; dashboard vendors card; `e2e/vendors.spec.ts` (shortlist → quote → book → link task → add-to-budget-paid → verify the committed total; second-couple private-vendor isolation; logged-out redirect).
**Verification at HEAD:** lint (`--max-warnings 0`), typecheck, **284 unit + 16 e2e** — all green. 12/12 acceptance criteria. (Final whole-branch review: **ready to merge with fixes**, no Critical; the one Important — shortlist-toggle destroying a built quote — was fixed in `0604e00`.)

**Key decisions / deviations:**
- **Two-tier on one table** — `Vendor.weddingId` null vs set. Discovery unions `{weddingId: null, active}` with the caller's own private vendors and **excludes** other couples' private rows; recommendations + the concept surface use **global-only** (`getRecommendedVendors` filters `weddingId: null`). Verified airtight by the final review. Admin actions strictly refuse `weddingId != null` (a couple-private vendor → `NOT_FOUND`).
- **`VendorQuote` = shortlist AND quote** (one row, status lifecycle) — chosen over a separate favorite table. Consequence surfaced + fixed: `toggleShortlist` originally deleted the whole row on toggle-off, so a card click could wipe a built quote; now it only deletes a **bare** CONSIDERING row and preserves any quote carrying data.
- **Quote→budget bridge reuses Phase 5 (no parallel money track)** — `pushQuoteToBudget` requires a linked `taskId` + `amount`, then writes into the task via `setTaskEstimatedCost` (planned) or `setTaskStatus(taskId, true, amount)` (paid → DONE + committed). The task stays the single budget source of truth. **This is the first UI consumer of `setTaskEstimatedCost`, which Phase 5 built but left unwired** — that backlog item is now closed.
- **Rule-based recommendations, not AI** (deterministic score, explainable) — AI matching stays Phase 10.
- **Legal posture baked in** (per the user's coverage/legality question): consent/partner-curated global directory + couple-private vendors for gaps; **neutral match language** ("For your wedding" / "in your area" / "fits your budget" — never "recommended" in UI copy); a `verified` badge only for admin-vetted vendors; a disclaimer banner. Photos are admin-pasted URL refs (no scraping; consent covers photo rights). *(Photo-consent + Israeli privacy specifics to confirm with counsel before populating real data — out of build scope.)*
- **Messaging deferred, schema-ready** — `email`/`phone`/`website` stored and rendered as `mailto:`/`tel:`/link; an in-app "message the vendor" flow drops in later with no migration.
- **`updateVendor` writes content fields only** — a review-caught Critical: routing input through `vendorSchema` (which `.default()`s `verified`/`isPremium`/`active`/`sortOrder`) and writing the whole payload would silently reset those flags on a partial edit. Fixed to omit them; the admin UI toggles wire to the dedicated `setVendorActive`/`setVendorVerified`/`setVendorPremium`/`reorderVendor` setters instead.

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
- **Unwired-but-shipped budget surface** (P5): ~~`setTaskEstimatedCost`~~ **now wired** by Phase 6's `pushQuoteToBudget` (planned path). `setTaskAmountPaid` and a direct per-task `estimatedCost` editor still have no UI consumer — reserved for a future per-task budget editor.
- **Older admin PAGE loaders gate on stale JWT role** (P3/P4): `admin/checklist-templates/page.tsx` + `admin/concepts/page.tsx` redirect based on `session.user.role` (JWT), not a live-DB read — a stale-JWT demoted admin can *view* (not mutate — mutations re-check live DB) those pages. Phase 5's `admin/budget-templates/page.tsx` does it right; back-port the live-DB read to the two older loaders.
- **Orphan i18n keys** (P5): `Budget.currencySymbol/spentAbovePin/taskPaidLabel/taskEstimateLabel` + `AdminBudget.categoryLabel/orderLabel` are defined (he+en) but unused; prune or wire.
- **Reopen→skip→recomplete keeps old `amountPaid`** (P5): re-opening a DONE task leaves its paid amount; re-completing via "Skip" (null) doesn't clear it, so it silently returns to committed, and the prompt doesn't prefill the prior value. Edge-case UX.
- **`admin-concepts.test.ts` lacks export-parity reflection** (P4): back-port the `admin-budget.test.ts` `Object.keys(module)` parity assertion so a new ungated admin-concepts export can't slip the non-admin gate.
- **`e2e/budget.spec.ts` selector brittleness** (P5): keys off `getByRole('spinbutton').first()`, which only works because skipped onboarding leaves `guestCount` null; add a `data-testid` before the flow grows a second number input.
- ~~**Vendor recommendations per idea** (Phase 6)~~ **DONE** in Phase 6 — concept-idea detail shows a category-matched "vendors for this" surface; `recommendVendors` ranks the global catalog.
- **Vendor shortlist-card UX** (P6): after the fix, the directory card's shortlist toggle NO-OPs for a quote that carries data (keeps it) — a "click does nothing" gap. Add a fuller UX (confirm dialog, or a dedicated detail-page "remove") so un-shortlisting a quoted vendor is explicit.
- **Vendor client-form hardening** (P6): the quote panel's optimistic `status`/`task` selects aren't reverted on a failed action (the control shows an unpersisted value), and none of the 4 vendor client forms wrap the awaited action in `finally { setPending(false) }` (a rejected action leaves them stuck). Batch a hardening pass.
- **Private-vendor notes clobber** (P6): the detail page renders the edit form + quote panel together; the edit form carries a stale `quoteNotes` snapshot and writes it back on save, so notes typed in the panel after opening the editor can be overwritten. Cleanest fix: have `editPrivateVendor` not touch quote notes at all (the panel owns them).
- **Vendor query efficiency** (P6): `getRecommendedVendors` runs one query per distinct element category on the concept page (N+1); `getWeddingQuotes` over-fetches (add a lean `getShortlistedVendorIds`). Harmless at scale; tidy later.
- **Quote task-link select is category-agnostic** (P6): the quote panel lists all the couple's tasks, not category-matched ones (the plan said category-filtered). Add a category filter so a booked vendor's amount lands in the matching category by default.
- **Vendor image admin actions don't check `AdminResult.ok`** (P6): the CMS image add/delete refresh regardless of success (mirrors the Phase 4 concepts-admin gap) — align both.
- **Phase 4 `updateConcept` full-object flag-stomp** (P4, surfaced in P6): `updateConcept` (merged) has the same defaulted-flag full-replace pattern that Phase 6's `updateVendor` was fixed for — a partial edit can reset `isPremium`/`active` despite the dedicated setters. Apply the same content-only-update fix.
- **Premium paywall enforcement** (Phase 9): `Concept.isPremium` renders a badge only; every couple can currently open/select premium concepts. Real gating arrives with payments.

---

## Roadmap position

Done: Phase 1 (Foundation), Phase 2 (Onboarding & Profile), Phase 3 (Checklist & Timeline), Phase 4 (Wedding Concepts), Phase 5 (Budget Planning & Optimization), Phase 6 (Vendor Database), Phase 7 (Dashboard), Phase 8 (Admin Panel), Phase 9 (Premium / Payments).
Next: **Phase 10 — AI Multi-Agent Layer** (AI-driven vendor matching + budget optimization, on top of the `lib/vendors/recommend` + `lib/budget/optimize` + `lib/dashboard` seams; premium can gate AI features via the Phase 9 entitlement). This is the final planned phase. Candidate future adds the codebase is now shaped for: refund/dispute webhooks (revoke premium), in-app **messaging** to vendors (contact schema ready), **user/couple management + audit log** (admin shell has a home), and an automated i18n key-parity CI check.
