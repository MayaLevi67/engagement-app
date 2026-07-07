# Wedding Planner AI — Phase 6: Vendor Database

**Status:** Approved for planning
**Date:** 2026-07-07
**Builds on:** Phase 1 (Foundation), Phase 2 (Onboarding & Wedding Profile), Phase 3 (Checklist & Timeline), Phase 4 (Wedding Concepts), Phase 5 (Budget Planning & Optimization)

## Context

Phases 1–5 delivered auth, i18n (he default/RTL + en), the `Wedding` model (profile fields incl. `city`, `guestCount`, `budgetTotal`, `weddingDate`, `venueSetting`, `ceremonyType`, `priorities`), the checklist engine (`ChecklistTemplate` → per-couple snapshot `Task` with a `category`, soft-delete, `estimatedCost`/`amountPaid`), the concepts library (`Concept`/`ConceptElement` with `category` + `estCostMin`/`estCostMax`, push-idea-to-checklist), and the budget engine (`lib/budget/`: a deterministic optimizer, `rollupTasks` where **committed = Σ `amountPaid` of DONE tasks** and **planned = Σ `estimatedCost` of OPEN tasks**, plus couple actions `setTaskAmountPaid`/`setTaskEstimatedCost` and the extended `setTaskStatus(taskId, done, amountPaid?)`). The signature admin-master → couple-facing pattern (Phase 3 templates, Phase 4 concepts + `ConceptImage` URL-ref vision board, Phase 5 budget baseline) and the live-DB admin gate are all established.

Phase 6 is the **Vendor Database**: a directory couples browse to find suppliers (photographers, DJs, caterers, venues…), shortlist, and log quotes against — with vendor **quotes that book into the Phase 5 budget** through the checklist. Because an exhaustive admin-curated directory is neither feasible nor legally clean to assemble, the directory is **two-tier**: a consent/partner-curated **global** catalog the admin authors, plus **couple-private** vendors a couple adds themselves to fill any gap. Recommendations are **rule-based** (deterministic, explainable — matched by category/city/budget-fit), not AI. There is no vendor-facing app, no messaging/RFQ, and no payments this phase.

This is a couple-facing discovery + tracking feature plus an admin CMS, deliberately designed so a future "message the vendor" flow and an image uploader are additive.

## Goals

