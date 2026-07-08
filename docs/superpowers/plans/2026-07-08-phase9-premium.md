# Phase 9 — Premium / Payments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a one-time Premium unlock per wedding via Stripe hosted Checkout, granted solely by a signature-verified idempotent webhook, and enforce it — hard-gate the budget feature + premium concepts/vendors on the server (`PREMIUM_REQUIRED`), display-cap the checklist to 10 tasks for free couples, and surface upgrade via a dashboard card + inline gate CTAs (no dedicated page).

**Architecture:** Entitlement is `Wedding.premiumUnlockedAt` (shared by partners); a pure `isPremium(wedding)` gates everything. `lib/stripe/` holds the server-only client, checkout-session creation, and the webhook event handler; `app/api/stripe/webhook/route.ts` verifies the signature and dispatches. A shared `lib/premium/gate.ts` gives server actions a one-call `requirePremiumWedding()`. The Stripe client is mocked in all tests (no live calls).

**Tech Stack:** Next.js 16 (App Router, RSC + server actions + route handlers), Prisma 6.19.3 + Postgres, `stripe` Node SDK, next-intl (he default/RTL + en), Vitest, Playwright, Tailwind v4 design tokens.

## Global Constraints

- **The webhook is the ONLY authoritative grant.** `Wedding.premiumUnlockedAt` is set exclusively by the signature-verified `checkout.session.completed` handler — NEVER by the client success redirect. Idempotent (unique `Payment.stripeCheckoutSessionId` + a `premiumUnlockedAt IS NULL` conditional write).
- **Server-only Stripe secret.** `STRIPE_SECRET_KEY` is read only in `lib/stripe/*` (server); never imported by a client component, never `NEXT_PUBLIC_`. The webhook route runs on the **Node runtime** (`export const runtime = 'nodejs'`) so `stripe.webhooks.constructEvent` (Node crypto) works, and reads the **raw** body (`await req.text()`).
- **Enforcement gradient:** budget mutations + premium concept/vendor actions reject free couples with `PREMIUM_REQUIRED` (server-enforced). The checklist 10-cap is a loader display limit only (own data). Never trust the client for a gate.
- **Stripe pinned + mocked in tests.** Install `stripe` and pin the resolved version in `package.json`. Every test mocks `@/lib/stripe/client` — NO live Stripe calls in unit/e2e/CI. CI needs no real Stripe keys.
- **No new hard-coded strings** — all chrome via `messages/*.json` (identical he/en key sets; ESLint-enforced). RTL logical props (`ps-`/`pe-`/`text-start`); design tokens.
- **Ownership scoping** — premium checks read the session-resolved `Wedding` (via `getCurrentWedding`), never a client id.
- **Env** — add `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID` to `.env.example` + setup docs; do NOT commit real values. The webhook route must be reachable unauthenticated (Stripe calls it); confirm `proxy.ts` doesn't block `/api/stripe/webhook`.
- **Lint/type gate** — `npm run lint` (`--max-warnings 0`) and `npm run typecheck` stay green.

## File Structure

**Create:**
- `lib/premium/entitlement.ts` (+ `.test.ts`) — `isPremium`, `FREE_CHECKLIST_LIMIT`, `capChecklist`.
- `lib/premium/gate.ts` (+ `.test.ts`) — `requireWedding`, `requirePremiumWedding`.
- `lib/stripe/client.ts` — lazy server-only Stripe client.
- `lib/stripe/checkout.ts` (+ `.test.ts`) — `createCheckoutSessionForWedding`.
- `lib/stripe/webhook.ts` (+ `.test.ts`) — `handleStripeEvent`.
- `lib/actions/premium.ts` (+ `.test.ts`) — `startCheckout` server action.
- `app/api/stripe/webhook/route.ts` (+ `.test.ts`) — POST handler.
- `app/[locale]/(app)/budget/paywall.tsx` — the budget paywall (client).
- `app/[locale]/(app)/upgrade-button.tsx` — shared `UpgradeButton` (client).

**Modify:**
- `prisma/schema.prisma` — `PaymentStatus` enum, `Payment` model, `Wedding.premiumUnlockedAt`/`payments`.
- `lib/actions/budget.ts` — gate all mutations (`requirePremiumWedding`); `BudgetActionResult` gains `PREMIUM_REQUIRED`.
- `lib/actions/vendors.ts` — gate `pushQuoteToBudget` + premium-vendor actions; `VendorActionResult` gains `PREMIUM_REQUIRED`.
- `lib/actions/concepts.ts` — gate premium-concept actions; `ConceptActionResult` gains `PREMIUM_REQUIRED`.
- `app/[locale]/(app)/budget/page.tsx` — paywall when free.
- `app/[locale]/(app)/checklist/page.tsx` — display-cap + `hiddenCount`.
- `app/[locale]/(app)/checklist/checklist-view.tsx` — "+N more" teaser.
- `app/[locale]/(app)/concepts/**` + `vendors/**` — locks/upsell on premium items when free.
- `app/[locale]/(app)/dashboard/page.tsx` — upgrade card (free) + `?upgraded=1` handling.
- `messages/en.json` + `messages/he.json` — `Premium` namespace.
- `.env.example` — the three Stripe vars.
- `e2e/premium.spec.ts` — create.

---

### Task 1: Schema, migration & pure entitlement

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `lib/premium/entitlement.ts`, `lib/premium/entitlement.test.ts`

