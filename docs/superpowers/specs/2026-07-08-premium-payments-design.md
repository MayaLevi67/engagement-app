# Wedding Planner AI — Phase 9: Premium / Payments

**Status:** Approved for planning
**Date:** 2026-07-08
**Builds on:** Phases 1–8 (Foundation, Onboarding, Checklist, Concepts, Budget, Vendors, Dashboard, Admin Panel)

## Context

Phases 1–8 built the full couple-facing product with `Concept.isPremium` and `Vendor.isPremium` modeled but **unenforced** (badge only — every couple can select/use anything). There is **no entitlement/subscription state** (nothing on `User` or `Wedding`), **no Stripe dependency**, and the only external services are Resend (email) + dormant Inngest. The couple-sharing model means a `Wedding` has many `User`s (partners share one wedding).

Phase 9 is **Premium / Payments** — the first monetization phase, and the most security-sensitive. It introduces a **one-time Premium unlock per wedding** via **Stripe hosted Checkout**, with a signature-verified **webhook as the sole authoritative grant**. It converts the free tier into a limited teaser and gates the paid surfaces on the server:

- **Budget** — fully **hard-gated** (a whole feature): free couples get a paywall; every budget mutation rejects.
- **Checklist** — **display-gated** to the first 10 tasks for free couples (+ a hidden-count teaser); the tasks are the couple's own data, so this is a loader cap, not a per-task server gate.
- **Premium concepts / vendors** — **hard-gated** at the actions: free couples can browse them (badge + lock/upsell) but can't select/use them.

Upgrade is an **action, not a page**: an "Unlock Premium" button (dashboard card + inline on each gate) starts Checkout; there is **no dedicated `/premium` page** (it would be dead weight post-upgrade). Stripe returns to `/dashboard`, which reflects the now-unlocked state.

## Goals

- **One-time Premium entitlement on the `Wedding`** (`premiumUnlockedAt`), shared by both partners; a pure `isPremium(wedding)` all gates consult.
- **Stripe hosted Checkout** (`createCheckoutSession` server action) + a **signature-verified webhook** (`POST /api/stripe/webhook`) that idempotently grants premium — the client redirect is cosmetic, never trusted.
- A **`Payment`** record for audit + webhook idempotency (keyed by Checkout Session id).
- **Server-enforced gates**: budget (feature) and premium concepts/vendors (content) reject free couples with `PREMIUM_REQUIRED`; the checklist loader caps free couples at 10 tasks + a hidden count.
- **Upgrade UX with no orphaned page**: a dashboard upgrade card (free only) + inline gate CTAs, all triggering Checkout; Stripe returns to `/dashboard?upgraded=1` (with graceful handling of the webhook race).
- New deps/secrets wired safely (`stripe` SDK; `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET`/`STRIPE_PRICE_ID`), tests that mock Stripe (no live calls in CI).

## Non-goals (deferred)

- **Recurring subscriptions**, tiers, proration, dunning, trials.
- **Refunds / self-serve downgrade.** (A future `charge.refunded` → revoke webhook is a clean add; not now.)
- **Multiple products / à-la-carte** premium purchases.
- **Invoicing / receipts UI** beyond Stripe's own emails; **tax/VAT** beyond what Stripe Checkout handles automatically.
- **A dedicated marketing/premium page** — intentionally omitted (gates + dashboard card are the only premium surfaces).
- **Per-task hard-gating of the checklist** — free couples' own tasks are display-capped, not action-gated (no cross-tenant risk).
- **Admin-managed pricing UI** — the price is a Stripe Price (`STRIPE_PRICE_ID`); managed in Stripe, not in-app.

## Key decisions

