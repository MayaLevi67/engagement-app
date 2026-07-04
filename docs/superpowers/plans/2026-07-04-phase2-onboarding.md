# Phase 2: Onboarding & Wedding Profile — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A guided, premium onboarding wizard that creates and populates a couple's wedding profile, gates the app until onboarding is complete, and lets couples edit every field afterward.

**Architecture:** Typed profile columns on the existing `Wedding` model. A single field-definition module (metadata + Zod schemas co-located) is the source of truth that the wizard, the edit page, and validation all derive from. Server Actions persist step-by-step, scoped to the caller's own wedding (resolved via DB by session user id, never the stale JWT claim). Login gating stays in the edge `proxy.ts`; the onboarding gate lives in a new authenticated `(app)` layout (fresh DB read).

**Tech Stack:** Next.js 16 App Router, Prisma 6.19.3 + Postgres, Auth.js v5, next-intl, Tailwind v4 tokens, Zod, Vitest + Playwright.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-07-04-onboarding-wedding-profile-design.md` — its acceptance criteria are the definition of done.
- **Next.js 16:** App Router; route interception is `proxy.ts` (no `middleware.ts`). Verify version-sensitive APIs against `node_modules/next/dist/docs/` / context7 before use.
- **All profile columns nullable** (hybrid fill-later). `onboardingCompletedAt: DateTime?` is the gate marker.
- **Ownership:** every profile read/write resolves the wedding by looking up the **session user in the DB** (`user.weddingId` / `user.wedding`), NOT the JWT `weddingId` claim (stale until token refresh). A user can only touch their own wedding.
- **Priorities:** ordered array, length 0–3, from enum `Priority { FOOD PARTY PHOTOGRAPHY GUEST_EXPERIENCE DESIGN FASHION }`. Order = rank. Enforced client AND server.
- **Enums:** `VenueSetting { INDOOR OUTDOOR MIXED }`, `CeremonyType { RELIGIOUS CIVIL MIXED }`, `Priority` (above).
- **Budget:** `Int?`, whole shekels (₪), ILS only.
- **Localization:** all UI text via next-intl (Hebrew default + English), no hard-coded JSX strings — the Phase 1 lint gate runs `eslint --max-warnings 0` with `react/jsx-no-literals` at `error`. Enum option labels live in message files, not the DB.
- **Onboarding visual direction:** "old-money"/quiet-luxury — Phase 1 serif display fonts (Frank Ruhl Libre he / Playfair en), muted sage/cream/gold tokens, generous whitespace. **Centered composition** (headings/questions/buttons horizontally centered) so it reads well in both he/en; text inside inputs still flows in the correct direction (Hebrew RTL). Tailwind **logical properties only** (`ps-*`/`pe-*`/`text-start`/`text-center`, never `pl-*`/`text-left`).
- **Single source of truth:** field metadata + Zod schemas co-located in `lib/wedding/profile-fields.ts`. Adding/changing a field = edit that module + a migration. (Deliberately NOT a generic metadata→Zod generator — YAGNI/cost-calibrated at this scale.)
- **Scale/cost:** right-sized to a few thousand users; the gate is one indexed read by PK; no new external services.
- **Commits:** commit per task on the `phase-2-onboarding` branch. Do NOT push or open a PR without explicit user permission.
- **Local dev:** Docker Postgres on host port 5433 (see `.env`); tests use `.env.test` (`wedding_test`).

---

## File Structure

```
prisma/schema.prisma                          # + Wedding profile columns, 3 enums
prisma/migrations/<ts>_add_wedding_profile/   # generated migration
lib/wedding/
  profile-fields.ts                           # SOURCE OF TRUTH: field metadata + Zod schemas
  queries.ts                                  # getCurrentWedding(userId)
lib/actions/
  onboarding.ts                               # saveOnboardingStep, completeOnboarding, updateWeddingProfile