**Interfaces:**
- Produces: enum `PaymentStatus`; model `Payment`; `Wedding.premiumUnlockedAt` (nullable) + `payments`. `isPremium(wedding): boolean`; `FREE_CHECKLIST_LIMIT: number`; `capChecklist<T>(tasks, premium): { tasks, hiddenCount }`.

- [ ] **Step 1: Add the schema**

In `prisma/schema.prisma` add the enum + model and the `Wedding` fields:

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
  stripeCheckoutSessionId String        @unique
  stripePaymentIntentId   String?
  status                  PaymentStatus @default(PENDING)
  amount                  Int?
  currency                String?
  createdAt               DateTime      @default(now())
  updatedAt               DateTime      @updatedAt

  @@index([weddingId])
}
```

In the `Wedding` model add (near `budgetAllocations`/`vendors`):

```prisma
  premiumUnlockedAt DateTime?
  payments          Payment[]
```

- [ ] **Step 2: Migrate + typecheck**

Run: `npm run db:migrate -- --name add_premium_payments`
Expected: new migration folder; "in sync". Then `npm run typecheck` → PASS (`Payment`, `PaymentStatus` available).

- [ ] **Step 3: Write the entitlement tests**

`lib/premium/entitlement.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { isPremium, FREE_CHECKLIST_LIMIT, capChecklist } from './entitlement';

describe('isPremium', () => {
  it('is false when premiumUnlockedAt is null, true when set', () => {
    expect(isPremium({ premiumUnlockedAt: null })).toBe(false);
    expect(isPremium({ premiumUnlockedAt: new Date('2026-01-01') })).toBe(true);
  });
});

describe('capChecklist', () => {
  const tasks = Array.from({ length: 25 }, (_, i) => ({ id: `t${i}` }));
  it('returns all tasks with 0 hidden for premium', () => {
    expect(capChecklist(tasks, true)).toEqual({ tasks, hiddenCount: 0 });
  });
  it('returns the first FREE_CHECKLIST_LIMIT + the hidden count for free', () => {
    const r = capChecklist(tasks, false);
    expect(r.tasks).toHaveLength(FREE_CHECKLIST_LIMIT);
    expect(r.tasks[0].id).toBe('t0');
    expect(r.hiddenCount).toBe(25 - FREE_CHECKLIST_LIMIT);
  });
  it('reports 0 hidden when a free couple has <= the limit', () => {
    const few = tasks.slice(0, 5);
    expect(capChecklist(few, false)).toEqual({ tasks: few, hiddenCount: 0 });
  });
});
```

- [ ] **Step 4: Run it to verify it fails**

Run: `npm run test -- lib/premium/entitlement.test.ts`
Expected: FAIL ("Cannot find module './entitlement'").

- [ ] **Step 5: Implement**

`lib/premium/entitlement.ts`:

```typescript
/** Free couples see at most this many checklist tasks. */
export const FREE_CHECKLIST_LIMIT = 10;

/** The single premium predicate consulted by every gate. */
export function isPremium(wedding: { premiumUnlockedAt: Date | null }): boolean {
  return wedding.premiumUnlockedAt != null;
}

/** All tasks for premium; the first FREE_CHECKLIST_LIMIT + a hidden count for free. */
export function capChecklist<T>(tasks: T[], premium: boolean): { tasks: T[]; hiddenCount: number } {
  if (premium) return { tasks, hiddenCount: 0 };
  return {
    tasks: tasks.slice(0, FREE_CHECKLIST_LIMIT),
    hiddenCount: Math.max(0, tasks.length - FREE_CHECKLIST_LIMIT),
  };
}
```

- [ ] **Step 6: Run it to verify it passes; typecheck; lint; commit**

Run: `npm run test -- lib/premium/entitlement.test.ts && npm run typecheck && npm run lint`
Expected: PASS.

```bash
git add prisma/schema.prisma prisma/migrations lib/premium/entitlement.ts lib/premium/entitlement.test.ts
git commit -m "feat: add premium entitlement schema (Payment, premiumUnlockedAt) and pure helpers"
```

---

### Task 2: Stripe client, checkout & the `startCheckout` action

**Files:**
- Modify: `package.json` (add `stripe`), `.env.example`
- Create: `lib/stripe/client.ts`, `lib/stripe/checkout.ts` + `.test.ts`, `lib/actions/premium.ts` + `.test.ts`

**Interfaces:**
- Consumes: `isPremium` (`@/lib/premium/entitlement`), `getCurrentWedding`, `auth`, `prisma`.
- Produces:
  - `stripe` (server Stripe client) from `lib/stripe/client`.
  - `createCheckoutSessionForWedding(weddingId): Promise<{ url: string }>`.
  - `startCheckout(): Promise<{ ok: true; url: string } | { ok: false; error: 'UNAUTHENTICATED' | 'NOT_FOUND' | 'ALREADY_PREMIUM' | 'CONFIG' }>`.

- [ ] **Step 1: Install Stripe + document env**

Run: `npm install stripe` then pin the resolved version in `package.json` (replace `^x.y.z` with the exact installed version). Add to `.env.example`:

```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID=price_...
```

- [ ] **Step 2: Implement the server-only client**

`lib/stripe/client.ts`:

```typescript
import Stripe from 'stripe';

let cached: Stripe | null = null;