1. **One-time unlock, entitlement on `Wedding`.** `Wedding.premiumUnlockedAt DateTime?` (null = free). Shared across partners (matches the couple model). `isPremium(w) = w.premiumUnlockedAt != null` — one pure predicate, consulted everywhere. Chosen over a `User`-level or subscription model because a wedding is a one-time, time-boxed event.
2. **The webhook is the only authoritative grant.** Entitlement is set exclusively by the signature-verified `checkout.session.completed` handler — never by the client success redirect (which is spoofable). Idempotent via the unique `Payment.stripeCheckoutSessionId`: a replay/duplicate is a no-op.
3. **Hosted Checkout, no card data in-app.** `mode: payment`, one line item = `STRIPE_PRICE_ID`, `metadata.weddingId`. Lowest PCI/security surface (Stripe hosts the card page). The Stripe client is server-only (`STRIPE_SECRET_KEY` never reaches the client).
4. **Enforcement gradient (right-sized):** budget + premium concepts/vendors are **server-enforced** (page/loader + every mutation), because they gate a feature and admin content — a forged request must fail. The checklist 10-cap is a **loader display limit** (own data, low stakes) — not worth order-dependent per-task checks.
5. **Upgrade is an action, not a page.** `createCheckoutSession()` is reachable from the dashboard card + each gate's CTA; no `/premium` route. Stripe `success_url` = `/dashboard?upgraded=1`, `cancel_url` = `/dashboard`. Post-upgrade, the dashboard card disappears and the gate surfaces transform (budget route becomes the real budget, locks vanish) — nothing is orphaned.
6. **Webhook-race UX.** On `/dashboard?upgraded=1`, if entitlement isn't visible yet (webhook not processed), show a gentle "confirming your payment…" note; it resolves on the near-instant webhook (a refresh shows Premium). No client-side grant.
7. **`PREMIUM_REQUIRED` result variant.** The gated action-result unions (`BudgetActionResult`, `ConceptActionResult`, `VendorActionResult`) gain a `PREMIUM_REQUIRED` error; the UI maps it to an upsell. Checklist's `ActionResult` is unchanged (display-gate only).
8. **Webhook route is public + signature-gated.** `POST /api/stripe/webhook` must be reachable unauthenticated (Stripe calls it) and is protected solely by Stripe signature verification against `STRIPE_WEBHOOK_SECRET` on the raw request body. Confirm the proxy/auth layer does not block it.
9. **Stripe mocked in tests.** No live Stripe calls in unit/e2e; the webhook handler is tested with a locally-signed fake event; gating is tested by setting `premiumUnlockedAt` directly. CI needs no real Stripe keys.

## Scale & cost calibration

Right-sized to a few thousand couples. A one-time unlock means at most one `Payment` row + one `premiumUnlockedAt` write per wedding; the webhook does one indexed upsert. Gate checks are a boolean off the already-loaded `Wedding` — zero extra queries in the common path. No polling, no background jobs (the webhook is synchronous and fast). Stripe hosts the payment page (no new storage/PCI). The only new persistent state is the `Payment` table (tiny) and one `Wedding` column.

## Data model

```prisma
enum PaymentStatus {
  PENDING
  PAID
  FAILED
}

model Payment {
  id                      String        @id @default(cuid())
  weddingId               String
  wedding                 Wedding       @relation(fields: [weddingId], references: [id], onDelete: Cascade)
  stripeCheckoutSessionId String        @unique            // idempotency key
  stripePaymentIntentId   String?
  status                  PaymentStatus @default(PENDING)
  amount                  Int?                             // minor units, filled from the session
  currency                String?
  createdAt               DateTime      @default(now())
  updatedAt               DateTime      @updatedAt

  @@index([weddingId])
}
```

Added to `Wedding`: `premiumUnlockedAt DateTime?` and `payments Payment[]`.

No other model changes. `Concept.isPremium` / `Vendor.isPremium` already exist and are now enforced (not re-modeled).

## Domain logic, actions & the webhook

**`lib/premium/entitlement.ts` (pure, unit-tested):**
- `isPremium(wedding: { premiumUnlockedAt: Date | null }): boolean`.
- `FREE_CHECKLIST_LIMIT = 10`.
- `capChecklist<T>(tasks: T[], premium: boolean): { tasks: T[]; hiddenCount: number }` — returns all when premium, else the first 10 + `hiddenCount = max(0, total-10)`.

**`lib/stripe/client.ts`:** a lazily-initialized server-only Stripe client from `STRIPE_SECRET_KEY` (throws clearly if unset). Never imported by client components.

**`lib/stripe/checkout.ts`:** `createCheckoutSessionForWedding(weddingId): Promise<{ url }>` — creates a Stripe Checkout Session (`mode: 'payment'`, line item `STRIPE_PRICE_ID`, `metadata.weddingId`, `success_url`/`cancel_url` from `APP_URL`), records a `PENDING` `Payment(stripeCheckoutSessionId)`, returns the hosted URL. (If the wedding is already premium, short-circuits — no session.)

