# Wedding Planner AI — Phase 2: Onboarding & Wedding Profile

**Status:** Approved for planning
**Date:** 2026-07-04
**Builds on:** Phase 1 (Foundation) — `docs/superpowers/specs/2026-07-04-foundation-design.md`

## Context

Phase 1 delivered the foundation: auth (email/password + Google, JWT sessions carrying `{id, role, weddingId}`), next-intl localization (Hebrew default/RTL, English), Tailwind v4 design tokens + per-locale fonts, Prisma/Postgres, route protection in `proxy.ts`, and working auth UI. Registration currently creates a `User` with **no** `Wedding` (`weddingId` null), and the `Wedding` model holds only identity (`id`, `members`, timestamps) — Phase 1 deliberately left a `// Phase 2 adds: date, budget, guestCount, ...` placeholder.

Phase 2 fills that in: the onboarding flow a couple completes right after signing up, which **creates and populates their `Wedding`**, and the ability to edit that profile afterward. Everything downstream (dashboard countdown/progress, checklist personalization, budget, concepts, vendor matching, AI) reads from this profile, so getting it right and easily-changeable matters.

## Goals

- Let a newly-registered couple set up their wedding through a guided, premium, low-friction wizard.
- Persist a well-typed, easily-extensible wedding profile on the `Wedding` model.
- Route couples into onboarding until they've completed it, then into a personalized app; never re-onboard.
- Make every profile field editable afterward, from a single source-of-truth field definition so adding/changing fields is a localized change.

## Non-goals (deferred)

- **Partner co-login invitations.** Phase 1's data model supports multiple `User`s per `Wedding`, but the actual "invite your partner to log in" flow is a separate later mini-feature. Phase 2 captures the partner's *name* for personalization only.
- **Dashboard widgets** (countdown, progress, activity) — Phase 7. Phase 2 only ensures the profile data exists for them.
- **Multi-currency.** Budget is ILS (₪) only for now.
- **A separate wedding "content language."** Language is the existing per-user `User.locale`; no duplicate field on `Wedding` (see Decisions).

## Key decisions

1. **Hybrid onboarding gate** — require only the essentials (partner names) to create the wedding; every other field is optional and fillable/changeable later. Matches the real "we don't know yet" nature of early wedding planning.
2. **Multi-step wizard** (not a single form or chat) — premium, guided first impression; required essentials first, later steps one-tap skippable.
3. **Priorities = pick top 3, in order** — from a fixed six-value enum. Low friction, gives the future AI an ordered signal without tedious per-category rating.
4. **Typed columns directly on `Wedding`** — strongly-typed/enums, not a JSON blob or separate 1:1 table. Type-safe, queryable (dashboard + AI read constantly), easily migrated. User constraint: fields must be easy to change/add — addressed via Prisma migrations + a single field-definition source of truth.
5. **Drop the separate `Wedding.language` field** — it would duplicate `User.locale` (already controls Hebrew⇄English per user). Keeping language per-user also lets two partners view the app in different languages. Full Hebrew/English switching is unchanged.
6. **Onboarding gate in the `(app)` layout, not the edge proxy** — needs fresh DB state (`onboardingCompletedAt` flips the moment they finish); a stale JWT claim would force re-login. A single indexed read per app-page load is trivially cheap at this scale.

## Scale & cost calibration

Right-sized to a few thousand registered users (many still pre-wedding), not hyperscale. The onboarding gate is one indexed read by primary key per app-page load — cheap, no caching layer. No new external services or recurring costs: Phase 2 is DB columns + UI + Server Actions. Incremental saves are tiny targeted updates; gate reads select only needed columns.

## Data model

Add to the `Wedding` model (all nullable — hybrid "fill later"):

| Field | Type | Notes |
|---|---|---|
| `partner1Name` | `String?` | Prefilled from the account's `User.name` |
| `partner2Name` | `String?` | Together render "Maya and Asaf" |
| `weddingDate` | `DateTime?` | `null` = "don't know yet" (blank countdown) |
| `dateIsApproximate` | `Boolean @default(false)` | "around this time" vs a firm date |
| `guestCount` | `Int?` | |
| `budgetTotal` | `Int?` | Whole shekels (₪), ILS-only |
| `city` | `String?` | Free-text region for now |
| `venueSetting` | enum `VenueSetting?` | `INDOOR / OUTDOOR / MIXED` |
| `ceremonyType` | enum `CeremonyType?` | `RELIGIOUS / CIVIL / MIXED` |
| `priorities` | `Priority[]` | Ordered top-3; enum `FOOD / PARTY / PHOTOGRAPHY / GUEST_EXPERIENCE / DESIGN / FASHION`; array order = rank; length 0–3 |
| `onboardingCompletedAt` | `DateTime?` | Gate marker; stamped when the wizard finishes |

New enums: `VenueSetting`, `CeremonyType`, `Priority`. Migration adds columns + enums to the existing table (no data backfill needed — existing rows are dev-only).

The `Wedding` is created and linked to the `User` (sets `User.weddingId`) when onboarding starts persisting (step 1). Existing couple-sharing FK is unchanged.

## Onboarding wizard flow

