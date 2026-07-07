# Phase 6 — Vendor Database Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Vendor Database — a two-tier directory (admin-curated **global** vendors + **couple-private** vendors) with rule-based recommendations, a `VendorQuote` shortlist/quote record per couple↔vendor, and a quote→budget bridge that books a vendor's amount into the Phase 5 budget through a linked checklist task.

**Architecture:** One `Vendor` table with a nullable `weddingId` (null = global/admin, set = couple-private); `VendorImage` (URL-ref portfolio, Phase 4 shape); `VendorQuote` (couple-owned, unique per vendor, status lifecycle + optional `taskId`). Pure `lib/vendors/` (`recommend`, `schema`, `queries`, `title`); couple actions `lib/actions/vendors.ts` (the quote→budget push reuses Phase 5's `setTaskEstimatedCost`/`setTaskStatus`); admin actions `lib/actions/admin-vendors.ts` (live-DB gated). Couple UI `app/[locale]/(app)/vendors/`, admin CMS `app/[locale]/admin/vendors/`, plus a per-idea vendor surface on the Phase 4 concept detail.

**Tech Stack:** Next.js 16 (App Router, RSC + server actions), Prisma 6.19.3 + Postgres, next-intl (he default/RTL + en), Zod, Vitest (+ @testing-library/react), Playwright, Tailwind v4 design tokens.

## Global Constraints

- **Prisma pinned to 6.19.3** — do not upgrade; migrations via `npm run db:migrate` (Docker Postgres host port **5433**, `DATABASE_URL` from `.env`). Run `npm run db:generate` after schema changes; restart any stale `next dev` before e2e (the recurring Prisma-client lesson).
- **Two-tier ownership** — `Vendor.weddingId` null = global (admin-curated, discoverable, images/`verified`/`isPremium`); set = couple-private (that wedding only, not discoverable, never in recommendations). Admin actions operate ONLY on `weddingId: null`; couple private-vendor actions operate ONLY on their own `weddingId`.
- **No parallel money track** — the quote→budget push writes into the linked `Task` via the existing Phase 5 actions (`setTaskEstimatedCost` when not paid; `setTaskStatus(taskId, true, amount)` when paid). The task stays the single budget source of truth.
- **Whole-shekel INTEGERS** for all money (`priceMin`/`priceMax`/`VendorQuote.amount`); non-negative, validated at the boundary by Zod; `null` clears.
- **Neutral matching language** — the couple-facing matches section is "For your wedding" / "in your area" / "fits your budget", NEVER the word "recommended" in UI copy. The `verified` trust badge shows only for admin-vetted vendors. A disclaimer banner appears on the directory. (Internal function names like `recommendVendors` are fine — this rule is about user-facing copy.)
- **No hard-coded UI strings** — all chrome via `messages/he.json` + `messages/en.json` with IDENTICAL key sets (ESLint fails otherwise). Reuse the existing `TaskCategory` namespace for category labels.
- **RTL-safe** — logical Tailwind properties (`ps-`/`pe-`/`ms-`/`me-`/`text-start`), never `pl-`/`pr-`/`text-left`; number/contact inputs `dir="ltr"`.
- **Ownership scoping** — couple actions resolve `weddingId` from the DB via `getCurrentWedding(userId)` (never a client/JWT id). Admin mutations re-check live `User.role === ADMIN`.
- **Reuse existing enums** — `Vendor.category` uses `TaskCategory`. Only the new `VendorQuoteStatus` enum is added.
- **Live-DB admin gate on the page loader** — the admin vendors page uses a fresh `prisma.user.findUnique` role read (the Phase 5 budget-templates pattern), NOT the stale-JWT claim.
- **Lint/type gate** — `npm run lint` (`--max-warnings 0`) and `npm run typecheck` must stay green.
- **Design tokens** — `bg-surface`, `text-text`, `text-muted`, `bg-primary`, `text-background`, `rounded-card`, `font-display`, `font-body`. Match the "old-money" look.

## File Structure

**Create:**
- `lib/vendors/title.ts` — `resolveVendorTitle()` (delegates to the Phase 3 resolver).
- `lib/vendors/recommend.ts` + `.test.ts` — `recommendVendors()` + types.
- `lib/vendors/schema.ts` + `.test.ts` — Zod: `vendorSchema`, `privateVendorSchema`, `vendorImageSchema`, `quoteInput`, `VENDOR_STATUS_OPTIONS`.
- `lib/vendors/queries.ts` + `.test.ts` — `getDirectoryVendors`, `getVendorDetail`, `getRecommendedVendors`, `getWeddingQuotes`, `vendorBudgetFit`.
- `lib/actions/vendors.ts` + `.test.ts` — couple actions.
- `lib/actions/admin-vendors.ts` + `.test.ts` — admin actions.
- `app/[locale]/(app)/vendors/page.tsx` — directory (RSC).
- `app/[locale]/(app)/vendors/vendors-directory.tsx` — client filters + grid.
- `app/[locale]/(app)/vendors/vendor-card.tsx` — card + shortlist toggle (client).
- `app/[locale]/(app)/vendors/add-private-vendor.tsx` — private-vendor form (client).
- `app/[locale]/(app)/vendors/[vendorId]/page.tsx` — detail (RSC).
- `app/[locale]/(app)/vendors/[vendorId]/vendor-detail.tsx` — detail + quote panel (client).
- `app/[locale]/(app)/vendors/vendors-view.test.tsx` — component tests.
- `app/[locale]/admin/vendors/page.tsx` — admin list (RSC, live-DB gate).
- `app/[locale]/admin/vendors/vendors-admin.tsx` — client list + vendor form + nested image editor.
- `app/[locale]/admin/vendors/vendors-admin.test.tsx` — component test.

**Modify:**
- `prisma/schema.prisma` — add `VendorQuoteStatus` + `Vendor` + `VendorImage` + `VendorQuote`; `Wedding.vendors`/`vendorQuotes` back-refs.
- `prisma/seed.ts` — seed a handful of global vendors (idempotent upsert).
- `lib/auth/authorize.ts:7` — add `/vendors` to `APP_PREFIXES`.
- `lib/auth/authorize.test.ts` — assert `/vendors` gated.
- `app/[locale]/(app)/concepts/[conceptId]/page.tsx` — load per-category vendor chips.
- `app/[locale]/(app)/concepts/[conceptId]/concept-detail.tsx` — render a "vendors for this" chip row per idea.
- `app/[locale]/admin/page.tsx` — add a "Vendors" admin nav link.
- `app/[locale]/(app)/dashboard/page.tsx` — light "find your vendors" entry.
- `messages/he.json` + `messages/en.json` — add `Vendors` + `AdminVendors` namespaces; extend `Dashboard`.
- `e2e/vendors.spec.ts` — create.

---

### Task 1: Schema, migration & vendor seed

**Files:**
- Modify: `prisma/schema.prisma`, `prisma/seed.ts`

**Interfaces:**
- Produces: enum `VendorQuoteStatus`; models `Vendor` (nullable `weddingId`), `VendorImage`, `VendorQuote` (`@@unique([weddingId, vendorId])`, nullable `taskId` bare string); `Wedding.vendors`/`vendorQuotes`. Seeded global vendor ids `vendor-*`.

- [ ] **Step 1: Add the enum and models to the schema**

In `prisma/schema.prisma`, add the enum near the other enums:

```prisma
enum VendorQuoteStatus {
  CONSIDERING
  QUOTED
  BOOKED
  DECLINED
}
```

Append the three models:

```prisma
model Vendor {
  id             String       @id @default(cuid())
  weddingId      String?
  wedding        Wedding?     @relation(fields: [weddingId], references: [id], onDelete: Cascade)

  name_en        String
  name_he        String
  titleLocale    TitleLocale  @default(AUTO)
  description_en String?
  description_he String?
  category       TaskCategory
  city           String?
  priceMin       Int?
  priceMax       Int?

  email          String?
  phone          String?
  website        String?

  verified       Boolean      @default(false)
  isPremium      Boolean      @default(false)
  active         Boolean      @default(true)
  sortOrder      Int          @default(0)

  images         VendorImage[]
  quotes         VendorQuote[]

  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  @@index([weddingId])
  @@index([category, city])
}

model VendorImage {
  id        String  @id @default(cuid())
  vendorId  String
  vendor    Vendor  @relation(fields: [vendorId], references: [id], onDelete: Cascade)
  url       String
  alt_en    String?
  alt_he    String?
  sortOrder Int     @default(0)

  @@index([vendorId])
}

model VendorQuote {
  id        String            @id @default(cuid())
  weddingId String
  wedding   Wedding           @relation(fields: [weddingId], references: [id], onDelete: Cascade)
  vendorId  String
  vendor    Vendor            @relation(fields: [vendorId], references: [id], onDelete: Cascade)

  status    VendorQuoteStatus @default(CONSIDERING)
  amount    Int?
  notes     String?
  taskId    String?

  createdAt DateTime          @default(now())
  updatedAt DateTime          @updatedAt

  @@unique([weddingId, vendorId])
  @@index([weddingId])
}
```

In the existing `Wedding` model, add these two back-reference lines (next to `budgetAllocations`):

```prisma
  vendors      Vendor[]
  vendorQuotes VendorQuote[]
```

- [ ] **Step 2: Create and apply the migration**

Run: `npm run db:migrate -- --name add_vendor_database`
Expected: a new folder under `prisma/migrations/` and "Your database is now in sync with your schema."

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS (`Vendor`, `VendorImage`, `VendorQuote`, `VendorQuoteStatus` available from `@prisma/client`).

- [ ] **Step 4: Add the vendor seed data**

In `prisma/seed.ts`, above `async function main()`, add the seed structures (global vendors — `weddingId` omitted = null):

```typescript
type VendorSeed = {
  id: string;
  name_en: string; name_he: string;
  description_en: string; description_he: string;
  category: TaskCategory;
  city: string;
  priceMin: number; priceMax: number;
  email: string; phone: string; website: string;
  verified: boolean; isPremium: boolean; sortOrder: number;
  images: { url: string; alt_en: string; alt_he: string; sortOrder: number }[];
};

const vendors: VendorSeed[] = [
  {
    id: 'vendor-lumiere-photo', name_en: 'Lumière Photography', name_he: 'לומייר צילום',
    description_en: 'Fine-art wedding photography with a timeless, editorial style.',
    description_he: 'צילום חתונות אמנותי בסגנון עריכתי ונצחי.',
    category: 'PHOTOGRAPHY', city: 'Tel Aviv', priceMin: 8000, priceMax: 18000,
    email: 'hello@lumiere.example', phone: '+972500000001', website: 'https://lumiere.example',
    verified: true, isPremium: true, sortOrder: 10,
    images: [{ url: 'https://images.unsplash.com/photo-1519741497674-611481863552', alt_en: 'Wedding couple portrait', alt_he: 'פורטרט של זוג חתונה', sortOrder: 0 }],
  },
  {
    id: 'vendor-groove-dj', name_en: 'Groove DJ Collective', name_he: 'גרוב תקליטנים',
    description_en: 'High-energy DJs for the main set and a late-night after-party.',
    description_he: 'תקליטנים אנרגטיים לסט המרכזי ולאפטר של אחרי חצות.',
    category: 'MUSIC', city: 'Tel Aviv', priceMin: 5000, priceMax: 12000,
    email: 'book@groove.example', phone: '+972500000002', website: 'https://groove.example',
    verified: true, isPremium: false, sortOrder: 20,
    images: [{ url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819', alt_en: 'DJ at a wedding party', alt_he: 'תקליטן במסיבת חתונה', sortOrder: 0 }],
  },
  {
    id: 'vendor-olive-catering', name_en: 'Olive & Thyme Catering', name_he: 'זית ותימין קייטרינג',
    description_en: 'Seasonal Mediterranean menus and grazing tables.',
    description_he: 'תפריטים ים-תיכוniים עונתיים ושולחנות גרייזינג.',
    category: 'CATERING', city: 'Jerusalem', priceMin: 12000, priceMax: 40000,
    email: 'events@olive.example', phone: '+972500000003', website: 'https://olive.example',
    verified: false, isPremium: false, sortOrder: 30,
    images: [{ url: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288', alt_en: 'Catering grazing table', alt_he: 'שולחן גרייזינג', sortOrder: 0 }],
  },
  {
    id: 'vendor-bloom-florals', name_en: 'Bloom Room Florals', name_he: 'חדר הפריחה',
    description_en: 'Lush, garden-style florals and installations.',
    description_he: 'עיצובי פרחים גני עשירים ומיצבים.',
    category: 'FLOWERS', city: 'Haifa', priceMin: 4000, priceMax: 15000,
    email: 'studio@bloom.example', phone: '+972500000004', website: 'https://bloom.example',
    verified: true, isPremium: false, sortOrder: 40,
    images: [{ url: 'https://images.unsplash.com/photo-1519225421980-715cb0215aed', alt_en: 'Floral centerpiece', alt_he: 'מרכז שולחן פרחוני', sortOrder: 0 }],
  },
];
```

Note: import/ensure `TaskCategory` is available in `seed.ts` (the Phase 5 fix imported `TaskCategory` from `@prisma/client`; reuse that import). If it isn't imported yet, add `import { TaskCategory } from '@prisma/client';`.

- [ ] **Step 5: Write the vendor upsert in `main()`**

Inside `main()` in `prisma/seed.ts`, after the budget baseline loop and its `console.log`, add (upsert by stable id; replace child images so a re-seed reflects the file):

```typescript
  for (const v of vendors) {
    const { images, ...fields } = v;
    await prisma.vendor.upsert({
      where: { id: v.id },
      create: { ...fields, titleLocale: 'AUTO', active: true },
      update: { ...fields, titleLocale: 'AUTO', active: true },
    });
    await prisma.vendorImage.deleteMany({ where: { vendorId: v.id } });
    await prisma.vendorImage.createMany({ data: images.map((im) => ({ vendorId: v.id, ...im })) });
  }
  console.log(`Seeded ${vendors.length} vendors.`);
```

- [ ] **Step 6: Run the seed twice (idempotency)**

Run: `npm run db:seed && npm run db:seed`
Expected: both runs print "Seeded 4 vendors." with no unique-constraint errors.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations prisma/seed.ts
git commit -m "feat: add vendor-database schema, migration, and vendor seed"
```

---

### Task 2: Pure vendor domain (recommend, schema, queries, title)

**Files:**
- Create: `lib/vendors/title.ts`; `lib/vendors/recommend.ts` + `.test.ts`; `lib/vendors/schema.ts` + `.test.ts`; `lib/vendors/queries.ts` + `.test.ts`

**Interfaces:**
- Consumes: `resolveTaskTitle` from `@/lib/checklist/title`; `prisma`; `TaskCategory`, `VendorQuoteStatus` from `@prisma/client`.
- Produces:
  - `resolveVendorTitle({ name_en, name_he, titleLocale }, locale): string`
  - `recommendVendors(candidates: RecommendCandidate[], criteria: RecommendCriteria, limit: number): RankedVendor[]` with `RecommendCandidate`, `RecommendCriteria`, `RankedVendor`.
  - Zod: `vendorSchema`, `privateVendorSchema`, `vendorImageSchema`, `quoteInput`; `VENDOR_STATUS_OPTIONS`.
  - `vendorBudgetFit(wedding): { min: number | null; max: number | null } | null`
  - `getDirectoryVendors(weddingId, filters)`, `getVendorDetail(id, weddingId)`, `getRecommendedVendors(wedding, opts)`, `getWeddingQuotes(weddingId)`.

- [ ] **Step 1: Implement the title resolver (no test — thin delegate)**

`lib/vendors/title.ts`:

```typescript
import type { TitleLocale } from '@prisma/client';
import { resolveTaskTitle } from '@/lib/checklist/title';

/** Resolve a vendor's display name for the given locale. */
export function resolveVendorTitle(
  item: { name_en: string; name_he: string; titleLocale: TitleLocale },
  locale: string,
): string {
  return resolveTaskTitle({ title_en: item.name_en, title_he: item.name_he, titleLocale: item.titleLocale }, locale);
}
```

- [ ] **Step 2: Write the recommend test**

`lib/vendors/recommend.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { recommendVendors, type RecommendCandidate } from './recommend';

const v = (over: Partial<RecommendCandidate>): RecommendCandidate => ({
  id: 'x', category: 'PHOTOGRAPHY', city: 'Tel Aviv', priceMin: 5000, priceMax: 10000,
  verified: false, isPremium: false, sortOrder: 0, ...over,
});

describe('recommendVendors', () => {
  it('filters to the requested category', () => {
    const r = recommendVendors(
      [v({ id: 'a', category: 'PHOTOGRAPHY' }), v({ id: 'b', category: 'MUSIC' })],
      { category: 'PHOTOGRAPHY' }, 10,
    );
    expect(r.map((x) => x.id)).toEqual(['a']);
  });

  it('ranks a city match above a non-match', () => {
    const r = recommendVendors(
      [v({ id: 'far', city: 'Eilat' }), v({ id: 'near', city: 'Tel Aviv' })],
      { city: 'Tel Aviv' }, 10,
    );
    expect(r[0].id).toBe('near');
  });

  it('boosts a price-fit overlap', () => {
    const r = recommendVendors(
      [v({ id: 'over', priceMin: 50000, priceMax: 80000 }), v({ id: 'fits', priceMin: 5000, priceMax: 9000 })],
      { budgetFit: { min: 4000, max: 12000 } }, 10,
    );
    expect(r[0].id).toBe('fits');
  });

  it('uses verified then premium then sortOrder as tiebreaks', () => {
    const r = recommendVendors(
      [v({ id: 'plain', sortOrder: 5 }), v({ id: 'verif', verified: true }), v({ id: 'prem', isPremium: true })],
      {}, 10,
    );
    expect(r.map((x) => x.id)).toEqual(['verif', 'prem', 'plain']);
  });

  it('respects the limit and is deterministic', () => {
    const r = recommendVendors([v({ id: 'a' }), v({ id: 'b' }), v({ id: 'c' })], {}, 2);
    expect(r).toHaveLength(2);
    expect(recommendVendors([v({ id: 'a' }), v({ id: 'b' }), v({ id: 'c' })], {}, 2)).toEqual(r);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npm run test -- lib/vendors/recommend.test.ts`
Expected: FAIL ("Cannot find module './recommend'").

- [ ] **Step 4: Implement the recommend engine**

`lib/vendors/recommend.ts`:

```typescript
import type { TaskCategory } from '@prisma/client';

export interface RecommendCandidate {
  id: string;
  category: TaskCategory;
  city: string | null;
  priceMin: number | null;
  priceMax: number | null;
  verified: boolean;
  isPremium: boolean;
  sortOrder: number;
}

export interface RecommendCriteria {
  category?: TaskCategory;
  city?: string | null;
  budgetFit?: { min: number | null; max: number | null } | null;
}

export interface RankedVendor {
  id: string;
  score: number;
}

function rangesOverlap(
  aMin: number | null, aMax: number | null, bMin: number | null, bMax: number | null,
): boolean {
  const a1 = aMin ?? 0;
  const a2 = aMax ?? Number.POSITIVE_INFINITY;
  const b1 = bMin ?? 0;
  const b2 = bMax ?? Number.POSITIVE_INFINITY;
  return a1 <= b2 && a2 >= b1;
}

function scoreVendor(v: RecommendCandidate, c: RecommendCriteria): number {
  let score = 0;
  if (c.city && v.city && v.city.trim().toLowerCase() === c.city.trim().toLowerCase()) score += 100;
  if (c.budgetFit && rangesOverlap(v.priceMin, v.priceMax, c.budgetFit.min, c.budgetFit.max)) score += 50;
  if (v.verified) score += 20;
  if (v.isPremium) score += 10;
  return score;
}

/** Deterministic, explainable ranking: filter by category, score, then sortOrder/id tiebreak. */
export function recommendVendors(
  candidates: RecommendCandidate[],
  criteria: RecommendCriteria,
  limit: number,
): RankedVendor[] {
  const filtered = candidates.filter((v) => criteria.category == null || v.category === criteria.category);
  const scored = filtered.map((v) => ({ v, score: scoreVendor(v, criteria) }));
  scored.sort(
    (a, b) =>
      b.score - a.score ||
      a.v.sortOrder - b.v.sortOrder ||
      (a.v.id < b.v.id ? -1 : a.v.id > b.v.id ? 1 : 0),
  );
  return scored.slice(0, limit).map((x) => ({ id: x.v.id, score: x.score }));
}
```

- [ ] **Step 5: Run it to verify it passes**

Run: `npm run test -- lib/vendors/recommend.test.ts`
Expected: PASS.

- [ ] **Step 6: Write the schema test**

`lib/vendors/schema.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { vendorSchema, privateVendorSchema, vendorImageSchema, quoteInput } from './schema';

describe('vendorSchema', () => {
  const base = { name_en: 'Lumière', name_he: 'לומייר', category: 'PHOTOGRAPHY' };
  it('accepts valid input and defaults flags', () => {
    const r = vendorSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) { expect(r.data.active).toBe(true); expect(r.data.verified).toBe(false); }
  });
  it('rejects an inverted price range', () => {
    expect(vendorSchema.safeParse({ ...base, priceMin: 9000, priceMax: 1000 }).success).toBe(false);
  });
  it('rejects an unknown category and empty name', () => {
    expect(vendorSchema.safeParse({ ...base, category: 'NOPE' }).success).toBe(false);
    expect(vendorSchema.safeParse({ ...base, name_he: '' }).success).toBe(false);
  });
  it('rejects a malformed website but accepts a bare phone', () => {
    expect(vendorSchema.safeParse({ ...base, website: 'not-a-url' }).success).toBe(false);
    expect(vendorSchema.safeParse({ ...base, phone: '+972500000000' }).success).toBe(true);
  });
});

describe('privateVendorSchema', () => {
  it('accepts a lightweight couple vendor', () => {
    expect(privateVendorSchema.safeParse({ name_en: 'Cousin Dan DJ', name_he: 'דן', category: 'MUSIC' }).success).toBe(true);
  });
});

describe('quoteInput', () => {
  it('validates status + non-negative integer amount', () => {
    expect(quoteInput.safeParse({ status: 'BOOKED', amount: 8000 }).success).toBe(true);
    expect(quoteInput.safeParse({ status: 'NOPE' }).success).toBe(false);
    expect(quoteInput.safeParse({ status: 'QUOTED', amount: -5 }).success).toBe(false);
    expect(quoteInput.safeParse({ status: 'QUOTED', amount: 10.5 }).success).toBe(false);
  });
});

describe('vendorImageSchema', () => {
  it('requires a URL', () => {
    expect(vendorImageSchema.safeParse({ url: '' }).success).toBe(false);
    expect(vendorImageSchema.safeParse({ url: 'https://x.test/a.jpg' }).success).toBe(true);
  });
});
```

- [ ] **Step 7: Run it to verify it fails**

Run: `npm run test -- lib/vendors/schema.test.ts`
Expected: FAIL ("Cannot find module './schema'").

- [ ] **Step 8: Implement the schemas**

`lib/vendors/schema.ts`:

```typescript
import { z } from 'zod';
import { TaskCategory, TitleLocale, VendorQuoteStatus } from '@prisma/client';

export const VENDOR_STATUS_OPTIONS = Object.values(VendorQuoteStatus);

const money = z.number().int().min(0).max(100_000_000);
const optionalMoney = money.nullish();

const contact = {
  email: z.string().trim().email().max(200).nullish(),
  phone: z.string().trim().max(40).nullish(),
  website: z.string().trim().url().max(300).nullish(),
};

export const vendorSchema = z
  .object({
    name_en: z.string().trim().min(1).max(160),
    name_he: z.string().trim().min(1).max(160),
    titleLocale: z.nativeEnum(TitleLocale).default(TitleLocale.AUTO),
    description_en: z.string().trim().max(2000).nullish(),
    description_he: z.string().trim().max(2000).nullish(),
    category: z.nativeEnum(TaskCategory),
    city: z.string().trim().max(120).nullish(),
    priceMin: optionalMoney,
    priceMax: optionalMoney,
    ...contact,
    verified: z.boolean().default(false),
    isPremium: z.boolean().default(false),
    active: z.boolean().default(true),
    sortOrder: z.number().int().default(0),
  })
  .refine((v) => v.priceMin == null || v.priceMax == null || v.priceMin <= v.priceMax, {
    message: 'priceMin must be <= priceMax', path: ['priceMax'],
  });

/** Couple-added private vendor: a lighter subset (no images/verified/premium/sortOrder). */
export const privateVendorSchema = z
  .object({
    name_en: z.string().trim().min(1).max(160),
    name_he: z.string().trim().min(1).max(160),
    titleLocale: z.nativeEnum(TitleLocale).default(TitleLocale.AUTO),
    category: z.nativeEnum(TaskCategory),
    city: z.string().trim().max(120).nullish(),
    priceMin: optionalMoney,
    priceMax: optionalMoney,
    ...contact,
    notes: z.string().trim().max(2000).nullish(),
  })
  .refine((v) => v.priceMin == null || v.priceMax == null || v.priceMin <= v.priceMax, {
    message: 'priceMin must be <= priceMax', path: ['priceMax'],
  });

export const vendorImageSchema = z.object({
  url: z.string().trim().url().max(2000),
  alt_en: z.string().trim().max(200).nullish(),
  alt_he: z.string().trim().max(200).nullish(),
  sortOrder: z.number().int().default(0),
});

export const quoteInput = z.object({
  status: z.nativeEnum(VendorQuoteStatus),
  amount: optionalMoney,
  notes: z.string().trim().max(2000).nullish(),
});
```

- [ ] **Step 9: Run it to verify it passes**

Run: `npm run test -- lib/vendors/schema.test.ts`
Expected: PASS.

- [ ] **Step 10: Write the queries test (pure `vendorBudgetFit` only; DB fns exercised in e2e)**

`lib/vendors/queries.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { vendorBudgetFit } from './queries';

describe('vendorBudgetFit', () => {
  it('returns null when there is no budget', () => {
    expect(vendorBudgetFit({ budgetTotal: null })).toBeNull();
  });
  it('maps a budget to an open-topped fit range', () => {
    expect(vendorBudgetFit({ budgetTotal: 150000 })).toEqual({ min: null, max: 150000 });
  });
});
```

- [ ] **Step 11: Run it to verify it fails**

Run: `npm run test -- lib/vendors/queries.test.ts`
Expected: FAIL ("Cannot find module './queries'").

- [ ] **Step 12: Implement the queries**

`lib/vendors/queries.ts`:

```typescript
import { prisma } from '@/lib/db';
import type { Prisma, TaskCategory } from '@prisma/client';
import { recommendVendors, type RecommendCandidate } from './recommend';

/** A couple's budget expressed as a vendor price-fit window (whole budget as the ceiling). */
export function vendorBudgetFit(wedding: { budgetTotal: number | null }): { min: number | null; max: number | null } | null {
  if (wedding.budgetTotal == null) return null;
  return { min: null, max: wedding.budgetTotal };
}

export interface DirectoryFilters {
  category?: TaskCategory;
  city?: string;
  maxPrice?: number;
  premiumOnly?: boolean;
}

/** Global active vendors + this couple's own private vendors, filtered. */
export function getDirectoryVendors(weddingId: string, filters: DirectoryFilters) {
  const where: Prisma.VendorWhereInput = {
    AND: [
      { OR: [{ weddingId: null, active: true }, { weddingId }] },
      filters.category ? { category: filters.category } : {},
      filters.city ? { city: { equals: filters.city, mode: 'insensitive' } } : {},
      filters.maxPrice != null ? { OR: [{ priceMin: null }, { priceMin: { lte: filters.maxPrice } }] } : {},
      filters.premiumOnly ? { isPremium: true } : {},
    ],
  };
  return prisma.vendor.findMany({
    where,
    include: { images: { orderBy: { sortOrder: 'asc' }, take: 1 } },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
}

/** A vendor the caller may see (global, or their own private) + the caller's quote. */
export async function getVendorDetail(id: string, weddingId: string) {
  const vendor = await prisma.vendor.findFirst({
    where: { id, OR: [{ weddingId: null }, { weddingId }] },
    include: { images: { orderBy: { sortOrder: 'asc' } } },
  });
  if (!vendor) return null;
  const quote = await prisma.vendorQuote.findUnique({
    where: { weddingId_vendorId: { weddingId, vendorId: id } },
  });
  return { vendor, quote };
}

/** Rule-based matches from the GLOBAL catalog only (never private vendors). */
export async function getRecommendedVendors(
  wedding: { id: string; city: string | null; budgetTotal: number | null },
  opts: { category?: TaskCategory; limit?: number } = {},
) {
  const candidates = await prisma.vendor.findMany({
    where: { weddingId: null, active: true, ...(opts.category ? { category: opts.category } : {}) },
    include: { images: { orderBy: { sortOrder: 'asc' }, take: 1 } },
  });
  const ranked = recommendVendors(
    candidates.map(
      (v): RecommendCandidate => ({
        id: v.id, category: v.category, city: v.city,
        priceMin: v.priceMin, priceMax: v.priceMax,
        verified: v.verified, isPremium: v.isPremium, sortOrder: v.sortOrder,
      }),
    ),
    { category: opts.category, city: wedding.city, budgetFit: vendorBudgetFit(wedding) },
    opts.limit ?? 6,
  );
  const byId = new Map(candidates.map((v) => [v.id, v]));
  return ranked.map((r) => byId.get(r.id)!).filter(Boolean);
}

export function getWeddingQuotes(weddingId: string) {
  return prisma.vendorQuote.findMany({
    where: { weddingId },
    include: { vendor: { include: { images: { orderBy: { sortOrder: 'asc' }, take: 1 } } } },
    orderBy: { updatedAt: 'desc' },
  });
}
```

- [ ] **Step 13: Run it to verify it passes; run the whole vendors suite**

Run: `npm run test -- lib/vendors`
Expected: all three test files PASS.

- [ ] **Step 14: Typecheck, lint & commit**

Run: `npm run typecheck && npm run lint`
Expected: PASS.

```bash
git add lib/vendors
git commit -m "feat: add vendor domain — recommend engine, Zod schemas, queries"
```

---

### Task 3: Couple vendor actions (+ quote→budget bridge)

**Files:**
- Create: `lib/actions/vendors.ts`, `lib/actions/vendors.test.ts`

**Interfaces:**
- Consumes: `auth`, `prisma`, `getCurrentWedding`; `privateVendorSchema`, `quoteInput` from `@/lib/vendors/schema`; `setTaskEstimatedCost` from `@/lib/actions/budget`; `setTaskStatus` from `@/lib/actions/checklist`.
- Produces:
  - `type VendorActionResult = { ok: true; id?: string } | { ok: false; error: 'UNAUTHENTICATED' | 'INVALID' | 'NOT_FOUND' }`
  - `toggleShortlist(vendorId)`, `setQuoteStatus(vendorId, status)`, `setQuoteAmount(vendorId, amount|null)`, `setQuoteNotes(vendorId, notes|null)`
  - `linkQuoteToTask(vendorId, taskId|null)`, `pushQuoteToBudget(vendorId, { paid: boolean })`
  - `addPrivateVendor(input)`, `editPrivateVendor(vendorId, input)`, `deletePrivateVendor(vendorId)`

- [ ] **Step 1: Write the actions test**

`lib/actions/vendors.test.ts` — mock in the style of `lib/actions/budget.test.ts` (read it first). Mock the reused Phase 5 actions so the push can be asserted without a DB.

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/wedding/queries', () => ({ getCurrentWedding: vi.fn() }));
vi.mock('@/lib/actions/budget', () => ({ setTaskEstimatedCost: vi.fn() }));
vi.mock('@/lib/actions/checklist', () => ({ setTaskStatus: vi.fn() }));
vi.mock('@/lib/db', () => ({
  prisma: {
    vendor: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    vendorQuote: { findUnique: vi.fn(), upsert: vi.fn(), delete: vi.fn(), update: vi.fn() },
    task: { findFirst: vi.fn() },
  },
}));

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getCurrentWedding } from '@/lib/wedding/queries';
import { setTaskEstimatedCost } from '@/lib/actions/budget';
import { setTaskStatus } from '@/lib/actions/checklist';
import {
  toggleShortlist, setQuoteAmount, linkQuoteToTask, pushQuoteToBudget, addPrivateVendor,
} from './vendors';

beforeEach(() => {
  vi.clearAllMocks();
  (auth as unknown as vi.Mock).mockResolvedValue({ user: { id: 'u1' } });
  (getCurrentWedding as unknown as vi.Mock).mockResolvedValue({ id: 'wed1' });
});

describe('toggleShortlist', () => {
  it('creates a CONSIDERING quote for a visible vendor when none exists', async () => {
    (prisma.vendor.findFirst as vi.Mock).mockResolvedValue({ id: 'v1' });
    (prisma.vendorQuote.findUnique as vi.Mock).mockResolvedValue(null);
    expect(await toggleShortlist('v1')).toEqual({ ok: true });
    expect(prisma.vendorQuote.upsert).toHaveBeenCalled();
  });
  it('removes the quote when one exists', async () => {
    (prisma.vendor.findFirst as vi.Mock).mockResolvedValue({ id: 'v1' });
    (prisma.vendorQuote.findUnique as vi.Mock).mockResolvedValue({ id: 'q1' });
    expect(await toggleShortlist('v1')).toEqual({ ok: true });
    expect(prisma.vendorQuote.delete).toHaveBeenCalledWith({ where: { id: 'q1' } });
  });
  it('rejects a vendor the couple cannot see', async () => {
    (prisma.vendor.findFirst as vi.Mock).mockResolvedValue(null);
    expect(await toggleShortlist('vX')).toEqual({ ok: false, error: 'NOT_FOUND' });
  });
});

describe('setQuoteAmount', () => {
  it('rejects a negative amount', async () => {
    expect(await setQuoteAmount('v1', -5)).toEqual({ ok: false, error: 'INVALID' });
  });
});

describe('linkQuoteToTask', () => {
  it('rejects a task the couple does not own', async () => {
    (prisma.task.findFirst as vi.Mock).mockResolvedValue(null);
    expect(await linkQuoteToTask('v1', 'tX')).toEqual({ ok: false, error: 'NOT_FOUND' });
  });
});

describe('pushQuoteToBudget', () => {
  it('writes the estimate (planned) when not paid', async () => {
    (prisma.vendorQuote.findUnique as vi.Mock).mockResolvedValue({ id: 'q1', amount: 8000, taskId: 't1' });
    (setTaskEstimatedCost as vi.Mock).mockResolvedValue({ ok: true });
    expect(await pushQuoteToBudget('v1', { paid: false })).toEqual({ ok: true });
    expect(setTaskEstimatedCost).toHaveBeenCalledWith('t1', 8000);
    expect(setTaskStatus).not.toHaveBeenCalled();
  });
  it('marks the task done with the amount when paid', async () => {
    (prisma.vendorQuote.findUnique as vi.Mock).mockResolvedValue({ id: 'q1', amount: 8000, taskId: 't1' });
    (setTaskStatus as vi.Mock).mockResolvedValue({ ok: true });
    expect(await pushQuoteToBudget('v1', { paid: true })).toEqual({ ok: true });
    expect(setTaskStatus).toHaveBeenCalledWith('t1', true, 8000);
  });
  it('rejects when there is no linked task or no amount', async () => {
    (prisma.vendorQuote.findUnique as vi.Mock).mockResolvedValue({ id: 'q1', amount: null, taskId: 't1' });
    expect(await pushQuoteToBudget('v1', { paid: false })).toEqual({ ok: false, error: 'INVALID' });
    (prisma.vendorQuote.findUnique as vi.Mock).mockResolvedValue({ id: 'q1', amount: 8000, taskId: null });
    expect(await pushQuoteToBudget('v1', { paid: false })).toEqual({ ok: false, error: 'INVALID' });
  });
});

describe('addPrivateVendor', () => {
  it('creates a wedding-scoped vendor + a CONSIDERING quote', async () => {
    (prisma.vendor.create as vi.Mock).mockResolvedValue({ id: 'pv1' });
    const r = await addPrivateVendor({ name_en: 'Cousin Dan', name_he: 'דן', category: 'MUSIC' });
    expect(r).toEqual({ ok: true, id: 'pv1' });
    expect(prisma.vendor.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ weddingId: 'wed1', category: 'MUSIC' }) }),
    );
    expect(prisma.vendorQuote.upsert).toHaveBeenCalled();
  });
  it('rejects invalid input', async () => {
    expect(await addPrivateVendor({ name_en: '', name_he: '', category: 'MUSIC' })).toEqual({ ok: false, error: 'INVALID' });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test -- lib/actions/vendors.test.ts`
Expected: FAIL ("Cannot find module './vendors'").

- [ ] **Step 3: Implement the couple actions**

`lib/actions/vendors.ts`:

```typescript
'use server';

import type { VendorQuoteStatus } from '@prisma/client';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getCurrentWedding } from '@/lib/wedding/queries';
import { privateVendorSchema, quoteInput } from '@/lib/vendors/schema';
import { setTaskEstimatedCost } from '@/lib/actions/budget';
import { setTaskStatus } from '@/lib/actions/checklist';

export type VendorActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: 'UNAUTHENTICATED' | 'INVALID' | 'NOT_FOUND' };

async function resolveWedding(): Promise<
  { ok: true; weddingId: string } | { ok: false; error: 'UNAUTHENTICATED' | 'NOT_FOUND' }
> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: 'UNAUTHENTICATED' };
  const wedding = await getCurrentWedding(session.user.id);
  if (!wedding) return { ok: false, error: 'NOT_FOUND' };
  return { ok: true, weddingId: wedding.id };
}

/** A vendor the caller may act on: global, or their own private one. */
async function visibleVendor(weddingId: string, vendorId: string) {
  return prisma.vendor.findFirst({
    where: { id: vendorId, OR: [{ weddingId: null }, { weddingId }] },
    select: { id: true },
  });
}

export async function toggleShortlist(vendorId: string): Promise<VendorActionResult> {
  const w = await resolveWedding();
  if (!w.ok) return w;
  if (!(await visibleVendor(w.weddingId, vendorId))) return { ok: false, error: 'NOT_FOUND' };
  const existing = await prisma.vendorQuote.findUnique({
    where: { weddingId_vendorId: { weddingId: w.weddingId, vendorId } },
  });
  if (existing) {
    await prisma.vendorQuote.delete({ where: { id: existing.id } });
  } else {
    await prisma.vendorQuote.upsert({
      where: { weddingId_vendorId: { weddingId: w.weddingId, vendorId } },
      create: { weddingId: w.weddingId, vendorId, status: 'CONSIDERING' },
      update: {},
    });
  }
  return { ok: true };
}

async function upsertQuote(weddingId: string, vendorId: string, data: Record<string, unknown>) {
  return prisma.vendorQuote.upsert({
    where: { weddingId_vendorId: { weddingId, vendorId } },
    create: { weddingId, vendorId, status: 'CONSIDERING', ...data },
    update: data,
  });
}

export async function setQuoteStatus(vendorId: string, status: VendorQuoteStatus): Promise<VendorActionResult> {
  const w = await resolveWedding();
  if (!w.ok) return w;
  const parsed = quoteInput.pick({ status: true }).safeParse({ status });
  if (!parsed.success) return { ok: false, error: 'INVALID' };
  if (!(await visibleVendor(w.weddingId, vendorId))) return { ok: false, error: 'NOT_FOUND' };
  await upsertQuote(w.weddingId, vendorId, { status: parsed.data.status });
  return { ok: true };
}

export async function setQuoteAmount(vendorId: string, amount: number | null): Promise<VendorActionResult> {
  const w = await resolveWedding();
  if (!w.ok) return w;
  const parsed = quoteInput.pick({ amount: true }).safeParse({ amount });
  if (!parsed.success) return { ok: false, error: 'INVALID' };
  if (!(await visibleVendor(w.weddingId, vendorId))) return { ok: false, error: 'NOT_FOUND' };
  await upsertQuote(w.weddingId, vendorId, { amount: parsed.data.amount ?? null });
  return { ok: true };
}

export async function setQuoteNotes(vendorId: string, notes: string | null): Promise<VendorActionResult> {
  const w = await resolveWedding();
  if (!w.ok) return w;
  if (!(await visibleVendor(w.weddingId, vendorId))) return { ok: false, error: 'NOT_FOUND' };
  await upsertQuote(w.weddingId, vendorId, { notes: notes?.trim() || null });
  return { ok: true };
}

export async function linkQuoteToTask(vendorId: string, taskId: string | null): Promise<VendorActionResult> {
  const w = await resolveWedding();
  if (!w.ok) return w;
  if (!(await visibleVendor(w.weddingId, vendorId))) return { ok: false, error: 'NOT_FOUND' };
  if (taskId) {
    const task = await prisma.task.findFirst({ where: { id: taskId, weddingId: w.weddingId }, select: { id: true } });
    if (!task) return { ok: false, error: 'NOT_FOUND' };
  }
  await upsertQuote(w.weddingId, vendorId, { taskId });
  return { ok: true };
}

export async function pushQuoteToBudget(vendorId: string, opts: { paid: boolean }): Promise<VendorActionResult> {
  const w = await resolveWedding();
  if (!w.ok) return w;
  const quote = await prisma.vendorQuote.findUnique({
    where: { weddingId_vendorId: { weddingId: w.weddingId, vendorId } },
    select: { amount: true, taskId: true },
  });
  if (!quote) return { ok: false, error: 'NOT_FOUND' };
  if (quote.taskId == null || quote.amount == null) return { ok: false, error: 'INVALID' };
  // Reuse the Phase 5 task actions (each re-checks ownership of the task).
  const result = opts.paid
    ? await setTaskStatus(quote.taskId, true, quote.amount)
    : await setTaskEstimatedCost(quote.taskId, quote.amount);
  if (!result.ok) return { ok: false, error: result.error === 'INVALID' ? 'INVALID' : 'NOT_FOUND' };
  return { ok: true };
}

export async function addPrivateVendor(input: unknown): Promise<VendorActionResult> {
  const w = await resolveWedding();
  if (!w.ok) return w;
  const parsed = privateVendorSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'INVALID' };
  const { notes, ...fields } = parsed.data;
  const vendor = await prisma.vendor.create({
    data: { ...fields, weddingId: w.weddingId, verified: false, isPremium: false, active: true },
  });
  // A private vendor is on the couple's list immediately.
  await prisma.vendorQuote.upsert({
    where: { weddingId_vendorId: { weddingId: w.weddingId, vendorId: vendor.id } },
    create: { weddingId: w.weddingId, vendorId: vendor.id, status: 'CONSIDERING', notes: notes ?? null },
    update: {},
  });
  return { ok: true, id: vendor.id };
}

async function ownedPrivateVendor(weddingId: string, vendorId: string) {
  return prisma.vendor.findFirst({ where: { id: vendorId, weddingId }, select: { id: true } });
}

export async function editPrivateVendor(vendorId: string, input: unknown): Promise<VendorActionResult> {
  const w = await resolveWedding();
  if (!w.ok) return w;
  const parsed = privateVendorSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'INVALID' };
  if (!(await ownedPrivateVendor(w.weddingId, vendorId))) return { ok: false, error: 'NOT_FOUND' };
  const { notes, ...fields } = parsed.data;
  await prisma.vendor.update({ where: { id: vendorId }, data: fields });
  return { ok: true, id: vendorId };
}

export async function deletePrivateVendor(vendorId: string): Promise<VendorActionResult> {
  const w = await resolveWedding();
  if (!w.ok) return w;
  if (!(await ownedPrivateVendor(w.weddingId, vendorId))) return { ok: false, error: 'NOT_FOUND' };
  await prisma.vendor.delete({ where: { id: vendorId } });
  return { ok: true, id: vendorId };
}
```

Note: `notes` lives on `VendorQuote`, not `Vendor` — `addPrivateVendor`/`editPrivateVendor` strip it from the vendor `data` and (on add) seed it onto the couple's quote.

- [ ] **Step 4: Run it to verify it passes**

Run: `npm run test -- lib/actions/vendors.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck, lint & commit**

Run: `npm run typecheck && npm run lint`
Expected: PASS.

```bash
git add lib/actions/vendors.ts lib/actions/vendors.test.ts
git commit -m "feat: add couple vendor actions (shortlist, quote, private vendors, quote->budget push)"
```

---

### Task 4: Admin vendor actions

**Files:**
- Create: `lib/actions/admin-vendors.ts`, `lib/actions/admin-vendors.test.ts`

**Interfaces:**
- Consumes: `auth`, `prisma`; `vendorSchema`, `vendorImageSchema` from `@/lib/vendors/schema`.
- Produces:
  - `type AdminResult = { ok: true; id?: string } | { ok: false; error: 'FORBIDDEN' | 'INVALID' | 'NOT_FOUND' }`
  - Vendor: `createVendor`, `updateVendor(id, input)`, `deleteVendor(id)`, `setVendorActive(id, active)`, `setVendorVerified(id, verified)`, `setVendorPremium(id, isPremium)`, `reorderVendor(id, sortOrder)`.
  - Image: `addVendorImage(vendorId, input)`, `updateVendorImage(id, input)`, `deleteVendorImage(id)`, `reorderVendorImage(id, sortOrder)`.

- [ ] **Step 1: Write the admin actions test**

`lib/actions/admin-vendors.test.ts` — mirror `lib/actions/admin-budget.test.ts` (read it first). Include the parametrized non-admin `FORBIDDEN` + `Object.keys(module)` export-parity check, AND a test that admin mutations refuse a couple-private (`weddingId != null`) vendor.

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/db', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    vendor: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), delete: vi.fn() },
    vendorImage: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn(), delete: vi.fn() },
  },
}));

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import * as adminVendors from './admin-vendors';
import { createVendor, updateVendor, deleteVendor, addVendorImage } from './admin-vendors';

function asAdmin(isAdmin: boolean) {
  (auth as unknown as vi.Mock).mockResolvedValue(isAdmin ? { user: { id: 'a1' } } : null);
  (prisma.user.findUnique as vi.Mock).mockResolvedValue(isAdmin ? { role: 'ADMIN' } : { role: 'USER' });
}
beforeEach(() => vi.clearAllMocks());

const gatedCalls: Record<string, () => Promise<unknown>> = {
  createVendor: () => createVendor({ name_en: 'X', name_he: 'י', category: 'MUSIC' }),
  updateVendor: () => updateVendor('v1', { name_en: 'X', name_he: 'י', category: 'MUSIC' }),
  deleteVendor: () => deleteVendor('v1'),
  setVendorActive: () => adminVendors.setVendorActive('v1', true),
  setVendorVerified: () => adminVendors.setVendorVerified('v1', true),
  setVendorPremium: () => adminVendors.setVendorPremium('v1', true),
  reorderVendor: () => adminVendors.reorderVendor('v1', 5),
  addVendorImage: () => addVendorImage('v1', { url: 'https://x.test/a.jpg' }),
  updateVendorImage: () => adminVendors.updateVendorImage('i1', { url: 'https://x.test/a.jpg' }),
  deleteVendorImage: () => adminVendors.deleteVendorImage('i1'),
  reorderVendorImage: () => adminVendors.reorderVendorImage('i1', 5),
};

describe('admin gate', () => {
  it('every export is covered by the gated-calls map', () => {
    expect(Object.keys(adminVendors).sort()).toEqual(Object.keys(gatedCalls).sort());
  });
  it.each(Object.entries(gatedCalls))('%s rejects a non-admin', async (_n, call) => {
    asAdmin(false);
    expect(await call()).toEqual({ ok: false, error: 'FORBIDDEN' });
  });
});

describe('createVendor', () => {
  it('creates a GLOBAL vendor (weddingId null) and returns id', async () => {
    asAdmin(true);
    (prisma.vendor.create as vi.Mock).mockResolvedValue({ id: 'v-new' });
    const r = await createVendor({ name_en: 'Lumière', name_he: 'לומייר', category: 'PHOTOGRAPHY' });
    expect(r).toEqual({ ok: true, id: 'v-new' });
    expect(prisma.vendor.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ weddingId: null }) }),
    );
  });
  it('rejects invalid input', async () => {
    asAdmin(true);
    expect(await createVendor({ name_en: '', name_he: '', category: 'MUSIC' })).toEqual({ ok: false, error: 'INVALID' });
  });
});

describe('updateVendor refuses a private vendor', () => {
  it('returns NOT_FOUND when the target is couple-private', async () => {
    asAdmin(true);
    (prisma.vendor.findFirst as vi.Mock).mockResolvedValue(null); // scoped to weddingId:null → not found
    expect(await updateVendor('pv1', { name_en: 'X', name_he: 'י', category: 'MUSIC' })).toEqual({ ok: false, error: 'NOT_FOUND' });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test -- lib/actions/admin-vendors.test.ts`
Expected: FAIL ("Cannot find module './admin-vendors'").

- [ ] **Step 3: Implement the admin actions**

`lib/actions/admin-vendors.ts`:

```typescript
'use server';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { vendorSchema, vendorImageSchema } from '@/lib/vendors/schema';

export type AdminResult =
  | { ok: true; id?: string }
  | { ok: false; error: 'FORBIDDEN' | 'INVALID' | 'NOT_FOUND' };

async function requireAdmin(): Promise<string | null> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (user?.role !== 'ADMIN') return null;
  return userId;
}

/** Admin actions operate ONLY on global vendors (weddingId: null). */
async function globalVendor(id: string) {
  return prisma.vendor.findFirst({ where: { id, weddingId: null }, select: { id: true } });
}

export async function createVendor(input: unknown): Promise<AdminResult> {
  if (!(await requireAdmin())) return { ok: false, error: 'FORBIDDEN' };
  const parsed = vendorSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'INVALID' };
  const created = await prisma.vendor.create({ data: { ...parsed.data, weddingId: null } });
  return { ok: true, id: created.id };
}

export async function updateVendor(id: string, input: unknown): Promise<AdminResult> {
  if (!(await requireAdmin())) return { ok: false, error: 'FORBIDDEN' };
  const parsed = vendorSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'INVALID' };
  if (!(await globalVendor(id))) return { ok: false, error: 'NOT_FOUND' };
  await prisma.vendor.update({ where: { id }, data: parsed.data });
  return { ok: true, id };
}

export async function deleteVendor(id: string): Promise<AdminResult> {
  if (!(await requireAdmin())) return { ok: false, error: 'FORBIDDEN' };
  if (!(await globalVendor(id))) return { ok: false, error: 'NOT_FOUND' };
  await prisma.vendor.delete({ where: { id } });
  return { ok: true, id };
}

async function setVendorFlag(id: string, data: Record<string, unknown>): Promise<AdminResult> {
  if (!(await requireAdmin())) return { ok: false, error: 'FORBIDDEN' };
  if (!(await globalVendor(id))) return { ok: false, error: 'NOT_FOUND' };
  await prisma.vendor.update({ where: { id }, data });
  return { ok: true, id };
}

// NOTE: every export in a 'use server' file MUST be `async function` — Next.js 16
// rejects a non-async export at build time (the Phase 5 lesson). Do NOT write
// `export function setVendorActive(...) { return setVendorFlag(...) }`.
export async function setVendorActive(id: string, active: boolean): Promise<AdminResult> {
  return setVendorFlag(id, { active });
}
export async function setVendorVerified(id: string, verified: boolean): Promise<AdminResult> {
  return setVendorFlag(id, { verified });
}
export async function setVendorPremium(id: string, isPremium: boolean): Promise<AdminResult> {
  return setVendorFlag(id, { isPremium });
}

export async function reorderVendor(id: string, sortOrder: number): Promise<AdminResult> {
  if (!(await requireAdmin())) return { ok: false, error: 'FORBIDDEN' };
  if (!Number.isInteger(sortOrder)) return { ok: false, error: 'INVALID' };
  if (!(await globalVendor(id))) return { ok: false, error: 'NOT_FOUND' };
  await prisma.vendor.update({ where: { id }, data: { sortOrder } });
  return { ok: true, id };
}

// ---- Images (parent must be a global vendor) ----
export async function addVendorImage(vendorId: string, input: unknown): Promise<AdminResult> {
  if (!(await requireAdmin())) return { ok: false, error: 'FORBIDDEN' };
  const parsed = vendorImageSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'INVALID' };
  if (!(await globalVendor(vendorId))) return { ok: false, error: 'NOT_FOUND' };
  const created = await prisma.vendorImage.create({ data: { vendorId, ...parsed.data } });
  return { ok: true, id: created.id };
}

export async function updateVendorImage(id: string, input: unknown): Promise<AdminResult> {
  if (!(await requireAdmin())) return { ok: false, error: 'FORBIDDEN' };
  const parsed = vendorImageSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'INVALID' };
  const existing = await prisma.vendorImage.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return { ok: false, error: 'NOT_FOUND' };
  await prisma.vendorImage.update({ where: { id }, data: parsed.data });
  return { ok: true, id };
}

export async function deleteVendorImage(id: string): Promise<AdminResult> {
  if (!(await requireAdmin())) return { ok: false, error: 'FORBIDDEN' };
  const existing = await prisma.vendorImage.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return { ok: false, error: 'NOT_FOUND' };
  await prisma.vendorImage.delete({ where: { id } });
  return { ok: true, id };
}

export async function reorderVendorImage(id: string, sortOrder: number): Promise<AdminResult> {
  if (!(await requireAdmin())) return { ok: false, error: 'FORBIDDEN' };
  if (!Number.isInteger(sortOrder)) return { ok: false, error: 'INVALID' };
  const existing = await prisma.vendorImage.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return { ok: false, error: 'NOT_FOUND' };
  await prisma.vendorImage.update({ where: { id }, data: { sortOrder } });
  return { ok: true, id };
}
```

Note: every export checks `requireAdmin()` first (FORBIDDEN before any DB work), and every export is an `async function`. Keep the export set EXACTLY the eleven functions the test's `gatedCalls` map lists — the `Object.keys(module)` export-parity test fails if a twelfth export appears or one is renamed. The non-exported helpers (`requireAdmin`, `globalVendor`, `setVendorFlag`) and the `AdminResult` type do not appear in `Object.keys` (the type is erased at compile time).

- [ ] **Step 4: Run it to verify it passes; typecheck & lint**

Run: `npm run test -- lib/actions/admin-vendors.test.ts && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/actions/admin-vendors.ts lib/actions/admin-vendors.test.ts
git commit -m "feat: add admin vendor actions (global-only, live-DB gated)"
```

---

### Task 5: Proxy login-gate + i18n namespaces

**Files:**
- Modify: `lib/auth/authorize.ts:7`, `lib/auth/authorize.test.ts`, `messages/he.json`, `messages/en.json`

**Interfaces:**
- Produces: `/vendors` login-gated; `Vendors` + `AdminVendors` i18n namespaces; extended `Dashboard`.

- [ ] **Step 1: Gate `/vendors`**

In `lib/auth/authorize.ts` line 7, add `'/vendors'`:

```typescript
const APP_PREFIXES = ['/dashboard', '/onboarding', '/settings', '/checklist', '/concepts', '/budget', '/vendors'];
```

- [ ] **Step 2: Assert the gate**

In `lib/auth/authorize.test.ts`, add (mirroring the `/budget` cases):

```typescript
it('redirects logged-out users away from /vendors', () => {
  expect(authorizeRoute({ pathname: '/vendors', isLoggedIn: false, role: null }))
    .toEqual({ type: 'redirect', to: '/login' });
});
it('allows logged-in users to reach /vendors', () => {
  expect(authorizeRoute({ pathname: '/vendors', isLoggedIn: true, role: 'USER' }))
    .toEqual({ type: 'next' });
});
```

- [ ] **Step 3: Run the authorize test**

Run: `npm run test -- lib/auth/authorize.test.ts`
Expected: PASS.

- [ ] **Step 4: Add the English namespaces**

In `messages/en.json`, after `AdminBudget`, add:

```json
"Vendors": {
  "title": "Vendors",
  "subtitle": "Find and track your wedding suppliers",
  "disclaimer": "Listings are for information only. We are not a party to any agreement you make with a vendor. Please verify details directly with the vendor.",
  "forYourWedding": "For your wedding",
  "matchArea": "In your area",
  "matchBudget": "Fits your budget",
  "verifiedBadge": "Verified",
  "premiumBadge": "Premium",
  "priceFrom": "From {min}",
  "priceRange": "{min}–{max}",
  "filterCategory": "Category",
  "filterCity": "City",
  "filterMaxPrice": "Max price",
  "filterAll": "All",
  "shortlist": "Shortlist",
  "shortlisted": "Shortlisted",
  "addYourOwn": "Add your own vendor",
  "privateBadge": "Your vendor",
  "contactEmail": "Email",
  "contactPhone": "Call",
  "contactWebsite": "Website",
  "quoteTitle": "Your quote",
  "statusLabel": "Status",
  "amountLabel": "Quoted amount",
  "notesLabel": "Notes",
  "statusCONSIDERING": "Considering",
  "statusQUOTED": "Quoted",
  "statusBOOKED": "Booked",
  "statusDECLINED": "Declined",
  "linkTask": "Link to a checklist task",
  "noTask": "No task linked",
  "addToBudgetPlanned": "Add to budget (planned)",
  "addToBudgetPaid": "Add to budget (paid)",
  "addedToBudget": "Added to your budget",
  "save": "Save",
  "cancel": "Cancel",
  "edit": "Edit",
  "delete": "Delete",
  "empty": "No vendors match your filters yet.",
  "nameLabel": "Name",
  "cityLabel": "City",
  "error": "Something went wrong. Please try again."
},
"AdminVendors": {
  "title": "Vendors",
  "subtitle": "Curated global vendor directory",
  "addVendor": "Add vendor",
  "nameEnLabel": "Name (English)",
  "nameHeLabel": "Name (Hebrew)",
  "categoryLabel": "Category",
  "cityLabel": "City",
  "priceMinLabel": "Price from",
  "priceMaxLabel": "Price to",
  "emailLabel": "Email",
  "phoneLabel": "Phone",
  "websiteLabel": "Website",
  "verifiedLabel": "Verified",
  "premiumLabel": "Premium",
  "activeLabel": "Active",
  "imagesTitle": "Portfolio images",
  "imageUrlLabel": "Image URL",
  "addImage": "Add image",
  "save": "Save",
  "cancel": "Cancel",
  "delete": "Delete",
  "error": "Something went wrong. Please try again."
}
```

Add to the existing `Dashboard` namespace:

```json
"vendorsTitle": "Find your vendors",
"vendorsBody": "Browse suppliers matched to your area and budget.",
"vendorsCta": "Browse vendors"
```

- [ ] **Step 5: Add the Hebrew namespaces**

In `messages/he.json`, add the parallel translations (identical keys):

```json
"Vendors": {
  "title": "ספקים",
  "subtitle": "מצאו ונהלו את ספקי החתונה שלכם",
  "disclaimer": "הרשימות הן למידע בלבד. איננו צד להסכם שתעשו עם ספק. אנא ודאו את הפרטים ישירות מול הספק.",
  "forYourWedding": "לחתונה שלכם",
  "matchArea": "באזור שלכם",
  "matchBudget": "מתאים לתקציב",
  "verifiedBadge": "מאומת",
  "premiumBadge": "פרימיום",
  "priceFrom": "החל מ-{min}",
  "priceRange": "{min}–{max}",
  "filterCategory": "קטגוריה",
  "filterCity": "עיר",
  "filterMaxPrice": "מחיר מרבי",
  "filterAll": "הכול",
  "shortlist": "הוספה לרשימה",
  "shortlisted": "ברשימה",
  "addYourOwn": "הוספת ספק משלכם",
  "privateBadge": "הספק שלכם",
  "contactEmail": "אימייל",
  "contactPhone": "התקשרו",
  "contactWebsite": "אתר",
  "quoteTitle": "הצעת המחיר שלכם",
  "statusLabel": "סטטוס",
  "amountLabel": "סכום מוצע",
  "notesLabel": "הערות",
  "statusCONSIDERING": "בבחינה",
  "statusQUOTED": "הצעה התקבלה",
  "statusBOOKED": "הוזמן",
  "statusDECLINED": "נדחה",
  "linkTask": "קישור למשימה ברשימה",
  "noTask": "לא מקושרת משימה",
  "addToBudgetPlanned": "הוספה לתקציב (מתוכנן)",
  "addToBudgetPaid": "הוספה לתקציב (שולם)",
  "addedToBudget": "נוסף לתקציב שלכם",
  "save": "שמירה",
  "cancel": "ביטול",
  "edit": "עריכה",
  "delete": "מחיקה",
  "empty": "אין ספקים שתואמים את הסינון עדיין.",
  "nameLabel": "שם",
  "cityLabel": "עיר",
  "error": "משהו השתבש. נסו שוב."
},
"AdminVendors": {
  "title": "ספקים",
  "subtitle": "מדריך ספקים גלובלי אצור",
  "addVendor": "הוספת ספק",
  "nameEnLabel": "שם (אנגלית)",
  "nameHeLabel": "שם (עברית)",
  "categoryLabel": "קטגוריה",
  "cityLabel": "עיר",
  "priceMinLabel": "מחיר מ-",
  "priceMaxLabel": "מחיר עד",
  "emailLabel": "אימייל",
  "phoneLabel": "טלפון",
  "websiteLabel": "אתר",
  "verifiedLabel": "מאומת",
  "premiumLabel": "פרימיום",
  "activeLabel": "פעיל",
  "imagesTitle": "תמונות תיק עבודות",
  "imageUrlLabel": "כתובת תמונה",
  "addImage": "הוספת תמונה",
  "save": "שמירה",
  "cancel": "ביטול",
  "delete": "מחיקה",
  "error": "משהו השתבש. נסו שוב."
}
```

Add to the Hebrew `Dashboard`:

```json
"vendorsTitle": "מצאו את הספקים שלכם",
"vendorsBody": "עיינו בספקים שתואמים לאזור ולתקציב שלכם.",
"vendorsCta": "עיון בספקים"
```

- [ ] **Step 6: Verify parity & parse**

Run: `npm run test && npm run lint`
Expected: PASS (i18n key-parity check and JSON validity hold).

- [ ] **Step 7: Commit**

```bash
git add lib/auth/authorize.ts lib/auth/authorize.test.ts messages/he.json messages/en.json
git commit -m "feat: login-gate /vendors and add Vendors/AdminVendors i18n namespaces"
```

---

### Task 6: Couple UI — directory, detail, quote panel, private vendors, concept surface

**Files:**
- Create: `app/[locale]/(app)/vendors/page.tsx`, `vendors-directory.tsx`, `vendor-card.tsx`, `add-private-vendor.tsx`, `[vendorId]/page.tsx`, `[vendorId]/vendor-detail.tsx`, `vendors-view.test.tsx`
- Modify: `app/[locale]/(app)/concepts/[conceptId]/page.tsx`, `concept-detail.tsx`

**Interfaces:**
- Consumes: the couple actions from `@/lib/actions/vendors`; `getDirectoryVendors`/`getVendorDetail`/`getRecommendedVendors`/`getWeddingQuotes` from `@/lib/vendors/queries`; `resolveVendorTitle`; `getTasks` from `@/lib/checklist/queries` (for the link-task select).
- Produces: the `/vendors` routes; a `SerializedVendor` view type.

- [ ] **Step 1: Write the component test**

`app/[locale]/(app)/vendors/vendors-view.test.tsx` — render with `NextIntlClientProvider` (read `concepts-view.test.tsx` for setup). Assert: the disclaimer renders; a card shows the `Verified` badge only when `verified`; a match uses neutral copy (no "recommended"); the quote panel shows the amount field.

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';
import { VendorCard } from './vendor-card';

function renderCard(props: Parameters<typeof VendorCard>[0]) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <VendorCard {...props} />
    </NextIntlClientProvider>,
  );
}
const base = {
  locale: 'en',
  vendor: {
    id: 'v1', name_en: 'Lumière', name_he: 'לומייר', titleLocale: 'AUTO' as const,
    category: 'PHOTOGRAPHY' as const, city: 'Tel Aviv', priceMin: 8000, priceMax: 18000,
    verified: true, isPremium: false, isPrivate: false, coverUrl: null,
  },
  shortlisted: false,
  onChanged: () => {},
};

describe('VendorCard', () => {
  it('shows the Verified badge for a verified vendor', () => {
    renderCard(base);
    expect(screen.getByText('Verified')).toBeTruthy();
  });
  it('hides the Verified badge for an unverified vendor', () => {
    renderCard({ ...base, vendor: { ...base.vendor, verified: false } });
    expect(screen.queryByText('Verified')).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test -- app/[locale]/(app)/vendors/vendors-view.test.tsx`
Expected: FAIL ("Cannot find module './vendor-card'").

- [ ] **Step 3: Implement `vendor-card.tsx`**

`app/[locale]/(app)/vendors/vendor-card.tsx` — a client card with a shortlist toggle. `SerializedVendor` is defined here and reused by the directory.

```tsx
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { TaskCategory, TitleLocale } from '@prisma/client';
import { Link } from '@/lib/i18n/navigation';
import { toggleShortlist } from '@/lib/actions/vendors';
import { resolveVendorTitle } from '@/lib/vendors/title';

export interface SerializedVendor {
  id: string;
  name_en: string; name_he: string; titleLocale: TitleLocale;
  category: TaskCategory; city: string | null;
  priceMin: number | null; priceMax: number | null;
  verified: boolean; isPremium: boolean; isPrivate: boolean;
  coverUrl: string | null;
}

export function VendorCard({
  locale, vendor, shortlisted, onChanged,
}: { locale: string; vendor: SerializedVendor; shortlisted: boolean; onChanged: () => void }) {
  const t = useTranslations('Vendors');
  const tCategory = useTranslations('TaskCategory');
  const [pending, setPending] = useState(false);
  const name = resolveVendorTitle(vendor, locale);
  const fmt = (n: number) => `₪${n.toLocaleString(locale)}`;

  async function toggle() {
    setPending(true);
    const r = await toggleShortlist(vendor.id);
    setPending(false);
    if (r.ok) onChanged();
  }

  return (
    <div className="flex flex-col gap-2 rounded-card bg-surface p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <Link href={`/vendors/${vendor.id}`} className="font-display text-lg text-text">{name}</Link>
        <button type="button" disabled={pending} onClick={toggle} className="text-sm text-primary">
          {shortlisted ? t('shortlisted') : t('shortlist')}
        </button>
      </div>
      <div className="flex flex-wrap gap-2 text-xs text-muted">
        <span>{tCategory(vendor.category)}</span>
        {vendor.city ? <span>· {vendor.city}</span> : null}
        {vendor.priceMin != null ? (
          <span>· {vendor.priceMax != null ? t('priceRange', { min: fmt(vendor.priceMin), max: fmt(vendor.priceMax) }) : t('priceFrom', { min: fmt(vendor.priceMin) })}</span>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {vendor.isPrivate ? <span className="rounded-card bg-accent/20 px-2 py-0.5 text-xs text-text">{t('privateBadge')}</span> : null}
        {vendor.verified ? <span className="rounded-card bg-primary/15 px-2 py-0.5 text-xs text-primary">{t('verifiedBadge')}</span> : null}
        {vendor.isPremium ? <span className="rounded-card bg-background px-2 py-0.5 text-xs text-muted">{t('premiumBadge')}</span> : null}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Implement the directory + private-vendor form + detail**

Create `vendors-directory.tsx` (client: filter controls calling `router.push` with query params + a grid of `VendorCard` + the disclaimer banner + an "add your own" toggle rendering `add-private-vendor.tsx`), `add-private-vendor.tsx` (client form → `addPrivateVendor`), `[vendorId]/vendor-detail.tsx` (client: portfolio, contact `mailto:`/`tel:`/website links, and the quote panel — status select → `setQuoteStatus`, amount → `setQuoteAmount`, notes → `setQuoteNotes`, a task `<select>` from the passed tasks → `linkQuoteToTask`, and two buttons → `pushQuoteToBudget({paid:false|true})`; private vendors show edit/delete via `editPrivateVendor`/`deletePrivateVendor`). Match `task-row.tsx`/`concept-detail.tsx` idioms (optimistic `useState`, `router.refresh()` on change, `dir="ltr"` on number/contact inputs, logical Tailwind props, all copy from the `Vendors` namespace). Keep each file focused; if `vendor-detail.tsx` grows past ~200 lines, split the quote panel into `quote-panel.tsx`.

- [ ] **Step 5: Implement the two RSC loaders**

`app/[locale]/(app)/vendors/page.tsx` (RSC): auth + wedding guard (redirect like the budget page); read `searchParams` for filters; load `getRecommendedVendors(wedding, {})`, `getDirectoryVendors(wedding.id, filters)`, `getWeddingQuotes(wedding.id)` (to mark shortlisted); serialize (cover = first image url) and render the disclaimer + "For your wedding" matches + the directory via `vendors-directory.tsx`.

`app/[locale]/(app)/vendors/[vendorId]/page.tsx` (RSC): auth + wedding guard; `getVendorDetail(vendorId, wedding.id)` (404/redirect to `/vendors` when null); load the couple's open tasks via `getTasks(wedding.id)` for the link-task select; render `vendor-detail.tsx`.

Full code for these follows the Phase 4 concepts loaders (`concepts/page.tsx`, `concepts/[conceptId]/page.tsx`) — same auth/redirect/serialize shape; read those first and mirror them.

- [ ] **Step 6: Add the "vendors for this" surface to the concept detail**

In `app/[locale]/(app)/concepts/[conceptId]/page.tsx`, after loading the concept, compute the distinct element categories and load a few matched vendors per category:

```typescript
import { getRecommendedVendors } from '@/lib/vendors/queries';
// ...after `wedding` and `concept` are loaded:
const categories = [...new Set(concept.elements.map((e) => e.category))];
const vendorsByCategory = Object.fromEntries(
  await Promise.all(
    categories.map(async (category) => [
      category,
      (await getRecommendedVendors(wedding!, { category, limit: 3 })).map((v) => ({
        id: v.id, name_en: v.name_en, name_he: v.name_he, titleLocale: v.titleLocale,
      })),
    ]),
  ),
);
```

Pass `vendorsByCategory` into `concept-detail.tsx`; under each idea, render a small "vendors for this" chip row (each chip links to `/vendors/${v.id}`, name via `resolveVendorTitle`), using a new `Concepts.vendorsForThis` i18n key (add it to both message files in this task). If the list for a category is empty, render nothing.

- [ ] **Step 7: Run the component test; typecheck & lint**

Run: `npm run test -- app/[locale]/(app)/vendors && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add "app/[locale]/(app)/vendors" "app/[locale]/(app)/concepts" messages/he.json messages/en.json
git commit -m "feat: add /vendors couple UI (directory, detail, quotes, private vendors) and concept vendor surface"
```

---

### Task 7: Admin UI — vendor CMS

**Files:**
- Create: `app/[locale]/admin/vendors/page.tsx`, `vendors-admin.tsx`, `vendors-admin.test.tsx`
- Modify: `app/[locale]/admin/page.tsx` (nav link)

**Interfaces:**
- Consumes: the admin actions from `@/lib/actions/admin-vendors`; `TaskCategory` labels.

- [ ] **Step 1: Write the admin component test**

`app/[locale]/admin/vendors/vendors-admin.test.tsx` — render with `NextIntlClientProvider` (mirror `budget-templates-admin.test.tsx`). Assert the list renders a seeded vendor row and the "add vendor" control is present.

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';
import { VendorsAdmin } from './vendors-admin';

describe('VendorsAdmin', () => {
  it('renders vendor rows and the add control', () => {
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <VendorsAdmin vendors={[{
          id: 'v1', name_en: 'Lumière', name_he: 'לומייר', titleLocale: 'AUTO',
          category: 'PHOTOGRAPHY', city: 'Tel Aviv', priceMin: 8000, priceMax: 18000,
          email: null, phone: null, website: null, description_en: null, description_he: null,
          verified: true, isPremium: false, active: true, sortOrder: 10, images: [],
        }]} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText('Lumière')).toBeTruthy();
    expect(screen.getByText(/add vendor/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test -- app/[locale]/admin/vendors/vendors-admin.test.tsx`
Expected: FAIL ("Cannot find module './vendors-admin'").

- [ ] **Step 3: Implement the admin page loader (live-DB gate)**

`app/[locale]/admin/vendors/page.tsx` — mirror `admin/budget-templates/page.tsx` (the live-DB role read + redirect). Load GLOBAL vendors (`where: { weddingId: null }`, include images ordered) and pass a serialized list to `VendorsAdmin`.

- [ ] **Step 4: Implement `vendors-admin.tsx`**

`app/[locale]/admin/vendors/vendors-admin.tsx` — client: a vendor list with active/verified/premium toggles + edit/delete; an "add vendor" form (bilingual names, category select, city, price range, contact, flags) calling `createVendor`/`updateVendor`/`deleteVendor`/`setVendorActive`/`setVendorVerified`/`setVendorPremium`; and a nested portfolio-image editor (url + alt + order) calling `addVendorImage`/`updateVendorImage`/`deleteVendorImage`. Mirror `concepts-admin.tsx`/`concept-form.tsx` structure; keep files focused (split the form/image editor into small components if it grows past ~200 lines). All copy from `AdminVendors`; number/contact inputs `dir="ltr"`; `router.refresh()` on change.

- [ ] **Step 5: Add the admin nav link**

In `app/[locale]/admin/page.tsx`, add `const tVendors = await getTranslations('AdminVendors');` and a `<li>` after the Budget Baseline link:

```tsx
        <li>
          <Link href="/admin/vendors" className="text-primary underline">
            {tVendors('title')}
          </Link>
        </li>
```

- [ ] **Step 6: Run the component test; typecheck & lint**

Run: `npm run test -- app/[locale]/admin/vendors && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add "app/[locale]/admin/vendors" "app/[locale]/admin/page.tsx"
git commit -m "feat: add admin vendor CMS (global directory + portfolio images)"
```

---

### Task 8: Dashboard entry + E2E + acceptance verification

**Files:**
- Modify: `app/[locale]/(app)/dashboard/page.tsx`
- Create: `e2e/vendors.spec.ts`

- [ ] **Step 1: Add the dashboard vendors card**

In `app/[locale]/(app)/dashboard/page.tsx`, add a card after the budget section (before `</main>`):

```tsx
      <section className="rounded-card bg-surface p-5">
        <h2 className="font-display text-lg text-text">{t('vendorsTitle')}</h2>
        <p className="mt-1 text-sm text-muted">{t('vendorsBody')}</p>
        <Link href="/vendors" className="mt-3 inline-block rounded-card bg-primary px-4 py-2 text-sm font-medium text-background">
          {t('vendorsCta')}
        </Link>
      </section>
```

- [ ] **Step 2: Write the E2E spec**

`e2e/vendors.spec.ts` — copy the inline register/onboard helper block from the top of `e2e/concepts.spec.ts` (change the `uniqueEmail` prefix to `e2e-vendors-`). Then:

```typescript
import { test, expect, type Page } from '@playwright/test';
// ---- paste the inline helpers from e2e/concepts.spec.ts (uniqueEmail prefix e2e-vendors-) ----

test.describe('Vendors', () => {
  test('browse, shortlist, quote, book, push a paid quote into the budget', async ({ page }) => {
    await registerAndOnboard(page); // lands on /dashboard

    // A budget is needed for the committed rollup to be meaningful.
    await page.goto('/budget');
    await page.getByRole('button', { name: /set budget/i }).click();
    await page.getByRole('spinbutton').first().fill('150000');
    await page.getByRole('button', { name: /^save$/i }).click();

    // Open the directory, see the disclaimer, open a seeded vendor.
    await page.goto('/vendors');
    await expect(page.getByText(/for information only/i)).toBeVisible();
    await page.getByText('Groove DJ Collective').click();

    // Set a quote amount, link it to a checklist task, add to budget as paid.
    await page.getByLabel(/quoted amount/i).fill('9000');
    await page.getByRole('button', { name: /^save$/i }).first().click();
    // Link to a music-related checklist task (the select lists the couple's tasks).
    await page.getByLabel(/link to a checklist task/i).selectOption({ index: 1 });
    await page.getByRole('button', { name: /add to budget \(paid\)/i }).click();
    await expect(page.getByText(/added to your budget/i)).toBeVisible();

    // The amount now shows in the budget's committed total.
    await page.goto('/budget');
    await expect(page.getByText(/committed/i).first()).toBeVisible();
  });

  test('a private vendor is visible only to its couple', async ({ page }) => {
    await registerAndOnboard(page);
    await page.goto('/vendors');
    await page.getByRole('button', { name: /add your own vendor/i }).click();
    await page.getByLabel(/name/i).first().fill('Cousin Dan DJ');
    await page.getByRole('button', { name: /^save$/i }).click();
    await expect(page.getByText('Cousin Dan DJ')).toBeVisible();
  });

  test('logged-out visitor is redirected from /vendors', async ({ page }) => {
    await page.goto('/vendors');
    await expect(page).toHaveURL(/\/login/);
  });
});
```

Adjust selectors to match the sibling specs' conventions and the exact labels you shipped in Task 6. Do NOT weaken the "committed" assertion — the point is the paid quote reaches the budget.

- [ ] **Step 3: Run the E2E spec**

Run: `npm run test:e2e -- vendors.spec.ts`
Expected: PASS. (If a stale `next dev` holds an old Prisma client, kill it and let Playwright spawn a fresh server with `npm run db:generate` re-run.)

- [ ] **Step 4: Full verification sweep against acceptance criteria**

```bash
npm run lint && npm run typecheck && npm run test && npm run test:e2e
```
Walk the spec's Acceptance criteria (1–12) and confirm each maps to a passing test or a manual check. Record the unit + e2e counts.

- [ ] **Step 5: Commit**

```bash
git add "app/[locale]/(app)/dashboard/page.tsx" e2e/vendors.spec.ts
git commit -m "feat: add dashboard vendors entry and vendor e2e flows"
```

---

### Final: Whole-branch review

- [ ] **Step 1: Run the full gate**

```bash
npm run lint && npm run typecheck && npm run test && npm run test:e2e
```
Expected: all green. Record the counts.

- [ ] **Step 2: Adversarial whole-branch review**

Request a review of the whole `phase-6-vendors` diff (final reviewer on the most capable model). Focus areas:
- **Two-tier isolation** — can a couple ever see/mutate another couple's private vendor? Do admin actions strictly refuse `weddingId != null`? Does the directory query correctly union global-active + own-private and exclude others' private?
- **Quote→budget bridge** — `pushQuoteToBudget` reuses the Phase 5 actions correctly (planned vs paid), requires task+amount, and never creates a parallel money source; error mapping is sound.
- **Recommendation engine** — deterministic, private vendors never surface, neutral copy in the UI (no "recommended" string), `verified` badge only for vetted.
- **Ownership + admin gate** — every couple action DB-resolves `weddingId`; the admin export-parity test covers all exports; the admin PAGE loader uses the live-DB read.
- **i18n parity** — he/en identical keys for the new namespaces.
- **`'use server'` async exports** — every export in `vendors.ts`/`admin-vendors.ts` is an `async function` (the Phase 5 build-time lesson).

- [ ] **Step 3: Address findings; update the implementation log**

Apply Critical/Important fixes (commit each). Add the Phase 6 section to `docs/superpowers/IMPLEMENTATION-LOG.md` (mirror the Phase 5 entry: delivered summary, verification counts, key decisions/deviations, and resolve/adjust backlog items — e.g. `setTaskEstimatedCost` is now wired; note any new deferrals). Commit.

- [ ] **Step 4: Push / PR** (only on the user's explicit go-ahead — never commit/push without per-request permission).