/** Lazily-initialized server-only Stripe client. Throws if the secret is unset. */
export function getStripe(): Stripe {
  if (cached) return cached;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set');
  cached = new Stripe(key);
  return cached;
}
```

- [ ] **Step 3: Write the checkout test (Stripe mocked)**

`lib/stripe/checkout.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const createSession = vi.fn();
vi.mock('./client', () => ({ getStripe: () => ({ checkout: { sessions: { create: createSession } } }) }));
vi.mock('@/lib/db', () => ({ prisma: { payment: { create: vi.fn() } } }));

import { prisma } from '@/lib/db';
import { createCheckoutSessionForWedding } from './checkout';

beforeEach(() => {
  vi.clearAllMocks();
  process.env.STRIPE_PRICE_ID = 'price_test';
  process.env.APP_URL = 'https://app.test';
});

describe('createCheckoutSessionForWedding', () => {
  it('creates a session with weddingId metadata + records a PENDING payment', async () => {
    createSession.mockResolvedValue({ id: 'cs_123', url: 'https://stripe.test/cs_123' });
    const r = await createCheckoutSessionForWedding('wed1');
    expect(r).toEqual({ url: 'https://stripe.test/cs_123' });
    expect(createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'payment',
        metadata: { weddingId: 'wed1' },
        line_items: [{ price: 'price_test', quantity: 1 }],
        success_url: 'https://app.test/dashboard?upgraded=1',
        cancel_url: 'https://app.test/dashboard',
      }),
    );
    expect(prisma.payment.create).toHaveBeenCalledWith({
      data: { weddingId: 'wed1', stripeCheckoutSessionId: 'cs_123', status: 'PENDING' },
    });
  });

  it('throws CONFIG when the price/app url is missing', async () => {
    delete process.env.STRIPE_PRICE_ID;
    await expect(createCheckoutSessionForWedding('wed1')).rejects.toThrow();
  });
});
```

- [ ] **Step 4: Run it to verify it fails, then implement**

Run: `npm run test -- lib/stripe/checkout.test.ts` → FAIL.

`lib/stripe/checkout.ts`:

```typescript
import { getStripe } from './client';
import { prisma } from '@/lib/db';

/** Create a one-time Checkout Session for a wedding and record a PENDING Payment. */
export async function createCheckoutSessionForWedding(weddingId: string): Promise<{ url: string }> {
  const priceId = process.env.STRIPE_PRICE_ID;
  const appUrl = process.env.APP_URL;
  if (!priceId || !appUrl) throw new Error('Stripe price or APP_URL not configured');

  const session = await getStripe().checkout.sessions.create({
    mode: 'payment',
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: { weddingId },
    success_url: `${appUrl}/dashboard?upgraded=1`,
    cancel_url: `${appUrl}/dashboard`,
  });

  await prisma.payment.create({
    data: { weddingId, stripeCheckoutSessionId: session.id, status: 'PENDING' },
  });

  if (!session.url) throw new Error('Stripe session has no URL');
  return { url: session.url };
}
```

Run: `npm run test -- lib/stripe/checkout.test.ts` → PASS.

- [ ] **Step 5: Write the `startCheckout` action test**

`lib/actions/premium.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/wedding/queries', () => ({ getCurrentWedding: vi.fn() }));
vi.mock('@/lib/stripe/checkout', () => ({ createCheckoutSessionForWedding: vi.fn() }));

import { auth } from '@/lib/auth';
import { getCurrentWedding } from '@/lib/wedding/queries';
import { createCheckoutSessionForWedding } from '@/lib/stripe/checkout';
import { startCheckout } from './premium';

beforeEach(() => {
  vi.clearAllMocks();
  (auth as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({ user: { id: 'u1' } });
  (getCurrentWedding as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({ id: 'wed1', premiumUnlockedAt: null });
});

describe('startCheckout', () => {
  it('returns the checkout url for a free wedding', async () => {
    (createCheckoutSessionForWedding as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({ url: 'https://stripe.test/x' });
    expect(await startCheckout()).toEqual({ ok: true, url: 'https://stripe.test/x' });
  });
  it('rejects when unauthenticated', async () => {
    (auth as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue(null);
    expect(await startCheckout()).toEqual({ ok: false, error: 'UNAUTHENTICATED' });
  });
  it('rejects when already premium', async () => {
    (getCurrentWedding as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({ id: 'wed1', premiumUnlockedAt: new Date() });
    expect(await startCheckout()).toEqual({ ok: false, error: 'ALREADY_PREMIUM' });
  });
  it('maps a Stripe/config failure to CONFIG', async () => {
    (createCheckoutSessionForWedding as unknown as { mockRejectedValue: (v: unknown) => void }).mockRejectedValue(new Error('boom'));
    expect(await startCheckout()).toEqual({ ok: false, error: 'CONFIG' });
  });
});
```

- [ ] **Step 6: Run it to verify it fails, then implement**

Run: `npm run test -- lib/actions/premium.test.ts` → FAIL.

`lib/actions/premium.ts`:

```typescript
'use server';

import { auth } from '@/lib/auth';
import { getCurrentWedding } from '@/lib/wedding/queries';
import { isPremium } from '@/lib/premium/entitlement';
import { createCheckoutSessionForWedding } from '@/lib/stripe/checkout';

export type StartCheckoutResult =
  | { ok: true; url: string }
  | { ok: false; error: 'UNAUTHENTICATED' | 'NOT_FOUND' | 'ALREADY_PREMIUM' | 'CONFIG' };

export async function startCheckout(): Promise<StartCheckoutResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: 'UNAUTHENTICATED' };
  const wedding = await getCurrentWedding(session.user.id);
  if (!wedding) return { ok: false, error: 'NOT_FOUND' };
  if (isPremium(wedding)) return { ok: false, error: 'ALREADY_PREMIUM' };
  try {
    const { url } = await createCheckoutSessionForWedding(wedding.id);
    return { ok: true, url };
  } catch {
    return { ok: false, error: 'CONFIG' };
  }
}
```

- [ ] **Step 7: Run it; typecheck; lint; commit**

Run: `npm run test -- lib/stripe lib/actions/premium.test.ts && npm run typecheck && npm run lint`
Expected: PASS.

```bash
git add package.json package-lock.json .env.example lib/stripe/client.ts lib/stripe/checkout.ts lib/stripe/checkout.test.ts lib/actions/premium.ts lib/actions/premium.test.ts
git commit -m "feat: add Stripe client, checkout-session creation, and startCheckout action"
```

---

### Task 3: The webhook (authoritative idempotent grant)

**Files:**
- Create: `lib/stripe/webhook.ts` + `.test.ts`, `app/api/stripe/webhook/route.ts` + `route.test.ts`

**Interfaces:**
- Consumes: `prisma`; `getStripe` (for `webhooks.constructEvent` in the route); `Stripe.Event`.
- Produces: `handleStripeEvent(event: Stripe.Event): Promise<void>`; `POST` route handler.

- [ ] **Step 1: Write the handler test (idempotency is the crux)**

`lib/stripe/webhook.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', () => ({
  prisma: {
    payment: { findUnique: vi.fn(), upsert: vi.fn() },
    wedding: { updateMany: vi.fn() },
  },
}));