Route: `/onboarding` (authenticated; sits outside the onboarding gate so it can't loop).

Steps:
1. **Welcome & names** *(required)* — `partner1Name` (prefilled), `partner2Name`. Creates/links the `Wedding` on submit.
2. **The date** — date picker + "We don't know yet" toggle + "approximate" option. Skippable.
3. **Size & budget** — `guestCount`, `budgetTotal`. Skippable.
4. **Style** — `city`, `venueSetting`, `ceremonyType`. Skippable.
5. **Priorities** — pick top 3 in order. Skippable.
6. **All set** — summary → "Enter your dashboard."

Behavior:
- **Incremental save + resumable:** each step persists as completed; abandoning mid-wizard and returning resumes with prior answers intact.
- **Completion at the end:** `onboardingCompletedAt` stamped at step 6 (whether middle steps were filled or skipped) — a single gate marker.
- **Frictionless skips:** each optional step has a clear "Skip for now."

### Visual direction (onboarding)
- "Old-money" / quiet-luxury aesthetic: Phase 1 serif display fonts (Frank Ruhl Libre in Hebrew, Playfair in English), muted sage/cream/gold palette, generous whitespace, restrained detailing.
- **Centered composition** — questions, headings, and buttons horizontally centered so the layout reads elegantly in both Hebrew and English without alignment flipping. Text *inside* inputs still flows in the correct direction (Hebrew RTL).
- Slim progress indicator; warm on-brand copy.

## Gating & routing

- **Login gate** stays in edge `proxy.ts` (Phase 1, unchanged).
- **Onboarding gate** in the `(app)` layout (server component): loads the session user's wedding; if none or `onboardingCompletedAt` is null → redirect to `/onboarding`.
- `/onboarding` is authenticated but excluded from the onboarding gate (no self-redirect loop); logged-out users still bounce to `/login` via the proxy.
- Already-onboarded couple hitting `/onboarding` → redirect to `/dashboard`.
- Flow: register → login → `(app)` → (no completed wedding) → `/onboarding` → finish → `/dashboard` (personalized).

## Editing later

- `/settings/wedding` edit page, rendered from the **same** field definitions as the wizard. Every field editable anytime; no re-running onboarding.

## Persistence, validation & single source of truth

- **Field-definition module** (e.g. `lib/wedding/profile-fields.ts`): per field — key, type, i18n label key, validation rule, wizard step. The wizard, edit page, and validation schemas all derive from it. Add/change a field = edit here + a migration.
- **Shared Zod schemas** derived from the definition run client-side (instant wizard feedback) and server-side (authoritative). Server never trusts the client.
- **Server Actions** (no separate REST layer): one saves a step's fields to the caller's `Wedding`; a final action stamps `onboardingCompletedAt`.
- **Ownership:** every read/write scoped to the logged-in user's own wedding. The action resolves the wedding by looking up the **session user in the DB** (`user.weddingId`), **not** from the JWT `weddingId` claim — that claim is stale (null) immediately after step 1 creates the wedding, until the token refreshes. Never trusts a wedding id from the client. A user can only ever touch their own wedding.
- **Gate freshness note:** the `(app)` layout gate likewise reads the wedding via the DB (session user id), so it sees `onboardingCompletedAt` the moment it flips — not the stale JWT claim.

## Localization

- All wizard/edit copy via next-intl (`Onboarding` + `WeddingProfile` namespaces), Hebrew (default) + English, no hard-coded strings (Phase 1 lint gate `--max-warnings 0` enforces).
- Fixed enum choices (venue, ceremony, the six priorities) get localized labels via message keys — developer-defined options, so they live in message files, not the DB.
- Centered "old-money" composition in both languages; correct input text direction (Hebrew RTL).

## Testing

- **Unit:** generated Zod validation rules; top-3-ordered priorities constraint; server-action ownership check; onboarding-gate decision (complete vs not).
- **Integration:** server actions persist to the caller's `Wedding`; `onboardingCompletedAt` flips the gate; a user cannot write another couple's wedding.
- **e2e:** register → routed to onboarding → skip straight through → personalized dashboard; fill-everything path; abandon-and-resume keeps prior answers; already-onboarded user hitting `/onboarding` → dashboard; Hebrew renders centered/RTL.

## Acceptance criteria

1. A new couple with no completed wedding is routed to `/onboarding` on entry.
2. Step 1 (names) required; steps 2–5 one-tap skippable; step 6 completes.
3. Finishing creates/links the `Wedding`, saves entered fields, stamps `onboardingCompletedAt`, redirects to `/dashboard`.
4. Abandon mid-wizard → return resumes with prior answers intact.
5. Onboarded couple never re-onboards; `/onboarding` → `/dashboard`.
6. Every field editable later at `/settings/wedding`, rendered from the same field definitions.
7. Priorities = exactly up to 3, ordered; enforced client **and** server.
8. "Unknown" values allowed (e.g. null date) and handled gracefully (blank countdown).
9. All UI localized (he default + en); onboarding centered + old-money aesthetic; correct input direction.
10. A user can only read/write their own wedding (session-authorized).
11. Gate is a single indexed read; no new external services or recurring cost.
12. Full gate green: lint (`--max-warnings 0`), typecheck, unit + e2e.

## Open items / future considerations

- Partner co-login invitations (separate later mini-feature).
- Multi-currency / non-ILS budgets.
- Richer `city`/region as a structured select if needed later.
- Some enum option sets (e.g. priorities) could later become admin-managed content (Phase 8) rather than code enums, if the business wants to edit them without a deploy.