app/[locale]/(app)/layout.tsx                 # NEW: onboarding gate (redirect to /onboarding if incomplete)
app/[locale]/onboarding/
  page.tsx                                    # server: resume state / redirect if done
  onboarding-wizard.tsx                        # client: wizard shell (step state)
  steps/*.tsx                                  # step components (names, date, size-budget, style, priorities, done)
app/[locale]/settings/wedding/
  page.tsx                                    # server: load wedding
  edit-wedding-form.tsx                        # client: edit form from field defs
lib/auth/authorize.ts                         # + /onboarding, /settings to APP_PREFIXES
messages/he.json, messages/en.json            # + Onboarding, WeddingProfile, enum-label namespaces
e2e/onboarding.spec.ts                        # e2e flows
```

`/onboarding` and `/settings` live OUTSIDE the `(app)` route group so the onboarding gate (in the `(app)` layout) does not apply to them (no self-redirect loop), while still being login-gated by `proxy.ts` via the new `APP_PREFIXES` entries.

---

## Task 1: Wedding profile schema + migration + query helper

**Files:**
- Modify: `prisma/schema.prisma`
- Create: migration via CLI
- Create: `lib/wedding/queries.ts`, `lib/wedding/queries.test.ts`

**Interfaces:**
- Produces: `getCurrentWedding(userId: string): Promise<Wedding | null>` from `lib/wedding/queries.ts`. New `Wedding` columns and enums `VenueSetting`, `CeremonyType`, `Priority`.

- [ ] **Step 1: Extend the `Wedding` model and add enums in `prisma/schema.prisma`**

Add these enums near the existing `UserRole`:
```prisma
enum VenueSetting {
  INDOOR
  OUTDOOR
  MIXED
}

enum CeremonyType {
  RELIGIOUS
  CIVIL
  MIXED
}

enum Priority {
  FOOD
  PARTY
  PHOTOGRAPHY
  GUEST_EXPERIENCE
  DESIGN
  FASHION
}
```

Replace the `Wedding` model body (keep `id`, `members`, timestamps) with:
```prisma
model Wedding {
  id        String   @id @default(cuid())
  members   User[]

  partner1Name          String?
  partner2Name          String?
  weddingDate           DateTime?
  dateIsApproximate     Boolean       @default(false)
  guestCount            Int?
  budgetTotal           Int?
  city                  String?
  venueSetting          VenueSetting?
  ceremonyType          CeremonyType?
  priorities            Priority[]
  onboardingCompletedAt DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

- [ ] **Step 2: Create and apply the migration**

Run: `npm run db:migrate -- --name add_wedding_profile`
Expected: new migration under `prisma/migrations/`, applied to `wedding_dev`; Prisma Client regenerated. (`Priority[]` becomes a Postgres enum array column.)

- [ ] **Step 3: Write the failing test — `lib/wedding/queries.test.ts`**

```ts
import { describe, it, expect, afterEach } from 'vitest';
import { prisma } from '@/lib/db';
import { getCurrentWedding } from './queries';

afterEach(async () => {
  await prisma.user.deleteMany();
  await prisma.wedding.deleteMany();
});

describe('getCurrentWedding', () => {
  it('returns the wedding linked to the user', async () => {
    const wedding = await prisma.wedding.create({
      data: { partner1Name: 'Maya', priorities: ['FOOD', 'PARTY'] },
    });
    const user = await prisma.user.create({
      data: { email: 'a@example.com', weddingId: wedding.id },
    });
    const result = await getCurrentWedding(user.id);
    expect(result?.id).toBe(wedding.id);
    expect(result?.partner1Name).toBe('Maya');
    expect(result?.priorities).toEqual(['FOOD', 'PARTY']);
  });

  it('returns null when the user has no wedding', async () => {
    const user = await prisma.user.create({ data: { email: 'b@example.com' } });
    expect(await getCurrentWedding(user.id)).toBeNull();
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npm test -- lib/wedding/queries.test.ts` → Expected: FAIL (cannot resolve `./queries`).

- [ ] **Step 5: Implement `lib/wedding/queries.ts`**

```ts
import { prisma } from '@/lib/db';
import type { Wedding } from '@prisma/client';

/** Resolves the caller's wedding via the DB (never the stale JWT claim). */
export async function getCurrentWedding(userId: string): Promise<Wedding | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { wedding: true },
  });
  return user?.wedding ?? null;
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm test -- lib/wedding/queries.test.ts` → Expected: PASS (2 tests).

- [ ] **Step 7: Typecheck + commit**

Run: `npm run typecheck` → clean.
```bash
git add prisma/ lib/wedding/queries.ts lib/wedding/queries.test.ts
git commit -m "feat: add wedding profile schema, migration, and getCurrentWedding"
```

---

## Task 2: Field-definition source of truth + Zod schemas

**Files:**
- Create: `lib/wedding/profile-fields.ts`, `lib/wedding/profile-fields.test.ts`

**Interfaces:**
- Consumes: enum types from `@prisma/client` (`VenueSetting`, `CeremonyType`, `Priority`).
- Produces:
  - `PROFILE_FIELDS: ProfileFieldDef[]` and `ONBOARDING_STEPS` (step metadata: number, titleKey, field keys) for rendering.
  - Per-step Zod schemas: `namesSchema`, `dateSchema`, `sizeBudgetSchema`, `styleSchema`, `prioritiesSchema`.
  - `fullProfileSchema` (all fields, all optional except names) for the edit page.
  - `type WeddingProfileInput = z.infer<typeof fullProfileSchema>`.

- [ ] **Step 1: Write the failing test — `lib/wedding/profile-fields.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import {
  namesSchema,
  prioritiesSchema,
  sizeBudgetSchema,
  fullProfileSchema,
  ONBOARDING_STEPS,
} from './profile-fields';