import { prisma } from '@/lib/db';
import { handleStripeEvent } from './webhook';

function completedEvent(over: Record<string, unknown> = {}) {
  return {
    type: 'checkout.session.completed',
    data: { object: { id: 'cs_1', payment_intent: 'pi_1', amount_total: 4900, currency: 'ils', metadata: { weddingId: 'wed1' }, ...over } },
  } as never;
}

beforeEach(() => vi.clearAllMocks());

describe('handleStripeEvent', () => {
  it('ignores non-completed events', async () => {
    await handleStripeEvent({ type: 'payment_intent.created', data: { object: {} } } as never);
    expect(prisma.payment.upsert).not.toHaveBeenCalled();
    expect(prisma.wedding.updateMany).not.toHaveBeenCalled();
  });

  it('marks the payment PAID and grants premium only if not already', async () => {
    await handleStripeEvent(completedEvent());
    expect(prisma.payment.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { stripeCheckoutSessionId: 'cs_1' },
      update: expect.objectContaining({ status: 'PAID', stripePaymentIntentId: 'pi_1', amount: 4900, currency: 'ils' }),
      create: expect.objectContaining({ weddingId: 'wed1', stripeCheckoutSessionId: 'cs_1', status: 'PAID' }),
    }));
    // Conditional set-once: updateMany with premiumUnlockedAt: null guard.
    expect(prisma.wedding.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'wed1', premiumUnlockedAt: null },
    }));
  });

  it('resolves the wedding from an existing payment when metadata is absent', async () => {
    (prisma.payment.findUnique as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({ weddingId: 'wedX' });
    await handleStripeEvent(completedEvent({ metadata: {} }));
    expect(prisma.wedding.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'wedX', premiumUnlockedAt: null } }));
  });

  it('is a no-op when no wedding can be resolved', async () => {
    (prisma.payment.findUnique as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue(null);
    await handleStripeEvent(completedEvent({ metadata: {} }));
    expect(prisma.payment.upsert).not.toHaveBeenCalled();
    expect(prisma.wedding.updateMany).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it to verify it fails, then implement the handler**

Run: `npm run test -- lib/stripe/webhook.test.ts` → FAIL.

`lib/stripe/webhook.ts`:

```typescript
import type Stripe from 'stripe';
import { prisma } from '@/lib/db';

/**
 * Apply an already-verified Stripe event. The ONLY place premium is granted.
 * Idempotent: upsert by the unique session id + a `premiumUnlockedAt: null` guarded
 * write, so replays/duplicates are no-ops.
 */
export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  if (event.type !== 'checkout.session.completed') return;
  const session = event.data.object as Stripe.Checkout.Session;

  const metaWeddingId = session.metadata?.weddingId ?? null;
  const weddingId =
    metaWeddingId ??
    (await prisma.payment.findUnique({
      where: { stripeCheckoutSessionId: session.id },
      select: { weddingId: true },
    }))?.weddingId ??
    null;
  if (!weddingId) return;

  const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : null;
  const paid = {
    status: 'PAID' as const,
    stripePaymentIntentId: paymentIntentId,
    amount: session.amount_total ?? null,
    currency: session.currency ?? null,
  };

  await prisma.payment.upsert({
    where: { stripeCheckoutSessionId: session.id },
    create: { weddingId, stripeCheckoutSessionId: session.id, ...paid },
    update: paid,
  });

  // Grant once: only flips a wedding that is still free.
  await prisma.wedding.updateMany({
    where: { id: weddingId, premiumUnlockedAt: null },
    data: { premiumUnlockedAt: new Date() },
  });
}
```

Run: `npm run test -- lib/stripe/webhook.test.ts` → PASS.

- [ ] **Step 3: Write the route test (signature verification)**

`app/api/stripe/webhook/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const constructEvent = vi.fn();
vi.mock('@/lib/stripe/client', () => ({ getStripe: () => ({ webhooks: { constructEvent } }) }));
const handleStripeEvent = vi.fn();
vi.mock('@/lib/stripe/webhook', () => ({ handleStripeEvent }));

import { POST } from './route';

function req(body: string, sig: string | null) {
  return new Request('https://app.test/api/stripe/webhook', {
    method: 'POST',
    headers: sig ? { 'stripe-signature': sig } : {},
    body,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
});

describe('POST /api/stripe/webhook', () => {
  it('400s a missing signature', async () => {
    const res = await POST(req('{}', null));
    expect(res.status).toBe(400);
    expect(handleStripeEvent).not.toHaveBeenCalled();
  });
  it('400s an invalid signature and does not dispatch', async () => {
    constructEvent.mockImplementation(() => { throw new Error('bad sig'); });
    const res = await POST(req('{}', 'sig'));
    expect(res.status).toBe(400);
    expect(handleStripeEvent).not.toHaveBeenCalled();
  });
  it('200s a valid event and dispatches it', async () => {
    const event = { type: 'checkout.session.completed' };
    constructEvent.mockReturnValue(event);
    handleStripeEvent.mockResolvedValue(undefined);
    const res = await POST(req('{"x":1}', 'sig'));
    expect(res.status).toBe(200);
    expect(constructEvent).toHaveBeenCalledWith('{"x":1}', 'sig', 'whsec_test');
    expect(handleStripeEvent).toHaveBeenCalledWith(event);
  });
  it('500s (so Stripe retries) when the handler throws', async () => {
    constructEvent.mockReturnValue({ type: 'checkout.session.completed' });
    handleStripeEvent.mockRejectedValue(new Error('db down'));
    const res = await POST(req('{}', 'sig'));
    expect(res.status).toBe(500);
  });
});
```

- [ ] **Step 4: Run it to verify it fails, then implement the route**

Run: `npm run test -- app/api/stripe/webhook/route.test.ts` → FAIL.

`app/api/stripe/webhook/route.ts`:

```typescript
import { getStripe } from '@/lib/stripe/client';
import { handleStripeEvent } from '@/lib/stripe/webhook';

// Stripe signature verification uses Node crypto; must not run on the edge.
export const runtime = 'nodejs';

export async function POST(req: Request): Promise<Response> {
  const sig = req.headers.get('stripe-signature');
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) return new Response('Bad request', { status: 400 });

  const body = await req.text(); // raw body required for signature verification

  let event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, secret);
  } catch {
    return new Response('Invalid signature', { status: 400 });
  }

  try {
    await handleStripeEvent(event);
  } catch (err) {
    console.error('[stripe webhook] handler error', err);
    return new Response('Handler error', { status: 500 }); // Stripe will retry
  }

  return new Response('ok', { status: 200 });
}
```

Run: `npm run test -- app/api/stripe/webhook/route.test.ts` → PASS.

- [ ] **Step 5: Confirm the proxy does not block the webhook**

Read `proxy.ts` / `lib/auth/authorize.ts`. The webhook is `/api/stripe/webhook`; confirm API routes under `/api` are not caught by the page login-gate (existing `/api/auth`, `/api/inngest` are already public). If the proxy would redirect it, add an explicit exclusion for `/api/stripe/webhook`. Note the finding in your report; no change if already public.

- [ ] **Step 6: Typecheck; lint; commit**

Run: `npm run test -- lib/stripe/webhook.test.ts app/api/stripe/webhook/route.test.ts && npm run typecheck && npm run lint`
Expected: PASS.

```bash
git add lib/stripe/webhook.ts lib/stripe/webhook.test.ts "app/api/stripe/webhook/route.ts" "app/api/stripe/webhook/route.test.ts"
git commit -m "feat: add signature-verified idempotent Stripe webhook (sole premium grant)"
```

---

### Task 4: Server gates (`lib/premium/gate.ts` + budget/vendors/concepts)

**Files:**
- Create: `lib/premium/gate.ts` + `.test.ts`
- Modify: `lib/actions/budget.ts` + its test, `lib/actions/vendors.ts` + its test, `lib/actions/concepts.ts` + its test

**Interfaces:**
- Consumes: `auth`, `getCurrentWedding`, `isPremium`; `Wedding` type.
- Produces:
  - `requireWedding(): Promise<{ ok: true; wedding: Wedding } | { ok: false; error: 'UNAUTHENTICATED' | 'NOT_FOUND' }>`
  - `requirePremiumWedding(): Promise<{ ok: true; wedding: Wedding } | { ok: false; error: 'UNAUTHENTICATED' | 'NOT_FOUND' | 'PREMIUM_REQUIRED' }>`
  - `PREMIUM_REQUIRED` added to `BudgetActionResult`, `VendorActionResult`, `ConceptActionResult`.

- [ ] **Step 1: Write the gate helper test**

`lib/premium/gate.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/wedding/queries', () => ({ getCurrentWedding: vi.fn() }));

import { auth } from '@/lib/auth';
import { getCurrentWedding } from '@/lib/wedding/queries';
import { requireWedding, requirePremiumWedding } from './gate';

const set = (m: unknown, v: unknown) => (m as unknown as { mockResolvedValue: (x: unknown) => void }).mockResolvedValue(v);
beforeEach(() => vi.clearAllMocks());

describe('requireWedding', () => {
  it('UNAUTHENTICATED with no session', async () => { set(auth, null); expect(await requireWedding()).toEqual({ ok: false, error: 'UNAUTHENTICATED' }); });
  it('NOT_FOUND with no wedding', async () => { set(auth, { user: { id: 'u1' } }); set(getCurrentWedding, null); expect(await requireWedding()).toEqual({ ok: false, error: 'NOT_FOUND' }); });
  it('returns the wedding', async () => { set(auth, { user: { id: 'u1' } }); set(getCurrentWedding, { id: 'w1', premiumUnlockedAt: null }); expect(await requireWedding()).toEqual({ ok: true, wedding: { id: 'w1', premiumUnlockedAt: null } }); });
});

describe('requirePremiumWedding', () => {
  it('PREMIUM_REQUIRED for a free wedding', async () => { set(auth, { user: { id: 'u1' } }); set(getCurrentWedding, { id: 'w1', premiumUnlockedAt: null }); expect(await requirePremiumWedding()).toEqual({ ok: false, error: 'PREMIUM_REQUIRED' }); });
  it('passes a premium wedding', async () => { set(auth, { user: { id: 'u1' } }); const w = { id: 'w1', premiumUnlockedAt: new Date() }; set(getCurrentWedding, w); expect(await requirePremiumWedding()).toEqual({ ok: true, wedding: w }); });
});
```

- [ ] **Step 2: Run it to verify it fails, then implement `gate.ts`**

Run: `npm run test -- lib/premium/gate.test.ts` → FAIL.

`lib/premium/gate.ts`:

```typescript
import type { Wedding } from '@prisma/client';
import { auth } from '@/lib/auth';
import { getCurrentWedding } from '@/lib/wedding/queries';
import { isPremium } from './entitlement';

export type WeddingGate =
  | { ok: true; wedding: Wedding }
  | { ok: false; error: 'UNAUTHENTICATED' | 'NOT_FOUND' };

export async function requireWedding(): Promise<WeddingGate> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: 'UNAUTHENTICATED' };
  const wedding = await getCurrentWedding(session.user.id);
  if (!wedding) return { ok: false, error: 'NOT_FOUND' };
  return { ok: true, wedding };
}

export type PremiumGate =
  | { ok: true; wedding: Wedding }
  | { ok: false; error: 'UNAUTHENTICATED' | 'NOT_FOUND' | 'PREMIUM_REQUIRED' };

export async function requirePremiumWedding(): Promise<PremiumGate> {
  const g = await requireWedding();
  if (!g.ok) return g;
  if (!isPremium(g.wedding)) return { ok: false, error: 'PREMIUM_REQUIRED' };
  return { ok: true, wedding: g.wedding };
}
```

Run: `npm run test -- lib/premium/gate.test.ts` → PASS.

- [ ] **Step 3: Gate the budget actions**

In `lib/actions/budget.ts`: add `PREMIUM_REQUIRED` to `BudgetActionResult`; replace the `requireWeddingId()` guard in EVERY exported mutation with `requirePremiumWedding()`. Pattern for each action (example `setBudgetTotal`):

```typescript
import { requirePremiumWedding } from '@/lib/premium/gate';
// ...
export type BudgetActionResult =
  | { ok: true }
  | { ok: false; error: 'UNAUTHENTICATED' | 'INVALID' | 'NOT_FOUND' | 'PREMIUM_REQUIRED' };

export async function setBudgetTotal(amount: number | null): Promise<BudgetActionResult> {
  const g = await requirePremiumWedding();
  if (!g.ok) return g;
  const parsed = budgetTotalInput.safeParse({ amount });
  if (!parsed.success) return { ok: false, error: 'INVALID' };
  await prisma.wedding.update({ where: { id: g.wedding.id }, data: { budgetTotal: parsed.data.amount } });
  return { ok: true };
}
```

Apply the same swap to `setAvgGiftPerGuest`, `setCategoryAllocation`, `clearCategoryAllocation`, `setTaskAmountPaid`, `setTaskEstimatedCost` — each starts with `const g = await requirePremiumWedding(); if (!g.ok) return g;` and uses `g.wedding.id`. Remove the now-unused `requireWeddingId` helper and its double-`auth()` disambiguation (the gate returns the precise error). Keep task-ownership `findFirst({ where: { id, weddingId: g.wedding.id } })` checks as-is.

- [ ] **Step 4: Extend the budget action tests**

In `lib/actions/budget.test.ts`: the existing mocks stub `getCurrentWedding` → `{ id: 'wed1' }`; update that stub to include `premiumUnlockedAt: new Date()` so the existing happy-path tests still pass (now premium). Add: a free wedding (`getCurrentWedding → { id:'wed1', premiumUnlockedAt: null }`) makes each gated action return `{ ok: false, error: 'PREMIUM_REQUIRED' }` (parametrize over the exports).

- [ ] **Step 5: Gate the premium-vendor + pushQuoteToBudget actions**

In `lib/actions/vendors.ts`: add `PREMIUM_REQUIRED` to `VendorActionResult`.
- `pushQuoteToBudget`: after resolving the wedding, reject `PREMIUM_REQUIRED` when `!isPremium(wedding)` (it writes budget) — use `requirePremiumWedding()` at its top.
- Premium-vendor gate for `toggleShortlist`/`setQuoteStatus`/`setQuoteAmount`/`setQuoteNotes`/`linkQuoteToTask`: after loading the target vendor, if `vendor.isPremium && !isPremium(wedding)` return `PREMIUM_REQUIRED`. (Load `isPremium` in the vendor lookup's `select`. Use `requireWedding()` + `isPremium(g.wedding)` so non-premium vendors stay free.)

Extend `lib/actions/vendors.test.ts`: a free wedding + a premium vendor → `PREMIUM_REQUIRED` on those actions; a free wedding + a non-premium vendor → still works; `pushQuoteToBudget` on a free wedding → `PREMIUM_REQUIRED`. Update existing happy-path wedding stubs to `premiumUnlockedAt: new Date()` where they must still pass, and ensure the vendor fixtures carry `isPremium`.

- [ ] **Step 6: Gate the premium-concept actions**

In `lib/actions/concepts.ts`: add `PREMIUM_REQUIRED` to `ConceptActionResult`.
- `chooseConcept`: the existing `concept.findUnique` `select` gains `isPremium`; if `concept.isPremium && !isPremium(wedding)` return `PREMIUM_REQUIRED`.
- `addElementToChecklist`: load the element's parent concept `isPremium` (`conceptElement.findUnique({ where:{id}, select:{ ..., concept: { select: { isPremium: true } } } })`); if premium concept && free wedding → `PREMIUM_REQUIRED`.

Extend `lib/actions/concepts.test.ts`: free wedding + premium concept → `PREMIUM_REQUIRED` on both; free wedding + non-premium concept → still works; premium wedding → works. Adjust wedding stubs to carry `premiumUnlockedAt`.

- [ ] **Step 7: Run all affected suites; typecheck; lint; commit**

Run: `npm run test -- lib/premium lib/actions/budget.test.ts lib/actions/vendors.test.ts lib/actions/concepts.test.ts && npm run typecheck && npm run lint`
Expected: PASS.

```bash
git add lib/premium/gate.ts lib/premium/gate.test.ts lib/actions/budget.ts lib/actions/budget.test.ts lib/actions/vendors.ts lib/actions/vendors.test.ts lib/actions/concepts.ts lib/actions/concepts.test.ts
git commit -m "feat: server-enforce premium gates (budget, premium concepts/vendors) with PREMIUM_REQUIRED"
```

---

### Task 5: UI — paywall, checklist cap, locks, dashboard upgrade card, i18n

**Files:**
- Create: `app/[locale]/(app)/upgrade-button.tsx`, `app/[locale]/(app)/budget/paywall.tsx`, and a component test `app/[locale]/(app)/premium-ui.test.tsx`
- Modify: `budget/page.tsx`, `checklist/page.tsx` + `checklist-view.tsx`, `dashboard/page.tsx`, the concepts + vendors couple UI (locks), `messages/en.json` + `messages/he.json`

**Interfaces:**
- Consumes: `startCheckout` (`@/lib/actions/premium`); `isPremium`, `capChecklist` (`@/lib/premium/entitlement`); `getCurrentWedding`.

- [ ] **Step 1: Add the `Premium` i18n namespace (en + he, identical keys)**

Add to both `messages/en.json` and `messages/he.json` (values differ). Keys: `unlockCta` ("Unlock Premium" / "שדרגו לפרימיום"), `upgradeCardTitle`, `upgradeCardBody`, `budgetPaywallTitle`, `budgetPaywallBody`, `checklistMore` ("+{count} more tasks — unlock Premium" / with `{count}`), `lockedConcept`, `lockedVendor`, `confirming` ("Confirming your payment…" / "מאשרים את התשלום…"), `premiumActive` ("Premium ✓" / "פרימיום ✓"), `checkoutError`. (Provide natural Hebrew for each; keep the key set identical.)

- [ ] **Step 2: Implement the shared `UpgradeButton` (client)**

`app/[locale]/(app)/upgrade-button.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { startCheckout } from '@/lib/actions/premium';

export function UpgradeButton({ className }: { className?: string }) {
  const t = useTranslations('Premium');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  async function go() {
    setError(false);
    setPending(true);
    const r = await startCheckout();
    if (r.ok) {
      window.location.href = r.url; // redirect to Stripe hosted Checkout
      return;
    }
    setPending(false);
    setError(true);
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={go}
        className={className ?? 'rounded-card bg-primary px-4 py-2 text-sm font-medium text-background disabled:opacity-60'}
      >
        {t('unlockCta')}
      </button>
      {error ? <span className="text-sm text-red-600">{t('checkoutError')}</span> : null}
    </div>
  );
}
```

- [ ] **Step 3: Budget paywall**

Create `app/[locale]/(app)/budget/paywall.tsx` (a simple RSC/client card: `budgetPaywallTitle` + `budgetPaywallBody` + `<UpgradeButton/>`). In `budget/page.tsx`, after loading `wedding`, if `!isPremium(wedding)` render `<Paywall/>` instead of the budget view (keep the existing view for premium). Update the dashboard budget card similarly (upsell when free).

- [ ] **Step 4: Checklist display-cap + teaser**

In `checklist/page.tsx`: compute `const premium = isPremium(wedding)`, then `const { tasks: shown, hiddenCount } = capChecklist(tasks, premium)`; pass `shown` (serialized) + `hiddenCount` to `ChecklistView`. In `checklist-view.tsx`: accept `hiddenCount`; when `> 0`, render a "+N more — unlock Premium" banner (`Premium.checklistMore` with `{count: hiddenCount}`) + `<UpgradeButton/>`. (Trashed tasks/other views unchanged.)

- [ ] **Step 5: Concept + vendor locks**

Concepts: in the couple concept card/detail, when the concept `isPremium` and the wedding is free, show a lock overlay + swap the Select / Add-to-checklist controls for `<UpgradeButton/>` (the detail loader already knows the concept + can be passed `premium`). Vendors: same — premium vendor card/detail shows a lock; the shortlist/quote controls become `<UpgradeButton/>` when free. Thread a `premium` boolean from each loader (`isPremium(wedding)`). Keep non-premium items fully functional.

- [ ] **Step 6: Dashboard upgrade card + `?upgraded=1`**

In `dashboard/page.tsx`: when `!isPremium(wedding)`, render an upgrade card (`upgradeCardTitle`/`upgradeCardBody` + `<UpgradeButton/>`). When premium, omit it (optionally show `premiumActive`). Read `searchParams.upgraded`: when `=== '1'` and NOT yet premium, show the `confirming` note (the webhook will flip it; a refresh resolves). When premium + `upgraded=1`, a brief success confirmation.

- [ ] **Step 7: Component test**

`app/[locale]/(app)/premium-ui.test.tsx` — render with `NextIntlClientProvider` + `vi.mock('@/lib/actions/premium')`. Assert: the budget paywall renders its title + an Unlock button; the checklist teaser shows "+N more" for `hiddenCount>0`; `UpgradeButton` calls `startCheckout` on click. (Mirror the sibling component-test idiom.)

- [ ] **Step 8: Run tests; full suite; typecheck; lint; commit**

Run: `npm run test && npm run typecheck && npm run lint`
Expected: PASS (he/en parity holds).

```bash
git add "app/[locale]/(app)" messages/en.json messages/he.json
git commit -m "feat: premium UI — budget paywall, checklist teaser, concept/vendor locks, dashboard upgrade card"
```

---

### Task 6: E2E + acceptance verification

**Files:**
- Create: `e2e/premium.spec.ts`

- [ ] **Step 1: Write the E2E spec**

`e2e/premium.spec.ts` — copy the inline register/onboard helpers from `e2e/concepts.spec.ts` (prefix `e2e-premium-`), and `import { prisma } from '../lib/db'` + `import 'dotenv/config'` (the Phase 8 admin-e2e idiom). Two flows:
- **Free couple is gated:** register+onboard → `/budget` shows the paywall (no budget UI); `/checklist` shows the "+N more" teaser (seed is 44 tasks → 34 hidden); a premium concept's detail shows the lock / Unlock CTA instead of Select. (Use a seeded premium concept — "Italian Summer"/"Old Money" are `isPremium: true` in the seed.)
- **Premium couple has access:** set `premiumUnlockedAt` directly via `prisma.wedding.update` (simulating a completed webhook — NO live Stripe), reload → `/budget` shows the real budget (can set a total), `/checklist` shows all tasks (no teaser), the premium concept can be selected.

Do NOT attempt a live Stripe Checkout round-trip in e2e. `test.afterAll` disconnects prisma.

- [ ] **Step 2: Run the E2E spec**

Run: `npm run test:e2e -- premium.spec.ts`
Expected: PASS. (Restart a stale `next dev` if needed.)

- [ ] **Step 3: Full acceptance sweep**

```bash
npm run lint && npm run typecheck && npm run test && npm run test:e2e
```
Walk the spec's Acceptance criteria (1–9) and confirm each maps to a passing test or a manual check. Record counts.

- [ ] **Step 4: Commit**

```bash
git add e2e/premium.spec.ts
git commit -m "test: add premium e2e (free gated: paywall/teaser/locks; premium: full access)"
```

---

### Final: Whole-branch review

- [ ] **Step 1: Run the full gate**

```bash
npm run lint && npm run typecheck && npm run test && npm run test:e2e
```
Expected: all green. Record counts.

- [ ] **Step 2: Adversarial whole-branch review (security-focused)**

Request a review of the whole `phase-9-premium` diff (final reviewer on the most capable model). Focus:
- **The webhook is the sole grant, verified + idempotent:** `premiumUnlockedAt` is set ONLY in `handleStripeEvent`; the route verifies the signature (raw body, Node runtime) and 400s bad signatures; a replayed `checkout.session.completed` is a no-op (`updateMany … premiumUnlockedAt: null` + upsert by unique session id). Confirm the client redirect NEVER grants.
- **No secret leak:** `STRIPE_SECRET_KEY` only in `lib/stripe/*` (server); no `NEXT_PUBLIC_`, no client import; webhook route reads raw body once; secrets not logged.
- **Gates are server-enforced + complete:** every budget mutation, `pushQuoteToBudget`, and every premium-concept/vendor action rejects a free couple with `PREMIUM_REQUIRED`; a forged request can't bypass. The checklist cap is loader-only (own data — acceptable).
- **Ownership:** gates read the session-resolved wedding; the webhook resolves the wedding from the payment/metadata, not client input.
- **Idempotency/races:** the `premiumUnlockedAt: null` guarded write + unique session id handle duplicate/concurrent webhooks; already-selected content isn't retroactively revoked (documented).
- **i18n he/en parity; RTL; no hard-coded strings; Stripe mocked (no live calls); proxy leaves the webhook public.**

- [ ] **Step 3: Address findings; update the implementation log**

Apply Critical/Important fixes (commit each). Add the Phase 9 section to `docs/superpowers/IMPLEMENTATION-LOG.md` (delivered summary, verification counts, key decisions/deviations; mark the Phase 4 "premium paywall enforcement (Phase 9)" backlog item RESOLVED; note the required Stripe env + the CI note that Stripe is mocked). Commit.

- [ ] **Step 4: Push / PR** (only on the user's explicit go-ahead — never commit/push without per-request permission).