- A **two-tier `Vendor` directory**: admin-curated **global** vendors (bilingual, category, city, price range, contact, portfolio photos, `verified`/`isPremium`) + **couple-private** vendors (lightweight, scoped to one wedding, not discoverable by others).
- A couple-facing **`/vendors`** directory: filter by category/city/price, a **"For your wedding"** matches section (rule-based match to the couple's city/budget/selected-concept categories, framed with neutral language — never "recommended"), and a vendor **detail** page (portfolio, price, contact links, shortlist, quote panel).
- **`VendorQuote`** as the single couple↔vendor record (shortlist *and* quote): a status lifecycle (`CONSIDERING`/`QUOTED`/`BOOKED`/`DECLINED`), an `amount`, `notes`, and an optional link to a checklist `Task`.
- A **quote → budget bridge**: an "add to budget" action writes a quote's amount into its linked task via the **existing Phase 5 actions** — `estimatedCost` when not paid; when paid, `setTaskStatus(taskId, true, amount)` marks it DONE and records `amountPaid` in one call — no new money math, task stays the single source of truth. This also becomes the first UI consumer of `setTaskEstimatedCost` (unwired in Phase 5).
- **Rule-based recommendations** hung off the couple's profile and off a **concept idea** (Phase 4 detail page): category-matched, scored by city + budget-fit, explainable.
- A minimal `ADMIN`-only CRUD for global vendors + their portfolio images (mirrors the Phase 4 concepts admin), with the parametrized non-admin `FORBIDDEN` + export-parity test pattern (Phase 5 hardening).

## Non-goals (deferred)

- **Messaging / RFQ to vendors.** Contact fields (`email`/`phone`/`website`) are stored and rendered as `mailto:`/`tel:`/link only. An in-app "send a message to the vendor" flow is a **future** additive feature — the schema is ready for it.
- **AI matching.** Recommendations are deterministic rules this phase. AI-ranked/curated vendors are **Phase 10**.
- **Premium enforcement.** `Vendor.isPremium` renders a badge; no gating. Real gating is **Phase 9**.
- **Image upload.** Portfolio photos are admin-pasted **URL references** (`VendorImage`, the Phase 4 `ConceptImage` shape). An uploader drops in later with no migration.
- **Vendor reviews / ratings.** Not modeled this phase.
- **Vendor self-service / vendor-facing app.** Vendors do not log in or manage their listing; the admin curates global vendors by hand/partnership.
- **Scraping / bulk import.** Global vendors are added by hand with the vendor's consent (which also covers photo rights). No third-party scraping.

## Legal posture (informs the design; not legal advice)

Listing **factual business information** (name, category, city, publicly-available contact) is standard directory practice and low-risk. The design encodes the risk mitigations directly:

1. **Consent/partner-curated global directory.** The admin only adds global vendors it has permission to list — which also secures the rights to their portfolio photos (copyright is the biggest concrete risk; portfolio images are the vendor's, not free to copy). No scraping from third-party directories.
2. **Couple-private vendors are the couple's own data** — they add whoever they're actually using; not discoverable by others, no photos required.
3. **Neutral matching language.** Algorithmic matches are framed "in your area" / "fits your budget," never "recommended," to avoid implying an endorsement of a vendor the team hasn't vetted. A **`verified`** badge is shown *only* for admin-vetted vendors.
4. **Disclaimer.** The directory shows a short i18n disclaimer: listings are informational; the app is not a party to any agreement between a couple and a vendor.
5. Sole-proprietor contact data is treated as low-risk public business info; the consent/partner model keeps it clean. (Confirm the photo-consent and Israeli Privacy Law specifics with counsel before populating real data — out of scope for the build.)

## Key decisions

1. **Two-tier vendor ownership on one table.** `Vendor.weddingId` nullable: `null` = **global** (admin-curated, discoverable, may have images/`verified`/`isPremium`); set = **couple-private** (scoped to that wedding, not discoverable, text-only). One model, one nullable FK — the discovery query filters `weddingId: null`; a couple additionally sees their own private vendors. Chosen over two tables to keep the quote/budget bridge and queries uniform.
2. **`VendorQuote` is the single couple↔vendor record** (shortlist *and* quote), `@@unique([weddingId, vendorId])`. Shortlisting creates a `CONSIDERING` row; a price sets `QUOTED` + amount; choosing sets `BOOKED`; passing sets `DECLINED`. Avoids a separate favorite table (contrast Phase 4's `ConceptFavorite`, justified because a vendor relationship has a richer lifecycle than a concept favorite).
3. **Quote → budget via the existing task machinery (no parallel money track).** A `VendorQuote.taskId` links to a checklist `Task`; "add to budget" writes the amount into that task through Phase 5's `setTaskEstimatedCost` (planned) or `setTaskAmountPaid` + `setTaskStatus(...,true,amount)` (committed). One-time push (mirrors Phase 4's push-to-checklist), not a live binding — the task remains the single budget source of truth, preserving the Phase 5 invariant.
4. **Rule-based recommendation engine** (`lib/vendors/recommend.ts`, pure + unit-tested): filter to `active`, global, category-matched vendors; score by city match + price-fit (vendor `[priceMin,priceMax]` overlaps the couple's budget signal / the idea's cost range) with `verified`/`isPremium`/`sortOrder` tiebreaks. Deterministic and explainable, same spirit as the Phase 5 optimizer. Couple-private vendors are never "recommended."
5. **`Vendor.category` reuses `TaskCategory`** — makes category-matching to concept ideas and checklist tasks a trivial field compare, and lets a booked vendor map cleanly to a same-category task. No new taxonomy.
6. **Portfolio = `VendorImage`** (URL-ref rows, first = cover), the exact Phase 4 `ConceptImage` shape — upload-ready, on global vendors only.
7. **Contact fields stored now, messaging deferred** — `email`/`phone`/`website` render as links; the schema is ready for a future in-app messaging flow.
8. **Live-DB admin authorization** on every global-vendor mutation, with the parametrized non-admin `FORBIDDEN` + `Object.keys(module)` export-parity test (the Phase 5 pattern). Couple actions are ownership-scoped (DB-resolved `weddingId`); a couple may create/edit/delete only its own private vendors and quote any global or own-private vendor.
9. **Whole-shekel integers** for all money (`priceMin`/`priceMax`/`VendorQuote.amount`), matching the app-wide convention.

## Scale & cost calibration

Right-sized to a few thousand couples. Global vendors are a small admin-curated catalog (hundreds at most), read-heavy and cacheable; the directory query is indexed by `category`/`city` with `weddingId: null`. Couple-private vendors and quotes are a handful of rows per wedding, indexed by `weddingId`. The recommendation engine is O(candidate vendors) with a simple score — run on demand in the loader, nothing persisted. The quote→budget push is one `Task` update reusing the existing indexed budget path. Portfolio images are URL references (zero new storage/services); a future uploader (Cloudflare R2, ~$0 at this scale) is additive. No background jobs, no new external services, no new secrets.

## Data model

Three new models + two new enums; no changes to existing models except a back-reference on `Wedding` and `Task`.

```prisma
enum VendorQuoteStatus {
  CONSIDERING   // shortlisted, no price yet
  QUOTED        // has an amount
  BOOKED        // chosen
  DECLINED      // passed on
}

model Vendor {
  id             String       @id @default(cuid())
  weddingId      String?                        // null = global (admin); set = couple-private
  wedding        Wedding?     @relation(fields: [weddingId], references: [id], onDelete: Cascade)

  name_en        String
  name_he        String
  titleLocale    TitleLocale  @default(AUTO)
  description_en String?
  description_he String?
  category       TaskCategory
  city           String?
  priceMin       Int?                            // ₪
  priceMax       Int?                            // ₪

  email          String?                         // contact — links only this phase
  phone          String?
  website        String?

  verified       Boolean      @default(false)    // admin-vetted trust badge (global only)
  isPremium      Boolean      @default(false)    // badge only; enforcement = Phase 9
  active         Boolean      @default(true)
  sortOrder      Int          @default(0)

  images         VendorImage[]
  quotes         VendorQuote[]

  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  @@index([weddingId])
  @@index([category, city])
}

model VendorImage {                              // portfolio — URL refs now, upload-ready later
  id        String  @id @default(cuid())
  vendorId  String
  vendor    Vendor  @relation(fields: [vendorId], references: [id], onDelete: Cascade)
  url       String
  alt_en    String?
  alt_he    String?
  sortOrder Int     @default(0)                  // first = cover

  @@index([vendorId])
}

model VendorQuote {                              // couple↔vendor: shortlist AND quote
  id        String            @id @default(cuid())
  weddingId String
  wedding   Wedding           @relation(fields: [weddingId], references: [id], onDelete: Cascade)
  vendorId  String
  vendor    Vendor            @relation(fields: [vendorId], references: [id], onDelete: Cascade)

  status    VendorQuoteStatus @default(CONSIDERING)
  amount    Int?                                 // ₪ quoted price
  notes     String?
  taskId    String?                              // optional link to a checklist Task (budget bridge)

  createdAt DateTime          @default(now())
  updatedAt DateTime          @updatedAt

  @@unique([weddingId, vendorId])                // one relationship record per vendor
  @@index([weddingId])
}
```

Added to `Wedding` (back-references): `vendors Vendor[]` (its private vendors) and `vendorQuotes VendorQuote[]`.
`VendorQuote.taskId` is a plain nullable string (provenance-style link, not a FK relation) so deleting a `Task` leaves the quote intact with a dangling `taskId` — mirrors `Task.sourceConceptElementId`. (Kept as a bare string to avoid a `Task`↔`VendorQuote` relation and its cascade coupling.)

## Domain logic & server actions

Following the Phase 4/5 layout: pure logic + Zod in `lib/vendors/`, server actions in `lib/actions/`.

**`lib/vendors/` (pure, unit-tested):**
- `title.ts` — reuse the shared `TitleLocale` resolver for vendor names.
- `schema.ts` — Zod: `vendorSchema` (admin: names, category, city, price range with `priceMin ≤ priceMax`, contact formats, flags), `privateVendorSchema` (couple: a lighter subset — name, category, optional city/contact/notes; no images/premium/verified), `vendorImageSchema`, `quoteInput` (status enum, non-negative int amount, notes).
- `recommend.ts` — `recommendVendors(candidates, criteria, limit)` → filtered + scored + ranked global vendors. `criteria = { category, city, budgetFit? }`; pure, no I/O. Scoring documented and unit-tested (city boost, price-fit overlap, verified/premium/sortOrder tiebreaks).
- `queries.ts` — `getDirectoryVendors(filters)` (global active + couple's own private, filtered), `getVendorDetail(id)` (images + the caller's quote state), `getRecommendedVendors(wedding, { category?, limit })` (loads candidates + calls `recommendVendors`), `getWeddingQuotes(weddingId)`.

**`lib/actions/vendors.ts` — couple actions** (ownership-scoped to the session `weddingId`; reject when none):
- `toggleShortlist(vendorId)` → upsert/delete a `CONSIDERING` `VendorQuote` (idempotent via unique index).
- `setQuoteStatus(vendorId, status)`, `setQuoteAmount(vendorId, amount|null)`, `setQuoteNotes(vendorId, notes)` — operate on the couple's own quote row (auto-create if shortlisting implicitly).
- `linkQuoteToTask(vendorId, taskId|null)` — validate the task belongs to the session wedding; store `taskId`.
- `pushQuoteToBudget(vendorId, { paid })` → requires a linked task + an amount; writes into the task via the Phase 5 actions — `setTaskEstimatedCost(taskId, amount)` when `!paid` (planned); `setTaskStatus(taskId, true, amount)` when `paid` (marks the task DONE and records `amountPaid` in one call = committed). A one-time push; re-pushing overwrites.
- `addPrivateVendor(input)` → create a `Vendor` with `weddingId` = session wedding (validated by `privateVendorSchema`); returns its id (the couple then shortlists/quotes it via the same actions).
- `editPrivateVendor(vendorId, input)` / `deletePrivateVendor(vendorId)` — only on a vendor the couple owns.

**`lib/actions/admin-vendors.ts` — admin CMS actions** (live-DB `ADMIN` check on every mutation; operate only on **global** `weddingId: null` vendors): `createVendor`, `updateVendor`, `deleteVendor`, `setVendorActive`, `setVendorVerified`, `setVendorPremium`, `reorderVendor`; images `addVendorImage`, `updateVendorImage`, `deleteVendorImage`, `reorderVendorImage`.

## UI & navigation

**Placement:** a standalone **`/vendors`** couple-facing section (nav alongside `/checklist`, `/concepts`, `/budget`), **added to the proxy `APP_PREFIXES` login-gate** (the recurring lesson). A light **dashboard entry** ("Find your vendors").

**Couple UI — `app/[locale]/(app)/vendors/`:**
- `page.tsx` — RSC loader: filters (category/city/price/premium), a **"For your wedding"** matches section (from `getRecommendedVendors`, neutral language), the filtered directory grid (global + the couple's private vendors, visually distinguished), the legal **disclaimer** banner, and an "add your own vendor" entry.
- `vendors-directory.tsx` / `vendor-card.tsx` (client) — card with cover image, name, category, city, price range, `verified`/PREMIUM badges, shortlist (heart) toggle. Recommended matches are labelled neutrally ("in your area" / "fits your budget"), never "recommended," and only `verified` vendors show the trust badge.
- `[vendorId]/page.tsx` + `vendor-detail.tsx` — portfolio (cover + gallery), price range, contact links (`mailto:`/`tel:`/website), and the **quote panel**: status control, amount, notes, link-to-task (a select of the couple's tasks, category-filtered), and **"add to budget"** (planned vs paid). Couple-private vendors render an edit/delete affordance instead of admin badges.
- `add-private-vendor.tsx` (client) — the lightweight form (`privateVendorSchema`).

**Concept idea surface — Phase 4 `concepts/[conceptId]` detail:** a small **"vendors for this idea"** section per idea, category-matched via `getRecommendedVendors({ category: element.category, limit })`, linking into `/vendors/[id]`.

**Admin CMS — `app/[locale]/admin/vendors/`:** vendor list (reorder, active/verified/premium toggles, edit/delete) + a nested portfolio-image editor — mirrors `admin/concepts`. Admin nav gets a "Vendors" link. The loader uses the **live-DB** admin gate (the Phase 5-correct pattern, not the stale-JWT one).

**i18n / RTL:** all chrome via `messages/he.json` + `en.json` (identical key sets, ESLint-enforced no hard-coded strings), including the disclaimer and neutral match labels; logical Tailwind properties; `₪`/number formatting via the locale helper; number/contact inputs `dir="ltr"`; design tokens for the old-money look.

**Seed:** a committed, idempotent seed of a handful of global vendors across categories/cities (bilingual, with a price range, contact, a placeholder portfolio image, and `verified` set on a couple) — mirrors the Phase 4/5 seeds; gives a working directory and real data for tests. Upsert by stable id.

## Error handling & edge cases

- **Ownership scoping** — every couple action resolves `weddingId` from the DB; quote/private-vendor mutations operate only on that wedding; `linkQuoteToTask` verifies the task belongs to the session wedding.
- **Admin authorization** — every global-vendor mutation re-checks live `User.role === ADMIN`; a couple cannot mutate a global vendor, and admin actions refuse to touch a `weddingId != null` (private) vendor.
- **Private-vendor isolation** — a couple can only see/edit/delete its own private vendors; they never appear in another couple's directory or in recommendations.
- **`pushQuoteToBudget` preconditions** — requires a linked `taskId` and a non-null `amount`; otherwise `INVALID`. It is a one-time write (not a live binding); re-pushing overwrites the task field (documented, not silently merged). If the linked task was deleted, the push returns `NOT_FOUND` and the UI prompts to re-link.
- **Deleting a linked task** — `VendorQuote.taskId` dangles (provenance-only string); the quote stands.
- **Deleting a vendor** — cascades its `VendorImage`s and `VendorQuote`s (`onDelete: Cascade`). A global vendor a couple had quoted disappears from that couple's list (acceptable; admin delete is rare and consent-scoped).
- **Shortlist idempotency** — `toggleShortlist` via the unique index; double-submit is safe.
- **Recommendation with sparse data** — no city / no budget / no concept still yields a category-or-all ranked list (never errors); an empty candidate set renders an empty-state, not a crash.
- **Validation** — Zod at every boundary (price-range ordering, non-negative amounts, contact formats, category enum, status enum, non-empty names).
- **Premium / verified** — badges only; `isPremium` unenforced (documented until Phase 9).
- **Concurrency** — low-stakes admin reorder races self-correct on refresh (accepted precedent); the quote push read-then-write TOCTOU mirrors the existing add-once pattern (right-sized, not a unique constraint).

## Testing strategy

Mirrors Phase 4/5 (unit-heavy + focused e2e).

- **Unit (Vitest):**
  - `lib/vendors/recommend.test.ts` — category filter (global+active only, private excluded); city boost; price-fit overlap; verified/premium/sortOrder tiebreaks; sparse-criteria fallbacks; limit; deterministic ordering.
  - `lib/vendors/schema.test.ts` — price-range ordering, contact formats, amount/status enums, private-vendor subset, image URL.
  - `lib/vendors/queries.test.ts` — directory filtering (global + own-private, others' private excluded); quote-state hydration; `getRecommendedVendors` wiring (pure-fn boundary).
  - `lib/actions/vendors.test.ts` — shortlist toggle idempotency; status/amount/notes on own quote; ownership rejection on `weddingId` mismatch; `linkQuoteToTask` rejects a foreign task; **`pushQuoteToBudget` writes `estimatedCost` when `!paid` and `amountPaid`+DONE when `paid`** (assert it calls the Phase 5 path), and rejects with no task/amount; `addPrivateVendor` scopes `weddingId`; edit/delete only own private vendor.
  - `lib/actions/admin-vendors.test.ts` — CRUD happy paths; **parametrized non-admin `FORBIDDEN` + `Object.keys(module)` export-parity** across every export; admin refuses to mutate a private (`weddingId != null`) vendor; cascade on delete.
  - Seed test — idempotent re-run doesn't duplicate.
- **Component (Vitest + RTL):** vendor card (badges, neutral match label, shortlist state); quote panel (status/amount, add-to-budget planned vs paid); disclaimer renders.
- **E2E (Playwright):** couple opens `/vendors` → sees recommendations + disclaimer → shortlists a vendor → sets a quote amount → books → links it to a checklist task → "add to budget" (paid) → verifies the amount appears on the task and in that category's **committed** total on `/budget`. Add-your-own: couple adds a private vendor → it shows only in their list, not in recommendations. Logged-out `/vendors` + non-admin `/admin/vendors` are gated. Reuse the inline register/onboard helper idiom from the sibling specs (no shared module).

## Acceptance criteria

1. Couple sees a `/vendors` directory (global vendors + their own private ones, distinguished) with category/city/price filters, `verified`/PREMIUM badges, and the legal disclaimer — he + en, RTL correct.
2. A **"For your wedding"** matches section surfaces rule-matched global vendors with neutral language ("in your area"/"fits your budget") — never the word "recommended"; only `verified` vendors show the trust badge; private vendors never appear as matches.
3. Couple can shortlist/unshortlist a vendor (persists), and set a quote's status/amount/notes.
4. Couple can **add a private vendor** (lightweight), visible only to them, quotable like any vendor.
5. Couple can **link a quote to a checklist task** and **"add to budget"**: not-paid writes the task's `estimatedCost` (planned); paid writes `amountPaid` + marks the task DONE (committed) — and it shows up on `/budget` in that category, via the Phase 5 engine (no parallel money track).
6. Vendor detail shows portfolio, price range, and contact links (`mailto:`/`tel:`/website); no messaging flow.
7. Concept idea detail shows a category-matched "vendors for this idea" section.
8. Admin can CRUD global vendors + portfolio images (bilingual) with reorder, active, verified, and premium toggles; admin mutations reject non-admins (live-DB) and refuse to touch couple-private vendors.
9. Ownership enforced on every couple action; a couple cannot see or mutate another couple's private vendors; all money is non-negative ₪ integers validated at the boundary.
10. No hard-coded strings (ESLint clean); he/en key parity; logical properties render RTL + LTR.
11. Seed provides a handful of working bilingual global vendors; re-running it does not duplicate.
12. `lint --max-warnings 0`, typecheck, and all unit + e2e tests green.

## Roadmap position

Done: Phase 1 (Foundation), Phase 2 (Onboarding & Profile), Phase 3 (Checklist & Timeline), Phase 4 (Wedding Concepts), Phase 5 (Budget Planning & Optimization).
**This: Phase 6 — Vendor Database.** Next: Dashboard (7), Admin Panel (8), Premium/Payments (9, enforces `isPremium` + real transactions), AI Multi-Agent Layer (10, AI-driven vendor matching + budget optimization). A future additive step on top of this phase: in-app **messaging** to vendors (contact schema is ready).