describe('profile field schemas', () => {
  it('requires partner1Name in the names step', () => {
    expect(namesSchema.safeParse({ partner1Name: '', partner2Name: 'A' }).success).toBe(false);
    expect(namesSchema.safeParse({ partner1Name: 'Maya', partner2Name: 'Asaf' }).success).toBe(true);
  });

  it('allows an empty priorities list but rejects more than 3', () => {
    expect(prioritiesSchema.safeParse({ priorities: [] }).success).toBe(true);
    expect(
      prioritiesSchema.safeParse({ priorities: ['FOOD', 'PARTY', 'DESIGN'] }).success,
    ).toBe(true);
    expect(
      prioritiesSchema.safeParse({
        priorities: ['FOOD', 'PARTY', 'DESIGN', 'FASHION'],
      }).success,
    ).toBe(false);
  });

  it('rejects duplicate priorities', () => {
    expect(
      prioritiesSchema.safeParse({ priorities: ['FOOD', 'FOOD'] }).success,
    ).toBe(false);
  });

  it('rejects a negative guest count and budget', () => {
    expect(sizeBudgetSchema.safeParse({ guestCount: -1 }).success).toBe(false);
    expect(sizeBudgetSchema.safeParse({ budgetTotal: -5 }).success).toBe(false);
    expect(
      sizeBudgetSchema.safeParse({ guestCount: 300, budgetTotal: 180000 }).success,
    ).toBe(true);
  });

  it('exposes six ordered onboarding steps', () => {
    expect(ONBOARDING_STEPS.map((s) => s.id)).toEqual([
      'names', 'date', 'sizeBudget', 'style', 'priorities', 'done',
    ]);
  });

  it('full schema accepts a completely empty profile except names', () => {
    expect(fullProfileSchema.safeParse({ partner1Name: 'Maya' }).success).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- lib/wedding/profile-fields.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement `lib/wedding/profile-fields.ts`**

```ts
import { z } from 'zod';
import { VenueSetting, CeremonyType, Priority } from '@prisma/client';

// --- Field metadata (drives rendering: labels, steps, input types) ---
export type FieldType = 'text' | 'date' | 'number' | 'enum' | 'orderedMulti';

export interface ProfileFieldDef {
  key: string;               // matches a Wedding column
  step: OnboardingStepId;
  type: FieldType;
  labelKey: string;          // i18n key under WeddingProfile
  required?: boolean;
  options?: readonly string[]; // enum / orderedMulti values
  maxSelections?: number;      // orderedMulti
}

export type OnboardingStepId =
  | 'names' | 'date' | 'sizeBudget' | 'style' | 'priorities' | 'done';

export const PRIORITY_OPTIONS = [
  'FOOD', 'PARTY', 'PHOTOGRAPHY', 'GUEST_EXPERIENCE', 'DESIGN', 'FASHION',
] as const satisfies readonly Priority[];

export const VENUE_OPTIONS = ['INDOOR', 'OUTDOOR', 'MIXED'] as const satisfies readonly VenueSetting[];
export const CEREMONY_OPTIONS = ['RELIGIOUS', 'CIVIL', 'MIXED'] as const satisfies readonly CeremonyType[];

export const PROFILE_FIELDS: ProfileFieldDef[] = [
  { key: 'partner1Name', step: 'names', type: 'text', labelKey: 'partner1Name', required: true },
  { key: 'partner2Name', step: 'names', type: 'text', labelKey: 'partner2Name' },
  { key: 'weddingDate', step: 'date', type: 'date', labelKey: 'weddingDate' },
  { key: 'guestCount', step: 'sizeBudget', type: 'number', labelKey: 'guestCount' },
  { key: 'budgetTotal', step: 'sizeBudget', type: 'number', labelKey: 'budgetTotal' },
  { key: 'city', step: 'style', type: 'text', labelKey: 'city' },
  { key: 'venueSetting', step: 'style', type: 'enum', labelKey: 'venueSetting', options: VENUE_OPTIONS },
  { key: 'ceremonyType', step: 'style', type: 'enum', labelKey: 'ceremonyType', options: CEREMONY_OPTIONS },
  { key: 'priorities', step: 'priorities', type: 'orderedMulti', labelKey: 'priorities', options: PRIORITY_OPTIONS, maxSelections: 3 },
];

export const ONBOARDING_STEPS: { id: OnboardingStepId; titleKey: string }[] = [
  { id: 'names', titleKey: 'stepNames' },
  { id: 'date', titleKey: 'stepDate' },
  { id: 'sizeBudget', titleKey: 'stepSizeBudget' },
  { id: 'style', titleKey: 'stepStyle' },
  { id: 'priorities', titleKey: 'stepPriorities' },
  { id: 'done', titleKey: 'stepDone' },
];

// --- Validation schemas (co-located with metadata: single source of truth) ---
const optionalName = z.string().trim().min(1).max(80).optional();

export const namesSchema = z.object({
  partner1Name: z.string().trim().min(1, 'required').max(80),
  partner2Name: optionalName,
});

export const dateSchema = z.object({
  weddingDate: z.coerce.date().optional(),
  dateIsApproximate: z.boolean().optional(),
});

export const sizeBudgetSchema = z.object({
  guestCount: z.number().int().min(0).max(100000).optional(),
  budgetTotal: z.number().int().min(0).max(1000000000).optional(),
});

export const styleSchema = z.object({
  city: z.string().trim().max(120).optional(),
  venueSetting: z.nativeEnum(VenueSetting).optional(),
  ceremonyType: z.nativeEnum(CeremonyType).optional(),
});

export const prioritiesSchema = z.object({
  priorities: z
    .array(z.nativeEnum(Priority))
    .max(3)
    .refine((arr) => new Set(arr).size === arr.length, 'no duplicates')
    .optional()
    .default([]),
});

export const fullProfileSchema = namesSchema
  .merge(dateSchema)
  .merge(sizeBudgetSchema)
  .merge(styleSchema)
  .merge(prioritiesSchema);

export type WeddingProfileInput = z.infer<typeof fullProfileSchema>;
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- lib/wedding/profile-fields.test.ts` → PASS (6 tests). `npm run typecheck` clean.

- [ ] **Step 5: Commit**
```bash
git add lib/wedding/profile-fields.ts lib/wedding/profile-fields.test.ts
git commit -m "feat: add wedding profile field definitions and Zod schemas"
```

---

## Task 3: Server actions (persist + complete + edit), ownership-scoped

**Files:**
- Create: `lib/actions/onboarding.ts`, `lib/actions/onboarding.test.ts`

**Interfaces:**
- Consumes: `auth` from `@/lib/auth`, `getCurrentWedding`, the step schemas + `fullProfileSchema`, `prisma`.
- Produces (all resolve the wedding via DB by session user id, create+link one if missing):
  - `saveNames(input): Promise<ActionResult>` — creates the wedding + links user if none, sets names.
  - `saveStep(step, input): Promise<ActionResult>` — validates against that step's schema, updates the caller's wedding.
  - `completeOnboarding(): Promise<ActionResult>` — stamps `onboardingCompletedAt`.
  - `updateWeddingProfile(input): Promise<ActionResult>` — validates `fullProfileSchema`, updates all fields (edit page).
  - `type ActionResult = { ok: true } | { ok: false; error: 'UNAUTHENTICATED' | 'INVALID' }`.

> **Version check:** confirm `await auth()` returns `session?.user?.id` under `next-auth@5.0.0-beta.31` (it does per Phase 1's `types/next-auth.d.ts`); confirm Server Action signatures for Next 16.

- [ ] **Step 1: Write the failing test — `lib/actions/onboarding.test.ts`**

Mock `auth` to control the session user.
```ts
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { prisma } from '@/lib/db';

let currentUserId: string | null = null;
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(async () => (currentUserId ? { user: { id: currentUserId } } : null)),
}));

import { saveNames, saveStep, completeOnboarding, updateWeddingProfile } from './onboarding';

async function makeUser(email: string) {
  const u = await prisma.user.create({ data: { email } });
  return u.id;
}

afterEach(async () => {
  await prisma.user.deleteMany();
  await prisma.wedding.deleteMany();
  currentUserId = null;
});

describe('onboarding actions', () => {
  it('saveNames creates and links a wedding for a user with none', async () => {
    currentUserId = await makeUser('a@example.com');
    const res = await saveNames({ partner1Name: 'Maya', partner2Name: 'Asaf' });
    expect(res).toEqual({ ok: true });
    const u = await prisma.user.findUnique({ where: { id: currentUserId! }, include: { wedding: true } });
    expect(u?.wedding?.partner1Name).toBe('Maya');
    expect(u?.wedding?.partner2Name).toBe('Asaf');
  });

  it('rejects unauthenticated callers', async () => {
    currentUserId = null;
    expect(await saveNames({ partner1Name: 'X' })).toEqual({ ok: false, error: 'UNAUTHENTICATED' });
  });

  it('rejects invalid input', async () => {
    currentUserId = await makeUser('b@example.com');
    expect(await saveNames({ partner1Name: '' })).toEqual({ ok: false, error: 'INVALID' });
  });

  it('saveStep updates the caller\'s own wedding only', async () => {
    currentUserId = await makeUser('c@example.com');
    await saveNames({ partner1Name: 'Maya' });
    const res = await saveStep('sizeBudget', { guestCount: 300, budgetTotal: 180000 });
    expect(res).toEqual({ ok: true });
    const u = await prisma.user.findUnique({ where: { id: currentUserId! }, include: { wedding: true } });
    expect(u?.wedding?.guestCount).toBe(300);
    expect(u?.wedding?.budgetTotal).toBe(180000);
  });

  it('completeOnboarding stamps onboardingCompletedAt', async () => {
    currentUserId = await makeUser('d@example.com');
    await saveNames({ partner1Name: 'Maya' });
    expect(await completeOnboarding()).toEqual({ ok: true });
    const u = await prisma.user.findUnique({ where: { id: currentUserId! }, include: { wedding: true } });
    expect(u?.wedding?.onboardingCompletedAt).toBeInstanceOf(Date);
  });

  it('updateWeddingProfile validates and saves all fields', async () => {
    currentUserId = await makeUser('e@example.com');
    await saveNames({ partner1Name: 'Maya' });
    const res = await updateWeddingProfile({ partner1Name: 'Maya', priorities: ['FOOD', 'PARTY'], city: 'Tel Aviv' });
    expect(res).toEqual({ ok: true });
    const u = await prisma.user.findUnique({ where: { id: currentUserId! }, include: { wedding: true } });
    expect(u?.wedding?.city).toBe('Tel Aviv');
    expect(u?.wedding?.priorities).toEqual(['FOOD', 'PARTY']);
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `npm test -- lib/actions/onboarding.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement `lib/actions/onboarding.ts`**

```ts
'use server';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getCurrentWedding } from '@/lib/wedding/queries';
import {
  namesSchema, dateSchema, sizeBudgetSchema, styleSchema, prioritiesSchema,
  fullProfileSchema, type OnboardingStepId,
} from '@/lib/wedding/profile-fields';
import type { z } from 'zod';

export type ActionResult =
  | { ok: true }
  | { ok: false; error: 'UNAUTHENTICATED' | 'INVALID' };

async function requireUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

/** Get the caller's wedding id, creating+linking a wedding if they have none. */
async function ensureWeddingId(userId: string): Promise<string> {
  const existing = await getCurrentWedding(userId);
  if (existing) return existing.id;
  const wedding = await prisma.wedding.create({ data: {} });
  await prisma.user.update({ where: { id: userId }, data: { weddingId: wedding.id } });
  return wedding.id;
}

export async function saveNames(input: unknown): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: 'UNAUTHENTICATED' };
  const parsed = namesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'INVALID' };
  const weddingId = await ensureWeddingId(userId);
  await prisma.wedding.update({ where: { id: weddingId }, data: parsed.data });
  return { ok: true };
}

const STEP_SCHEMAS: Record<Exclude<OnboardingStepId, 'names' | 'done'>, z.ZodTypeAny> = {
  date: dateSchema,
  sizeBudget: sizeBudgetSchema,
  style: styleSchema,
  priorities: prioritiesSchema,
};

export async function saveStep(step: keyof typeof STEP_SCHEMAS, input: unknown): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: 'UNAUTHENTICATED' };
  const schema = STEP_SCHEMAS[step];
  if (!schema) return { ok: false, error: 'INVALID' };
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'INVALID' };
  const weddingId = await ensureWeddingId(userId);
  await prisma.wedding.update({ where: { id: weddingId }, data: parsed.data });
  return { ok: true };
}

export async function completeOnboarding(): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: 'UNAUTHENTICATED' };
  const weddingId = await ensureWeddingId(userId);
  await prisma.wedding.update({ where: { id: weddingId }, data: { onboardingCompletedAt: new Date() } });
  return { ok: true };
}

export async function updateWeddingProfile(input: unknown): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: 'UNAUTHENTICATED' };
  const parsed = fullProfileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'INVALID' };
  const weddingId = await ensureWeddingId(userId);
  await prisma.wedding.update({ where: { id: weddingId }, data: parsed.data });
  return { ok: true };
}
```

- [ ] **Step 4: Run to verify it passes** — `npm test -- lib/actions/onboarding.test.ts` → PASS (6 tests). `npm run typecheck` clean.

- [ ] **Step 5: Commit**
```bash
git add lib/actions/onboarding.ts lib/actions/onboarding.test.ts
git commit -m "feat: add ownership-scoped onboarding/profile server actions"
```

---

## Task 4: Routing — onboarding gate + login-gate the new routes

**Files:**
- Modify: `lib/auth/authorize.ts` (add `/onboarding`, `/settings` to `APP_PREFIXES`)
- Modify: `lib/auth/authorize.test.ts` (assert the new prefixes are login-gated)
- Create: `app/[locale]/(app)/layout.tsx` (onboarding gate)

**Interfaces:**
- Consumes: `auth`, `getCurrentWedding`, next-intl `redirect` (`@/lib/i18n/navigation`).
- Produces: `(app)` layout that redirects to `/onboarding` when the caller has no completed wedding.

- [ ] **Step 1: Add the new prefixes and a test in `lib/auth/authorize.test.ts`**

Add to the existing describe block:
```ts
  it('login-gates the onboarding route', () => {
    expect(authorizeRoute({ pathname: '/onboarding', isLoggedIn: false, role: null }))
      .toEqual({ type: 'redirect', to: '/login' });
    expect(authorizeRoute({ pathname: '/onboarding', isLoggedIn: true, role: 'USER' }))
      .toEqual({ type: 'next' });
  });

  it('login-gates the settings route (incl. /en prefix)', () => {
    expect(authorizeRoute({ pathname: '/en/settings/wedding', isLoggedIn: false, role: null }))
      .toEqual({ type: 'redirect', to: '/en/login' });
  });
```

- [ ] **Step 2: Run to verify it fails** — `npm test -- lib/auth/authorize.test.ts` → the two new tests FAIL.

- [ ] **Step 3: Update `APP_PREFIXES` in `lib/auth/authorize.ts`**
```ts
const APP_PREFIXES = ['/dashboard', '/onboarding', '/settings'];
```

- [ ] **Step 4: Run to verify it passes** — `npm test -- lib/auth/authorize.test.ts` → all PASS.

- [ ] **Step 5: Create `app/[locale]/(app)/layout.tsx` (onboarding gate)**

```tsx
import { auth } from '@/lib/auth';
import { getCurrentWedding } from '@/lib/wedding/queries';
import { redirect } from '@/lib/i18n/navigation';
import { setRequestLocale } from 'next-intl/server';

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  // proxy.ts already guarantees a session on (app) routes; this is defense-in-depth.
  if (!session?.user?.id) redirect({ href: '/login', locale });

  const wedding = await getCurrentWedding(session!.user.id);
  if (!wedding?.onboardingCompletedAt) {
    redirect({ href: '/onboarding', locale });
  }

  return <>{children}</>;
}
```

> Note: `/onboarding` and `/settings` are NOT under `(app)`, so this gate does not apply to them (no loop). Only `(app)/dashboard` (and future app pages) are onboarding-gated.

- [ ] **Step 6: Verify build + typecheck**

Run: `npm run typecheck` and `npm run build` → both succeed.

- [ ] **Step 7: Manual smoke** — `npm run dev`; as a logged-out user, `/onboarding` → `/login`. (Full gated flow is exercised in Task 7 e2e once the wizard exists.) Stop the server.

- [ ] **Step 8: Commit**
```bash
git add lib/auth/authorize.ts lib/auth/authorize.test.ts "app/[locale]/(app)/layout.tsx"
git commit -m "feat: add onboarding gate in (app) layout and login-gate onboarding/settings"
```

---

## Task 5: Onboarding wizard UI + messages

Build the client wizard, its step components, the server page (resume/redirect), and all Hebrew+English copy. Follow the visual direction (centered, old-money, logical properties) and the no-hard-coded-strings rule.

**Files:**
- Create: `app/[locale]/onboarding/page.tsx` (server), `onboarding-wizard.tsx` (client shell), `steps/names-step.tsx`, `steps/date-step.tsx`, `steps/size-budget-step.tsx`, `steps/style-step.tsx`, `steps/priorities-step.tsx`, `steps/done-step.tsx`
- Modify: `messages/he.json`, `messages/en.json` (add `Onboarding` + `WeddingProfile` namespaces incl. enum-option labels)
- Create: `app/[locale]/onboarding/onboarding-wizard.test.tsx` (component test)

**Interfaces:**
- Consumes: `ONBOARDING_STEPS`, `PROFILE_FIELDS`, option constants + step schemas from `profile-fields`; server actions `saveNames`, `saveStep`, `completeOnboarding`; locale-aware `useRouter` from `@/lib/i18n/navigation`; `useTranslations`.
- Produces: the `/onboarding` experience.

**Detailed requirements (opus implementer — build to these, verify against the spec's acceptance criteria):**

- [ ] **Step 1: Server page `app/[locale]/onboarding/page.tsx`**
  - `setRequestLocale(locale)`. Load session (`auth()`) + `getCurrentWedding(userId)`.
  - If `wedding?.onboardingCompletedAt` is set → `redirect({ href: '/dashboard', locale })` (already onboarded).
  - Otherwise render `<OnboardingWizard initial={serializable wedding fields} defaultPartner1={session.user.name ?? ''} />` — pass the existing wedding values so the wizard **resumes** with prior answers (acceptance criterion 4). Serialize `weddingDate` to ISO string or null for the client.

- [ ] **Step 2: Client shell `onboarding-wizard.tsx`** (`'use client'`)
  - Holds `stepIndex` state over `ONBOARDING_STEPS`. Renders a slim progress indicator (e.g. "Step 2 of 5" via `t`, or dots) and the current step component, centered: outer `flex min-h-[...] flex-col items-center justify-center`, inner card `w-full max-w-md bg-surface rounded-card ...`, `text-center`.
  - Each non-final step calls its save action on "Continue" (persist incrementally → resumable) and advances; optional steps also render a "Skip for now" that advances WITHOUT requiring input. Names step (required) blocks advance until valid.
  - The final `done` step calls `completeOnboarding()` then `router.push('/dashboard')` (locale-aware).
  - On an action returning `{ ok: false, error: 'INVALID' }`, show the field/step error via `t('Onboarding.invalid')`; on `'UNAUTHENTICATED'`, `router.push('/login')`.
  - All visible text via `useTranslations('Onboarding')` / `WeddingProfile` (labels). NO raw string literals.

- [ ] **Step 3: Step components** (each `'use client'`, presentational + calls back to the shell)
  - `names-step`: `partner1Name` (required, prefilled `defaultPartner1`), `partner2Name`. Client-validate with `namesSchema` for instant feedback.
  - `date-step`: date input + a "We don't know yet" toggle (clears date) + an "approximate" checkbox (`dateIsApproximate`).
  - `size-budget-step`: numeric `guestCount`, `budgetTotal` (₪); coerce empty → undefined.
  - `style-step`: `city` text; `venueSetting` and `ceremonyType` as segmented option buttons from `VENUE_OPTIONS`/`CEREMONY_OPTIONS`, labels via message keys `WeddingProfile.venue.<VALUE>` / `.ceremony.<VALUE>`.
  - `priorities-step`: the six `PRIORITY_OPTIONS` as selectable chips; selecting assigns the next rank (1/2/3), max 3, tap-again deselects and reorders; labels `WeddingProfile.priority.<VALUE>`. Enforce ≤3 + no dupes (mirrors `prioritiesSchema`).
  - `done-step`: warm summary + primary "Enter your dashboard" button.
  - Inputs: use logical properties; inputs may set `dir="rtl"` for Hebrew text where appropriate but the layout stays centered.

- [ ] **Step 4: Messages** — add to BOTH `messages/he.json` and `messages/en.json`:
  - `Onboarding`: `progress` ("Step {current} of {total}"), `continue`, `skip`, `back`, `invalid`, `finish` ("Enter your dashboard"), step titles (`stepNames`… mapping to `ONBOARDING_STEPS[].titleKey`), and warm per-step subtitles.
  - `WeddingProfile`: `partner1Name`, `partner2Name`, `weddingDate`, `dontKnowYet`, `approximate`, `guestCount`, `budgetTotal`, `city`, `venueSetting`, `ceremonyType`, `priorities`, plus nested option labels `venue.{INDOOR,OUTDOOR,MIXED}`, `ceremony.{RELIGIOUS,CIVIL,MIXED}`, `priority.{FOOD,PARTY,PHOTOGRAPHY,GUEST_EXPERIENCE,DESIGN,FASHION}`.
  - Hebrew values must be genuine, natural Hebrew (e.g. `partner1Name` → "שם בן/בת הזוג"). English natural.

- [ ] **Step 5: Component test `onboarding-wizard.test.tsx`**
  - Mock the server actions (`vi.mock('@/lib/actions/onboarding', ...)`) and next-intl (render with `NextIntlClientProvider` + a minimal messages object, or mock `useTranslations` to echo keys).
  - Assert: the names step blocks "Continue" when `partner1Name` is empty; entering a name + Continue calls `saveNames` and advances; a "Skip" on the date step advances without calling save with input.

- [ ] **Step 6: Verify** — `npm test` (full suite green), `npm run lint` (no hard-coded strings — must pass `--max-warnings 0`), `npm run typecheck`, `npm run build`. Manually run the wizard in he and en, confirming centered old-money layout and that skips/resume work.

- [ ] **Step 7: Commit**
```bash
git add "app/[locale]/onboarding" messages/
git commit -m "feat: add localized onboarding wizard (centered, old-money) wired to profile actions"
```

---

## Task 6: Edit profile page (`/settings/wedding`)

**Files:**
- Create: `app/[locale]/settings/wedding/page.tsx` (server), `edit-wedding-form.tsx` (client)
- Modify: `messages/he.json`, `messages/en.json` (add `WeddingSettings` keys: title, save, saved)
- Create: `app/[locale]/settings/wedding/edit-wedding-form.test.tsx`

**Interfaces:**
- Consumes: `getCurrentWedding`, `updateWeddingProfile`, `PROFILE_FIELDS` + option constants + `fullProfileSchema`, `useTranslations`.

- [ ] **Step 1: Server page** — `setRequestLocale`; load session + `getCurrentWedding`; if no wedding, `redirect` to `/onboarding`; else render `<EditWeddingForm initial={serializable wedding} />`.
- [ ] **Step 2: Client form** — one page grouping all fields (reuse the same input widgets/logic as the wizard steps where reasonable; do NOT duplicate the option constants — import them). On submit, client-validate with `fullProfileSchema`, call `updateWeddingProfile`, show `t('WeddingSettings.saved')` on `{ ok: true }`, error on failure. Logical properties; localized; centered/comfortable layout (this page can be a standard settings layout, not necessarily the full old-money wizard treatment, but on-brand with tokens).
- [ ] **Step 3: Messages** — add `WeddingSettings` (`title`, `save`, `saved`, `error`) to both files (reuse `WeddingProfile.*` labels/options).
- [ ] **Step 4: Component test** — mock the action + i18n; assert editing a field and submitting calls `updateWeddingProfile` with the changed value; an invalid value (e.g. empty `partner1Name`) blocks submit / shows an error.
- [ ] **Step 5: Verify** — `npm test`, `npm run lint`, `npm run typecheck`, `npm run build` all green.
- [ ] **Step 6: Commit**
```bash
git add "app/[locale]/settings" messages/
git commit -m "feat: add wedding profile edit page rendered from field definitions"
```

---

## Task 7: End-to-end flows + acceptance verification

**Files:**
- Create: `e2e/onboarding.spec.ts`

**Interfaces:** consumes the running app (Playwright webServer, Docker Postgres on 5433).

- [ ] **Step 1: Write `e2e/onboarding.spec.ts`**

Helper: register a fresh unique user through the UI (`/register`) so each test has an isolated account (the register form auto-signs-in per Phase 1). Then:
```ts
import { test, expect } from '@playwright/test';

function uniqueEmail() {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

async function registerAndLogin(page, email) {
  await page.goto('/register');
  await page.getByLabel(/name|שם/i).first().fill('Maya');
  await page.getByLabel(/email|אימייל/i).fill(email);
  await page.getByLabel(/password|סיסמה/i).fill('pw12345678');
  await page.getByRole('button', { name: /create account|.*חשבון/i }).click();
}

test('a new couple is routed into onboarding and can skip to a personalized dashboard', async ({ page }) => {
  await registerAndLogin(page, uniqueEmail());
  await expect(page).toHaveURL(/\/onboarding/);           // criterion 1
  // Step 1 names required:
  await page.getByLabel(/partner|בן\/בת/i).first().fill('Maya');
  await page.getByRole('button', { name: /continue|המשך/i }).click();
  // Skip the remaining optional steps:
  for (let i = 0; i < 4; i++) {
    const skip = page.getByRole('button', { name: /skip|דלג/i });
    if (await skip.isVisible().catch(() => false)) await skip.click();
    else break;
  }
  await page.getByRole('button', { name: /dashboard|לוח|enter/i }).click();
  await expect(page).toHaveURL(/\/dashboard/);             // criterion 3
});

test('an onboarded couple hitting /onboarding is sent to the dashboard', async ({ page }) => {
  const email = uniqueEmail();
  await registerAndLogin(page, email);
  // complete onboarding minimally
  await page.getByLabel(/partner|בן\/בת/i).first().fill('Maya');
  await page.getByRole('button', { name: /continue|המשך/i }).click();
  for (let i = 0; i < 4; i++) {
    const skip = page.getByRole('button', { name: /skip|דלג/i });
    if (await skip.isVisible().catch(() => false)) await skip.click(); else break;
  }
  await page.getByRole('button', { name: /dashboard|לוח|enter/i }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto('/onboarding');
  await expect(page).toHaveURL(/\/dashboard/);             // criterion 5
});
```
(Selectors are resilient he/en regexes; the implementer may adjust to match the exact labels/roles produced in Tasks 5–6 — the assertions on URLs are the contract.)

- [ ] **Step 2: Run** — `npm run test:e2e` (Docker PG up, port 3000 free) → all pass. Adjust selectors to the real DOM if needed (do not weaken the URL assertions).

- [ ] **Step 3: Full gate** — `npm run lint && npm run typecheck && npm test` all green; e2e green.

- [ ] **Step 4: Acceptance-criteria pass** — walk the spec's 12 criteria; confirm each is satisfied by a test or manual check. Note any gaps for follow-up.

- [ ] **Step 5: Commit**
```bash
git add e2e/onboarding.spec.ts
git commit -m "test: add onboarding e2e flows and verify acceptance criteria"
```

---

## Self-Review

**Spec coverage:** data model → T1; field defs/validation + priorities/top-3 → T2; ownership-scoped persistence + complete + edit → T3; onboarding gate + route login-gating → T4; wizard UX (centered/old-money/skippable/resumable) + i18n → T5; edit-later → T6; e2e + acceptance criteria → T7. All 12 acceptance criteria map to T3/T4/T5/T6/T7. Language-field drop and partner-invite deferral are honored (no tasks add them).

**Placeholder scan:** logic tasks (T1–T4) carry complete code; UI tasks (T5–T6) are spec'd structurally with exact interfaces, field lists, message-key lists, and design rules for an opus implementer, plus concrete tests — no "TBD"/"add validation" hand-waving. Version-sensitive spots (auth session shape, Server Actions) carry explicit verify notes.

**Type consistency:** `ActionResult`, `saveNames`/`saveStep`/`completeOnboarding`/`updateWeddingProfile`, the step-schema names, `getCurrentWedding`, and the enum/option constants are consistent across tasks. `saveStep` accepts the four non-names/-done step ids; the wizard calls the matching action per step.