**`lib/stripe/webhook.ts`:** `handleStripeEvent(event): Promise<void>` — the pure-ish dispatcher (given an already-verified event). On `checkout.session.completed`: look up the `Payment` by session id; if not already `PAID`, mark it `PAID` (+ amount/currency/paymentIntentId) and set `Wedding.premiumUnlockedAt` (only if null — idempotent); ignore other event types. Signature verification is the route's job.

**`lib/actions/premium.ts` — couple action:** `startCheckout(): Promise<{ ok: true; url } | { ok: false; error: 'UNAUTHENTICATED' | 'NOT_FOUND' | 'ALREADY_PREMIUM' | 'CONFIG' }>` — ownership-scoped (resolve the session wedding), calls `createCheckoutSessionForWedding`, returns the URL for the client to redirect to.

**`app/api/stripe/webhook/route.ts` — `POST`:** read the **raw** body (`await req.text()`), verify with `stripe.webhooks.constructEvent(body, sig, STRIPE_WEBHOOK_SECRET)`; on bad signature → `400`; on success → `handleStripeEvent(event)` → `200`. Public route (no auth); errors never leak internals.

**Gates (existing modules gain a premium check):**
- `lib/actions/budget.ts` — every mutation resolves the wedding (already does) and now rejects `PREMIUM_REQUIRED` when `!isPremium(wedding)`. `BudgetActionResult` gains `PREMIUM_REQUIRED`.
- `lib/actions/vendors.ts` — `pushQuoteToBudget` rejects `PREMIUM_REQUIRED` when not premium (it writes budget). The premium-vendor gate: `toggleShortlist`/`setQuoteStatus`/`setQuoteAmount`/`setQuoteNotes`/`linkQuoteToTask` reject `PREMIUM_REQUIRED` when the target vendor `isPremium` and the wedding isn't premium. `VendorActionResult` gains `PREMIUM_REQUIRED`.
- `lib/actions/concepts.ts` — `chooseConcept`/`addElementToChecklist` reject `PREMIUM_REQUIRED` when the concept `isPremium` and the wedding isn't premium. `ConceptActionResult` gains `PREMIUM_REQUIRED`.

## UI & navigation

- **Dashboard (`app/[locale]/(app)/dashboard/page.tsx`):** when free, an **upgrade card** (pitch + "Unlock Premium" → `startCheckout` → `window.location = url`); when premium, the card is gone (optionally a small "Premium ✓"). Handle `?upgraded=1`: show a success confirmation; if entitlement not yet visible, a "confirming your payment…" note.
- **Budget (`/budget`):** the loader renders a **paywall** component (feature pitch + Unlock CTA) when `!isPremium`, else the existing budget UI. The budget card on the dashboard also becomes an upsell when free.
- **Checklist (`/checklist`):** the loader passes only `capChecklist(...)` tasks + `hiddenCount` when free; the view shows a "+N more tasks — unlock Premium" row/banner with the CTA.
- **Concepts:** premium concept cards/detail show a **lock** overlay/badge; "Select"/"Add to checklist" become "Unlock Premium" when free. Non-premium unchanged.
- **Vendors:** premium vendor cards/detail show a **lock**; shortlist/quote controls become "Unlock Premium" when free. Premium vendors stay visible.
- A small shared **`UpgradeButton`** client component (calls `startCheckout`, redirects, shows pending/error) reused by every CTA. All copy via i18n (`Premium` namespace, he/en); RTL; design tokens.
- **Env:** add `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID` to `.env.example` + the setup docs. The webhook route must be excluded from any auth redirect (public).

## Error handling & edge cases

- **Webhook signature invalid / missing** → `400`, no state change. **Unknown event type** → `200` ignored. **Replay / duplicate `checkout.session.completed`** → idempotent no-op (Payment already `PAID`, `premiumUnlockedAt` already set).
- **Payment succeeds but the `Payment` row is missing** (e.g. created out-of-band) → the handler resolves the wedding from `session.metadata.weddingId` and still grants (with an upsert), so a race on the PENDING insert can't lose a paid grant.
- **`startCheckout` when already premium** → `ALREADY_PREMIUM` (UI hides the CTA anyway). **Missing Stripe config** → `CONFIG` (never 500s the page).
- **Client returns before the webhook** (`?upgraded=1`) → "confirming…" note; entitlement appears on the webhook (near-instant) / refresh. No client grant.
- **Gate ownership** — premium checks read the session-resolved `Wedding` (never a client id); a forged budget/concept/vendor mutation from a free couple returns `PREMIUM_REQUIRED`.
- **Concept/vendor turned premium after a free couple already selected/used it** — enforcement is at the point of the *action*; already-created state (a chosen concept, an existing quote/task) is not retroactively revoked. (Acceptable; admins rarely flip a live item's premium flag.)
- **Deleting a wedding** cascades its `Payment` rows.
- **Secrets** never logged; Stripe client is server-only; the webhook body is read raw exactly once.

## Testing strategy

Mirrors prior phases (unit-heavy + focused e2e); **Stripe is mocked** — no live calls.

- **Unit (Vitest):**
  - `lib/premium/entitlement.test.ts` — `isPremium` (null vs set); `capChecklist` (premium = all; free = first 10 + correct `hiddenCount`; <10 → 0 hidden).
  - `lib/stripe/webhook.test.ts` — `handleStripeEvent`: `checkout.session.completed` sets `premiumUnlockedAt` + marks `Payment` PAID; **replay is idempotent** (no double-grant, `premiumUnlockedAt` unchanged); missing-Payment path still grants via `metadata.weddingId`; non-completed events ignored.
  - Webhook **route** — a locally-signed body verifies + dispatches; a bad signature → 400 (using Stripe's test signing to construct a valid header, and a tampered one for the negative).
  - `lib/stripe/checkout.test.ts` — creates a session with `metadata.weddingId` + `STRIPE_PRICE_ID`, records a PENDING `Payment`, returns the url; already-premium short-circuits (Stripe client mocked).
  - Gate tests — `budget.ts`/`concepts.ts`/`vendors.ts`: a free wedding gets `PREMIUM_REQUIRED` on the gated actions; a premium wedding proceeds; non-premium concept/vendor is unaffected.
- **Component (Vitest + RTL):** the budget paywall renders when free; the checklist "+N more" teaser; a premium concept/vendor lock; `UpgradeButton` states.
- **E2E (Playwright):** a free couple hits the budget paywall, sees the checklist "+N more", and a premium concept/vendor lock; then — with `premiumUnlockedAt` set directly in the DB (simulating a completed webhook; no live Stripe round-trip, mirroring the Phase 8 admin-promote idiom) — the same couple reaches the full budget, the full checklist, and can select a premium concept. Reuse the inline register/onboard helpers.
- **CI:** the `stripe` client is mocked; document the required env and the Stripe-CLI local-webhook workflow (`stripe listen --forward-to /api/stripe/webhook`). No real keys in CI.

## Acceptance criteria

1. A **one-time** payment via Stripe hosted Checkout unlocks Premium for the **wedding** (both partners); entitlement is `Wedding.premiumUnlockedAt`, granted **only** by the signature-verified webhook (never the client redirect).
2. The webhook is **idempotent** (replayed `checkout.session.completed` = no-op) and **rejects bad signatures** (400); `Payment` records the session for audit/idempotency.
3. **Budget** is hard-gated: a free couple sees a paywall at `/budget` and every budget mutation (incl. vendor `pushQuoteToBudget`) returns `PREMIUM_REQUIRED`; a premium couple has full access.
4. **Checklist** shows a free couple the first 10 tasks + a "+N more — unlock Premium" teaser; a premium couple sees all.
5. **Premium concepts/vendors** are browsable by free couples (badge + lock) but selecting/using them returns `PREMIUM_REQUIRED`; premium couples can use them. Non-premium content is unaffected.
6. Upgrade is reachable from the **dashboard card** and **inline gate CTAs** (no dedicated page); Stripe returns to `/dashboard`, which reflects the unlocked state and handles the webhook race gracefully.
7. `startCheckout` is ownership-scoped; the Stripe secret key never reaches the client; the webhook route is public + signature-gated; secrets aren't logged.
8. No hard-coded strings (ESLint clean); he/en key parity; logical RTL properties; all money/price via the Stripe Price (not hardcoded).
9. Stripe is mocked in tests; `lint --max-warnings 0`, typecheck, and all unit + component + e2e tests green.

## Roadmap position

Done: Phases 1–8. **This: Phase 9 — Premium / Payments.** Next: **Phase 10 — AI Multi-Agent Layer** (AI-driven vendor matching + budget optimization, on top of the `lib/vendors/recommend` + `lib/budget/optimize` + `lib/dashboard` seams; premium can gate AI features). Candidate future adds the codebase is now shaped for: recurring/refund webhooks, in-app vendor messaging, user/couple management + audit log.
