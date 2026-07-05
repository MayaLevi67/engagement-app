# Phase 4 — Wedding Concepts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Wedding Concepts feature — an admin-authored library of curated wedding concepts (name, tagline, palette, vision-board images, and a list of "ideas"), a couple-facing gallery + detail where couples favorite a shortlist, choose one concept as their wedding's direction, and push individual ideas into their Phase 3 checklist.

**Architecture:** Reference model (Approach A) — `Concept`/`ConceptImage`/`ConceptElement` are admin master tables; a couple's relationship is a reference (`Wedding.selectedConceptId` + `ConceptFavorite` rows), not a copy. The single reuse of the Phase 3 snapshot pattern is "push idea → checklist", which creates a self-contained `Task` (`sourceConceptElementId` provenance, `isCustom: true`). Vision-board photos are stored as URL references now (upload-ready schema for later). Domain logic in `lib/concepts/`, server actions in `lib/actions/`, couple UI under `app/[locale]/(app)/concepts/`, admin CMS under `app/[locale]/admin/concepts/`.

**Tech Stack:** Next.js 16 (App Router, RSC + server actions), Prisma 6.19.3 + Postgres, next-intl (he default/RTL + en), Zod, Vitest (+ @testing-library/react), Playwright, Tailwind v4 design tokens.

## Global Constraints

- **Prisma pinned to 6.19.3** — do not upgrade; migrations via `npm run db:migrate` (Docker Postgres on host port **5433**, `DATABASE_URL` from `.env`).
- **Bilingual everywhere** — every user-facing content field has `_en` + `_he`; titles render through the `TitleLocale` (`AUTO`/`EN`/`HE`) resolver, default = couple's locale.
- **No hard-coded strings in JSX** — all chrome via `messages/he.json` + `messages/en.json` (ESLint rule fails the build otherwise). Data text (concept titles etc.) comes from the DB.
- **RTL-safe** — use Tailwind logical properties (`ps-`/`pe-`/`ms-`/`me-`/`text-start`/`text-end`), never `pl-`/`pr-`/`text-left`.
- **Ownership scoping** — couple actions resolve `weddingId` from the DB via `getCurrentWedding(userId)` (never a client/JWT id). Admin mutations re-check live `User.role === ADMIN` via `requireAdmin()`.
- **Reuse existing enums** — `ConceptElement.category` uses the existing `TaskCategory` enum. Do not add a new category enum.
- **Lint/type gate** — `npm run lint` (`--max-warnings 0`) and `npm run typecheck` must stay green.
- **Design tokens** — use existing token classes (`bg-surface`, `text-text`, `text-muted`, `bg-primary`, `text-background`, `rounded-card`, `font-display`). Match the "old-money" look of the Phase 3 UI.

## File Structure

**Create:**
- `lib/concepts/title.ts` — `resolveConceptTitle()` (concept/element locale resolver; may re-export the Phase 3 resolver).
- `lib/concepts/title.test.ts`
- `lib/concepts/schema.ts` — Zod: `conceptSchema`, `conceptElementSchema`, `conceptImageSchema`, option arrays.
- `lib/concepts/schema.test.ts`
- `lib/concepts/queries.ts` — `getActiveConcepts`, `getAllConcepts`, `getConceptDetail`, `getWeddingConceptState`, `elementToTaskPayload`.
- `lib/concepts/queries.test.ts`
- `lib/actions/concepts.ts` — couple actions.
- `lib/actions/concepts.test.ts`
- `lib/actions/admin-concepts.ts` — admin CMS actions.
- `lib/actions/admin-concepts.test.ts`
- `app/[locale]/(app)/concepts/page.tsx` — gallery (RSC).
- `app/[locale]/(app)/concepts/concepts-gallery.tsx` — client gallery grid + favorite/selected state.
- `app/[locale]/(app)/concepts/concept-card.tsx` — a single card (client).
- `app/[locale]/(app)/concepts/[conceptId]/page.tsx` — detail (RSC).
- `app/[locale]/(app)/concepts/[conceptId]/concept-detail.tsx` — client detail view.
- `app/[locale]/(app)/concepts/concepts-view.test.tsx` — component tests.
- `app/[locale]/admin/concepts/page.tsx` — admin list (RSC).
- `app/[locale]/admin/concepts/concepts-admin.tsx` — client list + concept editor.
- `app/[locale]/admin/concepts/concept-form.tsx` — concept fields + nested element/image editors (client).
- `app/[locale]/admin/concepts/concepts-admin.test.tsx` — component test.

**Modify:**
- `prisma/schema.prisma` — add 4 models + `Wedding.selectedConceptId`/`favorites` + `Task.sourceConceptElementId`.
- `prisma/seed.ts` — add ~4 concept seeds (idempotent upsert).
- `lib/auth/authorize.ts:6` — add `/concepts` to `APP_PREFIXES`.
- `lib/auth/authorize.test.ts` — assert `/concepts` is login-gated.
- `app/[locale]/admin/page.tsx` — add a "Concepts" admin nav link.
- `app/[locale]/(app)/dashboard/page.tsx` — light "choose your concept" nudge.
- `messages/he.json` + `messages/en.json` — add `Concepts` + `AdminConcepts` namespaces; extend `Dashboard`.
- `e2e/concepts.spec.ts` — create (new e2e spec).

---

### Task 1: Schema, migration & concept seed

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `prisma/seed.ts`
- Test: `prisma/seed.ts` is validated by running it (idempotency asserted in Task 3's queries test via seeded data; a direct seed re-run check is in Step 6).

**Interfaces:**
- Produces: Prisma models `Concept`, `ConceptImage`, `ConceptElement`, `ConceptFavorite`; `Wedding.selectedConceptId` (nullable), `Wedding.selectedConcept`, `Wedding.favorites`; `Task.sourceConceptElementId` (nullable String). Seeded concept ids `concept-party-time`, `concept-italian-summer`, `concept-old-money`, `concept-modern-luxury`.

- [ ] **Step 1: Add the models to the schema**

In `prisma/schema.prisma`, append the four models and add the relations to `Wedding` and the provenance field to `Task`.

```prisma
model Concept {
  id             String       @id @default(cuid())
  title_en       String
  title_he       String
  titleLocale    TitleLocale  @default(AUTO)
  tagline_en     String?
  tagline_he     String?
  description_en String?
  description_he String?
  palette        String[]
  isPremium      Boolean      @default(false)
  active         Boolean      @default(true)
  sortOrder      Int          @default(0)

  images      ConceptImage[]
  elements    ConceptElement[]
  favoritedBy ConceptFavorite[]
  selectedBy  Wedding[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model ConceptImage {
  id        String  @id @default(cuid())
  conceptId String
  concept   Concept @relation(fields: [conceptId], references: [id], onDelete: Cascade)
  url       String
  alt_en    String?
  alt_he    String?
  sortOrder Int     @default(0)

  @@index([conceptId])
}

model ConceptElement {
  id             String       @id @default(cuid())
  conceptId      String
  concept        Concept      @relation(fields: [conceptId], references: [id], onDelete: Cascade)
  title_en       String
  title_he       String
  titleLocale    TitleLocale  @default(AUTO)
  description_en String?
  description_he String?
  category       TaskCategory
  estCostMin     Int?
  estCostMax     Int?
  active         Boolean      @default(true)
  sortOrder      Int          @default(0)

  @@index([conceptId])
}

model ConceptFavorite {
  id        String   @id @default(cuid())
  weddingId String
  wedding   Wedding  @relation(fields: [weddingId], references: [id], onDelete: Cascade)
  conceptId String
  concept   Concept  @relation(fields: [conceptId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())

  @@unique([weddingId, conceptId])
  @@index([weddingId])
}
```

In the existing `Wedding` model, add these three lines (next to `tasks`):

```prisma
  selectedConceptId String?
  selectedConcept   Concept?          @relation(fields: [selectedConceptId], references: [id], onDelete: SetNull)
  favorites         ConceptFavorite[]
```

In the existing `Task` model, add this line (next to `sourceTemplateId`):

```prisma
  sourceConceptElementId String?
```

- [ ] **Step 2: Create and apply the migration**

Run: `npm run db:migrate -- --name add_wedding_concepts`
Expected: a new folder under `prisma/migrations/` and "Your database is now in sync with your schema." Prisma Client regenerates.

- [ ] **Step 3: Run typecheck to confirm the client picked up the new models**

Run: `npm run typecheck`
Expected: PASS (new `Concept`, `ConceptElement` etc. types available from `@prisma/client`).

- [ ] **Step 4: Add the concept seed data**

In `prisma/seed.ts`, above `async function main()`, add the concept seed structures. Keep the existing `templates` block untouched.

```typescript
type ElementSeed = {
  title_en: string;
  title_he: string;
  description_en: string;
  description_he: string;
  category:
    | 'VENUE' | 'CATERING' | 'PHOTOGRAPHY' | 'MUSIC' | 'ATTIRE' | 'DESIGN'
    | 'FLOWERS' | 'GUESTS' | 'CEREMONY' | 'PLANNING' | 'BUDGET' | 'OTHER';
  estCostMin: number | null;
  estCostMax: number | null;
  sortOrder: number;
};

type ConceptSeed = {
  id: string;
  title_en: string;
  title_he: string;
  tagline_en: string;
  tagline_he: string;
  description_en: string;
  description_he: string;
  palette: string[];
  isPremium: boolean;
  sortOrder: number;
  images: { url: string; alt_en: string; alt_he: string; sortOrder: number }[];
  elements: ElementSeed[];
};

const concepts: ConceptSeed[] = [
  {
    id: 'concept-party-time',
    title_en: 'Party Time',
    title_he: 'מסיבה בלי סוף',
    tagline_en: 'Dance floor first, everything else second',
    tagline_he: 'רחבת ריקודים במרכז, כל השאר מסביב',
    description_en: 'A high-energy celebration built around the music and the crowd — two DJs, bold lighting, and a late-night set that keeps everyone dancing.',
    description_he: 'חגיגה אנרגטית שנבנית סביב המוזיקה והקהל — שני תקליטנים, תאורה נועזת וסט אחרי-חצות שמשאיר את כולם על הרחבה.',
    palette: ['#1C1C1C', '#E4007C', '#00E0FF', '#FFD400'],
    isPremium: false,
    sortOrder: 10,
    images: [
      { url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819', alt_en: 'Wedding dance floor at night', alt_he: 'רחבת ריקודים בחתונה בלילה', sortOrder: 0 },
    ],
    elements: [
      { title_en: 'Two DJs — mainstream + techno after-party', title_he: 'שני תקליטנים — מיינסטרים ואפטר טכנו', description_en: 'One DJ for the main set, a second for the late-night techno after-party.', description_he: 'תקליטן אחד לסט המרכזי, שני לאפטר טכנו של אחרי חצות.', category: 'MUSIC', estCostMin: 6000, estCostMax: 14000, sortOrder: 10 },
      { title_en: 'Extra party lighting & effects', title_he: 'תאורת מסיבה ואפקטים', description_en: 'Moving heads, lasers and haze to turn the room into a club.', description_he: 'ראשים נעים, לייזרים ועשן שהופכים את החלל למועדון.', category: 'DESIGN', estCostMin: 4000, estCostMax: 9000, sortOrder: 20 },
      { title_en: 'Sunglasses station for the techno set', title_he: 'עמדת משקפי שמש לסט הטכנו', description_en: 'A styled station of sunglasses guests grab for the after-party.', description_he: 'עמדה מעוצבת של משקפי שמש שהאורחים לוקחים לאפטר.', category: 'OTHER', estCostMin: 800, estCostMax: 2000, sortOrder: 30 },
    ],
  },
  {
    id: 'concept-italian-summer',
    title_en: 'Italian Summer',
    title_he: 'קיץ איטלקי',
    tagline_en: 'Lemons, linen and golden light',
    tagline_he: 'לימונים, פשתן ואור זהוב',
    description_en: 'A sun-drenched garden celebration — long linen tables, citrus and olive branches, and a relaxed al-fresco feast.',
    description_he: 'חגיגה בגן שטופת שמש — שולחנות פשתן ארוכים, ענפי הדרים וזית, וסעודה נינוחה בחוץ.',
    palette: ['#FFFFFF', '#6E8B3D', '#E7B10A', '#F2E8CF'],
    isPremium: true,
    sortOrder: 20,
    images: [
      { url: 'https://images.unsplash.com/photo-1519225421980-715cb0215aed', alt_en: 'Outdoor garden wedding table', alt_he: 'שולחן חתונה בגן פתוח', sortOrder: 0 },
    ],
    elements: [
      { title_en: 'Long linen banquet tables', title_he: 'שולחנות בנקט ארוכים מפשתן', description_en: 'Family-style seating on long tables with natural linen.', description_he: 'ישיבה משפחתית סביב שולחנות ארוכים עם פשתן טבעי.', category: 'DESIGN', estCostMin: 5000, estCostMax: 12000, sortOrder: 10 },
      { title_en: 'Citrus & olive branch centerpieces', title_he: 'מרכזי שולחן מהדרים וענפי זית', description_en: 'Lemons, olive branches and wildflowers down the table.', description_he: 'לימונים, ענפי זית ופרחי בר לאורך השולחן.', category: 'FLOWERS', estCostMin: 3000, estCostMax: 8000, sortOrder: 20 },
      { title_en: 'Al-fresco antipasti table', title_he: 'שולחן אנטיפסטי בחוץ', description_en: 'A grazing table of Italian antipasti as guests arrive.', description_he: 'שולחן אנטיפסטי איטלקי לקבלת הפנים.', category: 'CATERING', estCostMin: 4000, estCostMax: 10000, sortOrder: 30 },
    ],
  },
  {
    id: 'concept-old-money',
    title_en: 'Old Money',
    title_he: 'אלגנטיות קלאסית',
    tagline_en: 'Timeless, heirloom, effortlessly grand',
    tagline_he: 'נצחי, מסורתי, מפואר בטבעיות',
    description_en: 'Understated luxury — heirloom details, a muted palette and classic florals for a wedding that feels inherited, not bought.',
    description_he: 'יוקרה מאופקת — פרטים מסורתיים, פלטה עמומה ופרחים קלאסיים לחתונה שמרגישה מורשת, לא קנויה.',
    palette: ['#7A1F2B', '#C9A227', '#F5F0E6', '#1F3D2B'],
    isPremium: true,
    sortOrder: 30,
    images: [
      { url: 'https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6', alt_en: 'Elegant classic wedding setup', alt_he: 'הפקת חתונה קלאסית ואלגנטית', sortOrder: 0 },
    ],
    elements: [
      { title_en: 'Classic string quartet for the ceremony', title_he: 'רביעיית מיתרים קלאסית לטקס', description_en: 'A live string quartet during the ceremony and reception.', description_he: 'רביעיית מיתרים חיה בטקס ובקבלת הפנים.', category: 'MUSIC', estCostMin: 4000, estCostMax: 9000, sortOrder: 10 },
      { title_en: 'Monochrome white florals in silver', title_he: 'פרחים לבנים מונוכרומטיים בכלי כסף', description_en: 'White roses and peonies in polished silver vessels.', description_he: 'ורדים ואדמוניות לבנות בכלי כסף מלוטשים.', category: 'FLOWERS', estCostMin: 6000, estCostMax: 15000, sortOrder: 20 },
      { title_en: 'Engraved heirloom-style stationery', title_he: 'הזמנות מודפסות בסגנון מסורתי', description_en: 'Letterpress invitations and place cards with monogram.', description_he: 'הזמנות בהדפס בלט וכרטיסי מקום עם מונוגרמה.', category: 'DESIGN', estCostMin: 2000, estCostMax: 6000, sortOrder: 30 },
    ],
  },
  {
    id: 'concept-modern-luxury',
    title_en: 'Modern Luxury',
    title_he: 'יוקרה מודרנית',
    tagline_en: 'Architectural, refined, unforgettable',
    tagline_he: 'אדריכלי, מוקפד, בלתי נשכח',
    description_en: 'Clean lines, statement florals and a monochrome palette punctuated by metallic accents — a wedding that feels like a private gallery opening.',
    description_he: 'קווים נקיים, פרחים סטייטמנט ופלטה מונוכרומטית עם נגיעות מטאליות — חתונה שמרגישה כמו פתיחת גלריה פרטית.',
    palette: ['#E8E8E8', '#C9A227', '#FFFFFF', '#1C1C1C'],
    isPremium: true,
    sortOrder: 40,
    images: [
      { url: 'https://images.unsplash.com/photo-1522413452208-996ff3f3e740', alt_en: 'Modern minimalist wedding table', alt_he: 'שולחן חתונה מודרני מינימליסטי', sortOrder: 0 },
    ],
    elements: [
      { title_en: 'Monochrome white orchids in tall glass', title_he: 'סחלבים לבנים בכלי זכוכית גבוהים', description_en: 'Monochrome white orchids and anthurium in tall glass vessels.', description_he: 'סחלבים לבנים ואנתוריום בכלי זכוכית גבוהים.', category: 'FLOWERS', estCostMin: 7000, estCostMax: 16000, sortOrder: 10 },
      { title_en: 'Sculptural installations & acrylic signage', title_he: 'מיצבים פיסוליים ושילוט אקרילי', description_en: 'Sculptural installations, acrylic signage and taper candles in brass holders.', description_he: 'מיצבים פיסוליים, שילוט אקרילי ונרות בכלי פליז.', category: 'DESIGN', estCostMin: 5000, estCostMax: 13000, sortOrder: 20 },
      { title_en: 'Sleek minimalist gown', title_he: 'שמלה מינימליסטית מוקפדת', description_en: 'A sleek minimalist gown with architectural lines.', description_he: 'שמלה מינימליסטית עם קווים אדריכליים.', category: 'ATTIRE', estCostMin: 8000, estCostMax: 25000, sortOrder: 30 },
    ],
  },
];
```

- [ ] **Step 5: Write the concept upsert in the seed's `main()`**

Inside `main()` in `prisma/seed.ts`, after the existing template loop and its `console.log`, add the concept upsert. Concepts upsert by stable `id`; images/elements are replaced (deleteMany then create) so re-seeding stays idempotent and reflects edits to the seed file.

```typescript
  for (const c of concepts) {
    await prisma.concept.upsert({
      where: { id: c.id },
      create: {
        id: c.id,
        title_en: c.title_en, title_he: c.title_he, titleLocale: 'AUTO',
        tagline_en: c.tagline_en, tagline_he: c.tagline_he,
        description_en: c.description_en, description_he: c.description_he,
        palette: c.palette, isPremium: c.isPremium, active: true, sortOrder: c.sortOrder,
      },
      update: {
        title_en: c.title_en, title_he: c.title_he, titleLocale: 'AUTO',
        tagline_en: c.tagline_en, tagline_he: c.tagline_he,
        description_en: c.description_en, description_he: c.description_he,
        palette: c.palette, isPremium: c.isPremium, active: true, sortOrder: c.sortOrder,
      },
    });
    // Replace child rows so a re-seed reflects the seed file exactly.
    await prisma.conceptImage.deleteMany({ where: { conceptId: c.id } });
    await prisma.conceptElement.deleteMany({ where: { conceptId: c.id } });
    await prisma.conceptImage.createMany({
      data: c.images.map((im) => ({ conceptId: c.id, ...im })),
    });
    await prisma.conceptElement.createMany({
      data: c.elements.map((el) => ({ conceptId: c.id, titleLocale: 'AUTO', active: true, ...el })),
    });
  }

  console.log(`Seeded ${concepts.length} wedding concepts.`);
```

- [ ] **Step 6: Run the seed twice to confirm idempotency**

Run: `npm run db:seed && npm run db:seed`
Expected: both runs finish with "Seeded 4 wedding concepts." and no unique-constraint errors. (The deleteMany-then-create keeps child counts stable across runs.)

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations prisma/seed.ts
git commit -m "feat: add wedding-concepts schema, migration, and concept seed"
```

---

### Task 2: Title resolver, Zod schemas & queries

**Files:**
- Create: `lib/concepts/title.ts`, `lib/concepts/title.test.ts`
- Create: `lib/concepts/schema.ts`, `lib/concepts/schema.test.ts`
- Create: `lib/concepts/queries.ts`, `lib/concepts/queries.test.ts`

**Interfaces:**
- Consumes: `resolveTaskTitle` from `@/lib/checklist/title` (generic over `{title_en,title_he,titleLocale}`), `prisma` from `@/lib/db`.
- Produces:
  - `resolveConceptTitle(item, locale): string`
  - `conceptSchema`, `conceptElementSchema`, `conceptImageSchema` (Zod), `CATEGORY_OPTIONS`.
  - `getActiveConcepts()`, `getAllConcepts()`, `getConceptDetail(id)`, `getWeddingConceptState(weddingId)`, `elementToTaskPayload(element)`.

- [ ] **Step 1: Write the title resolver test**

`lib/concepts/title.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { resolveConceptTitle } from './title';

describe('resolveConceptTitle', () => {
  const item = { title_en: 'Old Money', title_he: 'אלגנטיות קלאסית', titleLocale: 'AUTO' as const };

  it('defaults to the couple locale under AUTO', () => {
    expect(resolveConceptTitle(item, 'he')).toBe('אלגנטיות קלאסית');
    expect(resolveConceptTitle(item, 'en')).toBe('Old Money');
  });

  it('honors a pinned locale regardless of UI language', () => {
    expect(resolveConceptTitle({ ...item, titleLocale: 'EN' }, 'he')).toBe('Old Money');
    expect(resolveConceptTitle({ ...item, titleLocale: 'HE' }, 'en')).toBe('אלגנטיות קלאסית');
  });

  it('falls back to the other language when the primary is empty', () => {
    expect(resolveConceptTitle({ title_en: '', title_he: 'רק עברית', titleLocale: 'AUTO' }, 'en')).toBe('רק עברית');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test -- lib/concepts/title.test.ts`
Expected: FAIL ("Cannot find module './title'").

- [ ] **Step 3: Implement the resolver**

`lib/concepts/title.ts` (delegates to the Phase 3 resolver, which is already generic):

```typescript
import type { TitleLocale } from '@prisma/client';
import { resolveTaskTitle } from '@/lib/checklist/title';

/** Resolve a concept/element's display title for the given locale. */
export function resolveConceptTitle(
  item: { title_en: string; title_he: string; titleLocale: TitleLocale },
  locale: string,
): string {
  return resolveTaskTitle(item, locale);
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm run test -- lib/concepts/title.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the schema test**

`lib/concepts/schema.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { conceptSchema, conceptElementSchema, conceptImageSchema } from './schema';

describe('conceptSchema', () => {
  const base = { title_en: 'Old Money', title_he: 'אלגנטיות', palette: ['#7A1F2B', '#C9A227'] };

  it('accepts valid input and defaults flags', () => {
    const r = conceptSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.isPremium).toBe(false);
      expect(r.data.active).toBe(true);
      expect(r.data.titleLocale).toBe('AUTO');
    }
  });

  it('rejects a missing title', () => {
    expect(conceptSchema.safeParse({ ...base, title_he: '' }).success).toBe(false);
  });

  it('rejects a non-hex palette entry', () => {
    expect(conceptSchema.safeParse({ ...base, palette: ['red'] }).success).toBe(false);
  });
});

describe('conceptElementSchema', () => {
  const base = { title_en: 'Two DJs', title_he: 'שני תקליטנים', category: 'MUSIC' };

  it('accepts a valid element with a cost range', () => {
    expect(conceptElementSchema.safeParse({ ...base, estCostMin: 6000, estCostMax: 14000 }).success).toBe(true);
  });

  it('rejects an inverted cost range', () => {
    expect(conceptElementSchema.safeParse({ ...base, estCostMin: 14000, estCostMax: 6000 }).success).toBe(false);
  });

  it('rejects an unknown category', () => {
    expect(conceptElementSchema.safeParse({ ...base, category: 'NOPE' }).success).toBe(false);
  });
});

describe('conceptImageSchema', () => {
  it('requires a URL', () => {
    expect(conceptImageSchema.safeParse({ url: '' }).success).toBe(false);
    expect(conceptImageSchema.safeParse({ url: 'https://x.test/a.jpg' }).success).toBe(true);
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npm run test -- lib/concepts/schema.test.ts`
Expected: FAIL ("Cannot find module './schema'").

- [ ] **Step 7: Implement the schemas**

`lib/concepts/schema.ts`:

```typescript
import { z } from 'zod';
import { TaskCategory, TitleLocale } from '@prisma/client';

export const CATEGORY_OPTIONS = Object.values(TaskCategory);
export const TITLE_LOCALE_OPTIONS = Object.values(TitleLocale);

const hex = z.string().regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'invalid hex');

export const conceptSchema = z.object({
  title_en: z.string().trim().min(1).max(120),
  title_he: z.string().trim().min(1).max(120),
  titleLocale: z.nativeEnum(TitleLocale).default(TitleLocale.AUTO),
  tagline_en: z.string().trim().max(200).nullish(),
  tagline_he: z.string().trim().max(200).nullish(),
  description_en: z.string().trim().max(2000).nullish(),
  description_he: z.string().trim().max(2000).nullish(),
  palette: z.array(hex).max(8).default([]),
  isPremium: z.boolean().default(false),
  active: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

export const conceptElementSchema = z
  .object({
    title_en: z.string().trim().min(1).max(200),
    title_he: z.string().trim().min(1).max(200),
    titleLocale: z.nativeEnum(TitleLocale).default(TitleLocale.AUTO),
    description_en: z.string().trim().max(1000).nullish(),
    description_he: z.string().trim().max(1000).nullish(),
    category: z.nativeEnum(TaskCategory),
    estCostMin: z.number().int().min(0).nullish(),
    estCostMax: z.number().int().min(0).nullish(),
    active: z.boolean().default(true),
    sortOrder: z.number().int().default(0),
  })
  .refine(
    (v) => v.estCostMin == null || v.estCostMax == null || v.estCostMin <= v.estCostMax,
    { message: 'estCostMin must be <= estCostMax', path: ['estCostMax'] },
  );

export const conceptImageSchema = z.object({
  url: z.string().trim().url().max(2000),
  alt_en: z.string().trim().max(200).nullish(),
  alt_he: z.string().trim().max(200).nullish(),
  sortOrder: z.number().int().default(0),
});
```

- [ ] **Step 8: Run it to verify it passes**

Run: `npm run test -- lib/concepts/schema.test.ts`
Expected: PASS.

- [ ] **Step 9: Write the queries test**

`lib/concepts/queries.test.ts` (unit-tests the pure `elementToTaskPayload`; the DB-backed queries are exercised end-to-end in the e2e task):

```typescript
import { describe, it, expect } from 'vitest';
import { elementToTaskPayload } from './queries';

describe('elementToTaskPayload', () => {
  it('maps an element into a self-contained Task snapshot payload', () => {
    const el = {
      id: 'el1', conceptId: 'c1',
      title_en: 'Two DJs', title_he: 'שני תקליטנים', titleLocale: 'AUTO' as const,
      description_en: null, description_he: null,
      category: 'MUSIC' as const, estCostMin: 6000, estCostMax: 14000,
      active: true, sortOrder: 10,
    };
    const payload = elementToTaskPayload('wed1', el, 42);
    expect(payload).toMatchObject({
      weddingId: 'wed1',
      title_en: 'Two DJs',
      title_he: 'שני תקליטנים',
      titleLocale: 'AUTO',
      category: 'MUSIC',
      dueOffsetDays: null,
      isCustom: true,
      sourceConceptElementId: 'el1',
      sortOrder: 42,
    });
  });
});
```

- [ ] **Step 10: Run it to verify it fails**

Run: `npm run test -- lib/concepts/queries.test.ts`
Expected: FAIL ("Cannot find module './queries'").

- [ ] **Step 11: Implement the queries**

`lib/concepts/queries.ts`:

```typescript
import { prisma } from '@/lib/db';
import type { ConceptElement, Prisma } from '@prisma/client';

export function getActiveConcepts() {
  return prisma.concept.findMany({
    where: { active: true },
    include: { images: { orderBy: { sortOrder: 'asc' } } },
    orderBy: { sortOrder: 'asc' },
  });
}

export function getAllConcepts() {
  return prisma.concept.findMany({
    include: {
      images: { orderBy: { sortOrder: 'asc' } },
      elements: { orderBy: { sortOrder: 'asc' } },
    },
    orderBy: { sortOrder: 'asc' },
  });
}

export function getConceptDetail(id: string) {
  return prisma.concept.findUnique({
    where: { id },
    include: {
      images: { orderBy: { sortOrder: 'asc' } },
      elements: { where: { active: true }, orderBy: { sortOrder: 'asc' } },
    },
  });
}

/** The couple's selection + favorites + which element ids already have a live pushed task. */
export async function getWeddingConceptState(weddingId: string): Promise<{
  selectedConceptId: string | null;
  favoriteConceptIds: string[];
  pushedElementIds: string[];
}> {
  const [wedding, favorites, pushed] = await Promise.all([
    prisma.wedding.findUnique({ where: { id: weddingId }, select: { selectedConceptId: true } }),
    prisma.conceptFavorite.findMany({ where: { weddingId }, select: { conceptId: true } }),
    prisma.task.findMany({
      where: { weddingId, deletedAt: null, sourceConceptElementId: { not: null } },
      select: { sourceConceptElementId: true },
    }),
  ]);
  return {
    selectedConceptId: wedding?.selectedConceptId ?? null,
    favoriteConceptIds: favorites.map((f) => f.conceptId),
    pushedElementIds: pushed.map((p) => p.sourceConceptElementId!).filter(Boolean),
  };
}

/** Map a concept element into a Task-create payload (self-contained snapshot). */
export function elementToTaskPayload(
  weddingId: string,
  element: Pick<ConceptElement, 'id' | 'title_en' | 'title_he' | 'titleLocale' | 'category'>,
  sortOrder: number,
): Prisma.TaskUncheckedCreateInput {
  return {
    weddingId,
    title_en: element.title_en,
    title_he: element.title_he,
    titleLocale: element.titleLocale,
    category: element.category,
    dueOffsetDays: null,
    isCustom: true,
    sourceConceptElementId: element.id,
    sortOrder,
  };
}
```

- [ ] **Step 12: Run it to verify it passes; run the whole concepts suite**

Run: `npm run test -- lib/concepts`
Expected: all three files PASS.

- [ ] **Step 13: Commit**

```bash
git add lib/concepts
git commit -m "feat: add concept title resolver, Zod schemas, and queries"
```

---

### Task 3: Couple server actions

**Files:**
- Create: `lib/actions/concepts.ts`, `lib/actions/concepts.test.ts`

**Interfaces:**
- Consumes: `auth` from `@/lib/auth`; `prisma`; `getCurrentWedding` from `@/lib/wedding/queries`; `getConceptDetail`, `elementToTaskPayload` from `@/lib/concepts/queries`.
- Produces:
  - `type ConceptActionResult = { ok: true } | { ok: false; error: 'UNAUTHENTICATED' | 'INVALID' | 'NOT_FOUND' }`
  - `chooseConcept(conceptId): Promise<ConceptActionResult>`
  - `clearSelectedConcept(): Promise<ConceptActionResult>`
  - `toggleFavorite(conceptId): Promise<ConceptActionResult>`
  - `addElementToChecklist(elementId): Promise<ConceptActionResult>`

- [ ] **Step 1: Write the actions test**

`lib/actions/concepts.test.ts` — mock `@/lib/auth`, `@/lib/db`, `@/lib/wedding/queries` in the style of `lib/actions/checklist.test.ts` (read that file first for the exact mocking idiom). Cover: unauthenticated rejection; choose sets `selectedConceptId`; choose rejects an inactive/missing concept; toggleFavorite creates then deletes; addElementToChecklist creates a snapshot Task; addElementToChecklist is a no-op when a live copy exists; ownership rejection when the element/concept resolves but the wedding differs.

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/wedding/queries', () => ({ getCurrentWedding: vi.fn() }));
vi.mock('@/lib/db', () => ({
  prisma: {
    concept: { findUnique: vi.fn() },
    conceptElement: { findUnique: vi.fn() },
    conceptFavorite: { findUnique: vi.fn(), create: vi.fn(), delete: vi.fn() },
    wedding: { update: vi.fn() },
    task: { findFirst: vi.fn(), aggregate: vi.fn(), create: vi.fn() },
  },
}));

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getCurrentWedding } from '@/lib/wedding/queries';
import { chooseConcept, toggleFavorite, addElementToChecklist } from './concepts';

const authed = { user: { id: 'u1' } };

beforeEach(() => {
  vi.clearAllMocks();
  (auth as unknown as vi.Mock).mockResolvedValue(authed);
  (getCurrentWedding as unknown as vi.Mock).mockResolvedValue({ id: 'wed1', weddingDate: null });
});

describe('chooseConcept', () => {
  it('rejects when unauthenticated', async () => {
    (auth as unknown as vi.Mock).mockResolvedValue(null);
    expect(await chooseConcept('c1')).toEqual({ ok: false, error: 'UNAUTHENTICATED' });
  });

  it('sets the selected concept for an active concept', async () => {
    (prisma.concept.findUnique as vi.Mock).mockResolvedValue({ id: 'c1', active: true });
    expect(await chooseConcept('c1')).toEqual({ ok: true });
    expect(prisma.wedding.update).toHaveBeenCalledWith({
      where: { id: 'wed1' }, data: { selectedConceptId: 'c1' },
    });
  });

  it('rejects an inactive/missing concept', async () => {
    (prisma.concept.findUnique as vi.Mock).mockResolvedValue(null);
    expect(await chooseConcept('c1')).toEqual({ ok: false, error: 'NOT_FOUND' });
  });
});

describe('toggleFavorite', () => {
  it('creates a favorite when none exists', async () => {
    (prisma.concept.findUnique as vi.Mock).mockResolvedValue({ id: 'c1', active: true });
    (prisma.conceptFavorite.findUnique as vi.Mock).mockResolvedValue(null);
    expect(await toggleFavorite('c1')).toEqual({ ok: true });
    expect(prisma.conceptFavorite.create).toHaveBeenCalled();
  });

  it('removes a favorite when one exists', async () => {
    (prisma.concept.findUnique as vi.Mock).mockResolvedValue({ id: 'c1', active: true });
    (prisma.conceptFavorite.findUnique as vi.Mock).mockResolvedValue({ id: 'f1' });
    expect(await toggleFavorite('c1')).toEqual({ ok: true });
    expect(prisma.conceptFavorite.delete).toHaveBeenCalledWith({ where: { id: 'f1' } });
  });
});

describe('addElementToChecklist', () => {
  const element = { id: 'el1', conceptId: 'c1', title_en: 'Two DJs', title_he: 'שני תקליטנים', titleLocale: 'AUTO', category: 'MUSIC' };

  it('creates a snapshot task when none is live', async () => {
    (prisma.conceptElement.findUnique as vi.Mock).mockResolvedValue(element);
    (prisma.task.findFirst as vi.Mock).mockResolvedValue(null);
    (prisma.task.aggregate as vi.Mock).mockResolvedValue({ _max: { sortOrder: 5 } });
    expect(await addElementToChecklist('el1')).toEqual({ ok: true });
    expect(prisma.task.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ weddingId: 'wed1', sourceConceptElementId: 'el1', isCustom: true, category: 'MUSIC', sortOrder: 6 }),
    });
  });

  it('is a no-op when a live copy already exists', async () => {
    (prisma.conceptElement.findUnique as vi.Mock).mockResolvedValue(element);
    (prisma.task.findFirst as vi.Mock).mockResolvedValue({ id: 't-existing' });
    expect(await addElementToChecklist('el1')).toEqual({ ok: true });
    expect(prisma.task.create).not.toHaveBeenCalled();
  });

  it('rejects a missing element', async () => {
    (prisma.conceptElement.findUnique as vi.Mock).mockResolvedValue(null);
    expect(await addElementToChecklist('elX')).toEqual({ ok: false, error: 'NOT_FOUND' });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test -- lib/actions/concepts.test.ts`
Expected: FAIL ("Cannot find module './concepts'").

- [ ] **Step 3: Implement the couple actions**

`lib/actions/concepts.ts`:

```typescript
'use server';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getCurrentWedding } from '@/lib/wedding/queries';
import { elementToTaskPayload } from '@/lib/concepts/queries';

export type ConceptActionResult =
  | { ok: true }
  | { ok: false; error: 'UNAUTHENTICATED' | 'INVALID' | 'NOT_FOUND' };

async function requireWedding(): Promise<{ id: string } | null> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;
  const wedding = await getCurrentWedding(userId);
  return wedding ? { id: wedding.id } : null;
}

export async function chooseConcept(conceptId: string): Promise<ConceptActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: 'UNAUTHENTICATED' };
  const wedding = await getCurrentWedding(session.user.id);
  if (!wedding) return { ok: false, error: 'NOT_FOUND' };
  const concept = await prisma.concept.findUnique({ where: { id: conceptId }, select: { id: true, active: true } });
  if (!concept || !concept.active) return { ok: false, error: 'NOT_FOUND' };
  await prisma.wedding.update({ where: { id: wedding.id }, data: { selectedConceptId: conceptId } });
  return { ok: true };
}

export async function clearSelectedConcept(): Promise<ConceptActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: 'UNAUTHENTICATED' };
  const wedding = await getCurrentWedding(session.user.id);
  if (!wedding) return { ok: false, error: 'NOT_FOUND' };
  await prisma.wedding.update({ where: { id: wedding.id }, data: { selectedConceptId: null } });
  return { ok: true };
}

export async function toggleFavorite(conceptId: string): Promise<ConceptActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: 'UNAUTHENTICATED' };
  const wedding = await getCurrentWedding(session.user.id);
  if (!wedding) return { ok: false, error: 'NOT_FOUND' };
  const concept = await prisma.concept.findUnique({ where: { id: conceptId }, select: { id: true, active: true } });
  if (!concept || !concept.active) return { ok: false, error: 'NOT_FOUND' };
  const existing = await prisma.conceptFavorite.findUnique({
    where: { weddingId_conceptId: { weddingId: wedding.id, conceptId } },
  });
  if (existing) {
    await prisma.conceptFavorite.delete({ where: { id: existing.id } });
  } else {
    await prisma.conceptFavorite.create({ data: { weddingId: wedding.id, conceptId } });
  }
  return { ok: true };
}

export async function addElementToChecklist(elementId: string): Promise<ConceptActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: 'UNAUTHENTICATED' };
  const wedding = await getCurrentWedding(session.user.id);
  if (!wedding) return { ok: false, error: 'NOT_FOUND' };
  const element = await prisma.conceptElement.findUnique({ where: { id: elementId } });
  if (!element) return { ok: false, error: 'NOT_FOUND' };
  // Add-once-while-live: no-op if a non-deleted copy already exists.
  const live = await prisma.task.findFirst({
    where: { weddingId: wedding.id, deletedAt: null, sourceConceptElementId: elementId },
    select: { id: true },
  });
  if (live) return { ok: true };
  const agg = await prisma.task.aggregate({ where: { weddingId: wedding.id }, _max: { sortOrder: true } });
  const sortOrder = (agg._max.sortOrder ?? -1) + 1;
  await prisma.task.create({ data: elementToTaskPayload(wedding.id, element, sortOrder) });
  return { ok: true };
}
```

Note: `requireWedding` is provided for symmetry but the actions inline the session+wedding resolution to keep the error branches explicit; remove `requireWedding` if the linter flags it as unused.

- [ ] **Step 4: Run it to verify it passes**

Run: `npm run test -- lib/actions/concepts.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck & lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS (remove the unused `requireWedding` helper if lint complains).

- [ ] **Step 6: Commit**

```bash
git add lib/actions/concepts.ts lib/actions/concepts.test.ts
git commit -m "feat: add couple concept actions (choose/favorite/push-to-checklist)"
```

---

### Task 4: Admin server actions

**Files:**
- Create: `lib/actions/admin-concepts.ts`, `lib/actions/admin-concepts.test.ts`

**Interfaces:**
- Consumes: `auth`, `prisma`; `conceptSchema`, `conceptElementSchema`, `conceptImageSchema` from `@/lib/concepts/schema`.
- Produces:
  - `type AdminResult = { ok: true; id?: string } | { ok: false; error: 'FORBIDDEN' | 'INVALID' | 'NOT_FOUND' }`
  - Concept: `createConcept`, `updateConcept(id, input)`, `deleteConcept(id)`, `setConceptActive(id, active)`, `setConceptPremium(id, isPremium)`, `reorderConcept(id, sortOrder)`.
  - Element: `createElement(conceptId, input)`, `updateElement(id, input)`, `deleteElement(id)`, `reorderElement(id, sortOrder)`.
  - Image: `addImage(conceptId, input)`, `updateImage(id, input)`, `deleteImage(id)`, `reorderImage(id, sortOrder)`.

- [ ] **Step 1: Write the admin actions test**

`lib/actions/admin-concepts.test.ts` — mirror `lib/actions/admin-templates.test.ts` (read it first for the `requireAdmin` mocking idiom). Cover: non-admin → FORBIDDEN on a representative mutation; create happy path returns an id; invalid input → INVALID; update of a missing concept → NOT_FOUND; deleteConcept nulls `Task.sourceConceptElementId` for its elements' pushed tasks.

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/db', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    concept: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn(), delete: vi.fn() },
    conceptElement: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn(), delete: vi.fn(), findMany: vi.fn() },
    conceptImage: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn(), delete: vi.fn() },
    task: { updateMany: vi.fn() },
    $transaction: vi.fn(async (ops) => (typeof ops === 'function' ? ops() : Promise.all(ops))),
  },
}));

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { createConcept, updateConcept, deleteConcept } from './admin-concepts';

function asAdmin(isAdmin: boolean) {
  (auth as unknown as vi.Mock).mockResolvedValue(isAdmin ? { user: { id: 'a1' } } : null);
  (prisma.user.findUnique as vi.Mock).mockResolvedValue(isAdmin ? { role: 'ADMIN' } : { role: 'USER' });
}

beforeEach(() => vi.clearAllMocks());

describe('createConcept', () => {
  it('rejects a non-admin', async () => {
    asAdmin(false);
    expect(await createConcept({ title_en: 'X', title_he: 'י' })).toEqual({ ok: false, error: 'FORBIDDEN' });
  });

  it('creates for an admin and returns the id', async () => {
    asAdmin(true);
    (prisma.concept.create as vi.Mock).mockResolvedValue({ id: 'c-new' });
    const r = await createConcept({ title_en: 'Old Money', title_he: 'אלגנטיות', palette: ['#C9A227'] });
    expect(r).toEqual({ ok: true, id: 'c-new' });
  });

  it('rejects invalid input', async () => {
    asAdmin(true);
    expect(await createConcept({ title_en: '', title_he: '' })).toEqual({ ok: false, error: 'INVALID' });
  });
});

describe('deleteConcept', () => {
  it('nulls pushed-task provenance then deletes', async () => {
    asAdmin(true);
    (prisma.concept.findUnique as vi.Mock).mockResolvedValue({ id: 'c1' });
    (prisma.conceptElement.findMany as vi.Mock).mockResolvedValue([{ id: 'el1' }, { id: 'el2' }]);
    const r = await deleteConcept('c1');
    expect(r).toEqual({ ok: true, id: 'c1' });
    expect(prisma.task.updateMany).toHaveBeenCalledWith({
      where: { sourceConceptElementId: { in: ['el1', 'el2'] } },
      data: { sourceConceptElementId: null },
    });
    expect(prisma.concept.delete).toHaveBeenCalledWith({ where: { id: 'c1' } });
  });
});

describe('updateConcept', () => {
  it('returns NOT_FOUND for a missing concept', async () => {
    asAdmin(true);
    (prisma.concept.findUnique as vi.Mock).mockResolvedValue(null);
    expect(await updateConcept('cX', { title_en: 'A', title_he: 'ב' })).toEqual({ ok: false, error: 'NOT_FOUND' });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test -- lib/actions/admin-concepts.test.ts`
Expected: FAIL ("Cannot find module './admin-concepts'").

- [ ] **Step 3: Implement the admin actions**

`lib/actions/admin-concepts.ts`:

```typescript
'use server';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { conceptSchema, conceptElementSchema, conceptImageSchema } from '@/lib/concepts/schema';

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

// ---- Concept ----
export async function createConcept(input: unknown): Promise<AdminResult> {
  if (!(await requireAdmin())) return { ok: false, error: 'FORBIDDEN' };
  const parsed = conceptSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'INVALID' };
  const created = await prisma.concept.create({ data: parsed.data });
  return { ok: true, id: created.id };
}

export async function updateConcept(id: string, input: unknown): Promise<AdminResult> {
  if (!(await requireAdmin())) return { ok: false, error: 'FORBIDDEN' };
  const parsed = conceptSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'INVALID' };
  const existing = await prisma.concept.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return { ok: false, error: 'NOT_FOUND' };
  await prisma.concept.update({ where: { id }, data: parsed.data });
  return { ok: true, id };
}

export async function deleteConcept(id: string): Promise<AdminResult> {
  if (!(await requireAdmin())) return { ok: false, error: 'FORBIDDEN' };
  const existing = await prisma.concept.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return { ok: false, error: 'NOT_FOUND' };
  // Elements cascade-delete with the concept, but pushed tasks keep a dangling
  // provenance id; null it first so those tasks stay clean.
  const elements = await prisma.conceptElement.findMany({ where: { conceptId: id }, select: { id: true } });
  await prisma.$transaction([
    prisma.task.updateMany({
      where: { sourceConceptElementId: { in: elements.map((e) => e.id) } },
      data: { sourceConceptElementId: null },
    }),
    prisma.concept.delete({ where: { id } }),
  ]);
  return { ok: true, id };
}

export async function setConceptActive(id: string, active: boolean): Promise<AdminResult> {
  if (!(await requireAdmin())) return { ok: false, error: 'FORBIDDEN' };
  const existing = await prisma.concept.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return { ok: false, error: 'NOT_FOUND' };
  await prisma.concept.update({ where: { id }, data: { active } });
  return { ok: true, id };
}

export async function setConceptPremium(id: string, isPremium: boolean): Promise<AdminResult> {
  if (!(await requireAdmin())) return { ok: false, error: 'FORBIDDEN' };
  const existing = await prisma.concept.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return { ok: false, error: 'NOT_FOUND' };
  await prisma.concept.update({ where: { id }, data: { isPremium } });
  return { ok: true, id };
}

export async function reorderConcept(id: string, sortOrder: number): Promise<AdminResult> {
  if (!(await requireAdmin())) return { ok: false, error: 'FORBIDDEN' };
  if (!Number.isInteger(sortOrder)) return { ok: false, error: 'INVALID' };
  const existing = await prisma.concept.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return { ok: false, error: 'NOT_FOUND' };
  await prisma.concept.update({ where: { id }, data: { sortOrder } });
  return { ok: true, id };
}

// ---- Element ----
export async function createElement(conceptId: string, input: unknown): Promise<AdminResult> {
  if (!(await requireAdmin())) return { ok: false, error: 'FORBIDDEN' };
  const parsed = conceptElementSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'INVALID' };
  const concept = await prisma.concept.findUnique({ where: { id: conceptId }, select: { id: true } });
  if (!concept) return { ok: false, error: 'NOT_FOUND' };
  const created = await prisma.conceptElement.create({ data: { conceptId, ...parsed.data } });
  return { ok: true, id: created.id };
}

export async function updateElement(id: string, input: unknown): Promise<AdminResult> {
  if (!(await requireAdmin())) return { ok: false, error: 'FORBIDDEN' };
  const parsed = conceptElementSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'INVALID' };
  const existing = await prisma.conceptElement.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return { ok: false, error: 'NOT_FOUND' };
  await prisma.conceptElement.update({ where: { id }, data: parsed.data });
  return { ok: true, id };
}

export async function deleteElement(id: string): Promise<AdminResult> {
  if (!(await requireAdmin())) return { ok: false, error: 'FORBIDDEN' };
  const existing = await prisma.conceptElement.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return { ok: false, error: 'NOT_FOUND' };
  await prisma.$transaction([
    prisma.task.updateMany({ where: { sourceConceptElementId: id }, data: { sourceConceptElementId: null } }),
    prisma.conceptElement.delete({ where: { id } }),
  ]);
  return { ok: true, id };
}

export async function reorderElement(id: string, sortOrder: number): Promise<AdminResult> {
  if (!(await requireAdmin())) return { ok: false, error: 'FORBIDDEN' };
  if (!Number.isInteger(sortOrder)) return { ok: false, error: 'INVALID' };
  const existing = await prisma.conceptElement.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return { ok: false, error: 'NOT_FOUND' };
  await prisma.conceptElement.update({ where: { id }, data: { sortOrder } });
  return { ok: true, id };
}

// ---- Image ----
export async function addImage(conceptId: string, input: unknown): Promise<AdminResult> {
  if (!(await requireAdmin())) return { ok: false, error: 'FORBIDDEN' };
  const parsed = conceptImageSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'INVALID' };
  const concept = await prisma.concept.findUnique({ where: { id: conceptId }, select: { id: true } });
  if (!concept) return { ok: false, error: 'NOT_FOUND' };
  const created = await prisma.conceptImage.create({ data: { conceptId, ...parsed.data } });
  return { ok: true, id: created.id };
}

export async function updateImage(id: string, input: unknown): Promise<AdminResult> {
  if (!(await requireAdmin())) return { ok: false, error: 'FORBIDDEN' };
  const parsed = conceptImageSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'INVALID' };
  const existing = await prisma.conceptImage.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return { ok: false, error: 'NOT_FOUND' };
  await prisma.conceptImage.update({ where: { id }, data: parsed.data });
  return { ok: true, id };
}

export async function deleteImage(id: string): Promise<AdminResult> {
  if (!(await requireAdmin())) return { ok: false, error: 'FORBIDDEN' };
  const existing = await prisma.conceptImage.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return { ok: false, error: 'NOT_FOUND' };
  await prisma.conceptImage.delete({ where: { id } });
  return { ok: true, id };
}

export async function reorderImage(id: string, sortOrder: number): Promise<AdminResult> {
  if (!(await requireAdmin())) return { ok: false, error: 'FORBIDDEN' };
  if (!Number.isInteger(sortOrder)) return { ok: false, error: 'INVALID' };
  const existing = await prisma.conceptImage.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return { ok: false, error: 'NOT_FOUND' };
  await prisma.conceptImage.update({ where: { id }, data: { sortOrder } });
  return { ok: true, id };
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm run test -- lib/actions/admin-concepts.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/actions/admin-concepts.ts lib/actions/admin-concepts.test.ts
git commit -m "feat: add ADMIN concept/element/image CRUD actions"
```

---

### Task 5: Proxy login-gate + i18n message namespaces

**Files:**
- Modify: `lib/auth/authorize.ts:6`
- Modify: `lib/auth/authorize.test.ts`
- Modify: `messages/he.json`, `messages/en.json`

**Interfaces:**
- Produces: `/concepts` login-gated; `Concepts`, `AdminConcepts` message namespaces; `Dashboard.chooseConcept*` keys.

- [ ] **Step 1: Add a failing gate test**

In `lib/auth/authorize.test.ts`, add (match the file's existing test style):

```typescript
  it('redirects logged-out users away from /concepts', () => {
    expect(authorizeRoute({ pathname: '/concepts', isLoggedIn: false, role: null }))
      .toEqual({ type: 'redirect', to: '/login' });
  });

  it('allows logged-in users to reach /concepts', () => {
    expect(authorizeRoute({ pathname: '/concepts', isLoggedIn: true, role: 'USER' }))
      .toEqual({ type: 'next' });
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test -- lib/auth/authorize.test.ts`
Expected: FAIL (`/concepts` currently falls through to `{ type: 'next' }` even when logged out).

- [ ] **Step 3: Add `/concepts` to APP_PREFIXES**

In `lib/auth/authorize.ts`, line 6:

```typescript
const APP_PREFIXES = ['/dashboard', '/onboarding', '/settings', '/checklist', '/concepts'];
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm run test -- lib/auth/authorize.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the message namespaces**

Add a `Concepts` and `AdminConcepts` block to **both** `messages/he.json` and `messages/en.json`, and extend `Dashboard`. English values:

```json
"Concepts": {
  "title": "Concept Library",
  "subtitle": "Worlds designed with care. Choose a concept and shape your day around it.",
  "premium": "PREMIUM",
  "favorite": "Save",
  "favorited": "Saved",
  "selected": "Your concept",
  "select": "Select this concept",
  "clearSelection": "Remove selection",
  "makeItYours": "Make it yours",
  "makeItYoursBody": "Set this as your wedding's direction and pull its ideas into your checklist.",
  "colorPalette": "Color Palette",
  "ideas": "Ideas",
  "addToChecklist": "Add to checklist",
  "added": "Added",
  "estCost": "Est. cost",
  "back": "Back to concepts",
  "empty": "No concepts available yet.",
  "error": "Something went wrong. Please try again."
},
"AdminConcepts": {
  "title": "Concepts",
  "new": "New concept",
  "titleEn": "Title (EN)",
  "titleHe": "Title (HE)",
  "titleLocale": "Title language",
  "taglineEn": "Tagline (EN)",
  "taglineHe": "Tagline (HE)",
  "descriptionEn": "Description (EN)",
  "descriptionHe": "Description (HE)",
  "palette": "Palette (hex, comma-separated)",
  "premium": "Premium",
  "active": "Active",
  "sortOrder": "Sort order",
  "images": "Vision board images",
  "imageUrl": "Image URL",
  "altEn": "Alt text (EN)",
  "altHe": "Alt text (HE)",
  "elements": "Ideas",
  "category": "Category",
  "estCostMin": "Est. cost min",
  "estCostMax": "Est. cost max",
  "addImage": "Add image",
  "addElement": "Add idea",
  "save": "Save",
  "cancel": "Cancel",
  "delete": "Delete",
  "edit": "Edit",
  "error": "Something went wrong."
}
```

Hebrew values (same keys):

```json
"Concepts": {
  "title": "ספריית הקונספטים",
  "subtitle": "עולמות שעוצבו בקפידה. בחרו קונספט ועצבו סביבו את היום שלכם.",
  "premium": "פרימיום",
  "favorite": "שמירה",
  "favorited": "נשמר",
  "selected": "הקונספט שלכם",
  "select": "בחרו קונספט זה",
  "clearSelection": "הסירו בחירה",
  "makeItYours": "התאימו לעצמכם",
  "makeItYoursBody": "הגדירו זאת ככיוון של החתונה ומשכו רעיונות לרשימת המשימות.",
  "colorPalette": "פלטת צבעים",
  "ideas": "רעיונות",
  "addToChecklist": "הוספה לרשימה",
  "added": "נוסף",
  "estCost": "עלות משוערת",
  "back": "חזרה לקונספטים",
  "empty": "אין עדיין קונספטים זמינים.",
  "error": "משהו השתבש. נסו שוב."
},
"AdminConcepts": {
  "title": "קונספטים",
  "new": "קונספט חדש",
  "titleEn": "כותרת (אנגלית)",
  "titleHe": "כותרת (עברית)",
  "titleLocale": "שפת הכותרת",
  "taglineEn": "תת-כותרת (אנגלית)",
  "taglineHe": "תת-כותרת (עברית)",
  "descriptionEn": "תיאור (אנגלית)",
  "descriptionHe": "תיאור (עברית)",
  "palette": "פלטה (הקס, מופרד בפסיקים)",
  "premium": "פרימיום",
  "active": "פעיל",
  "sortOrder": "סדר",
  "images": "תמונות לוח השראה",
  "imageUrl": "כתובת תמונה",
  "altEn": "טקסט חלופי (אנגלית)",
  "altHe": "טקסט חלופי (עברית)",
  "elements": "רעיונות",
  "category": "קטגוריה",
  "estCostMin": "עלות מינימלית",
  "estCostMax": "עלות מקסימלית",
  "addImage": "הוספת תמונה",
  "addElement": "הוספת רעיון",
  "save": "שמירה",
  "cancel": "ביטול",
  "delete": "מחיקה",
  "edit": "עריכה",
  "error": "משהו השתבש."
}
```

Also add to the existing `Dashboard` block in both files:
- en: `"chooseConceptTitle": "Choose your wedding concept", "chooseConceptBody": "Pick a style that speaks to you and shape your day around it.", "chooseConceptCta": "Browse concepts"`
- he: `"chooseConceptTitle": "בחרו קונספט לחתונה", "chooseConceptBody": "בחרו סגנון שמדבר אליכם ועצבו סביבו את היום.", "chooseConceptCta": "לספריית הקונספטים"`

- [ ] **Step 6: Confirm messages parse and tests pass**

Run: `node -e "require('./messages/he.json'); require('./messages/en.json'); console.log('ok')" && npm run test -- lib/auth/authorize.test.ts`
Expected: `ok` then PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/auth/authorize.ts lib/auth/authorize.test.ts messages/he.json messages/en.json
git commit -m "feat: login-gate /concepts and add concept i18n namespaces"
```

---

### Task 6: Couple UI — gallery & detail

**Files:**
- Create: `app/[locale]/(app)/concepts/page.tsx`
- Create: `app/[locale]/(app)/concepts/concepts-gallery.tsx`
- Create: `app/[locale]/(app)/concepts/concept-card.tsx`
- Create: `app/[locale]/(app)/concepts/[conceptId]/page.tsx`
- Create: `app/[locale]/(app)/concepts/[conceptId]/concept-detail.tsx`
- Create: `app/[locale]/(app)/concepts/concepts-view.test.tsx`

**Interfaces:**
- Consumes: `getActiveConcepts`, `getConceptDetail`, `getWeddingConceptState` from `@/lib/concepts/queries`; `resolveConceptTitle`; couple actions from `@/lib/actions/concepts`.
- Produces: `SerializedConcept`, `SerializedConceptDetail`, `SerializedElement` types (exported from the two client components) for the page loaders + tests.

- [ ] **Step 1: Build the gallery page loader (RSC)**

`app/[locale]/(app)/concepts/page.tsx`:

```tsx
import { setRequestLocale } from 'next-intl/server';
import { auth } from '@/lib/auth';
import { getCurrentWedding } from '@/lib/wedding/queries';
import { getActiveConcepts, getWeddingConceptState } from '@/lib/concepts/queries';
import { resolveConceptTitle } from '@/lib/concepts/title';
import { redirect } from '@/lib/i18n/navigation';
import { ConceptsGallery, type SerializedConcept } from './concepts-gallery';

export default async function ConceptsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user?.id) redirect({ href: '/login', locale });
  const wedding = await getCurrentWedding(session!.user.id);
  if (!wedding) redirect({ href: '/onboarding', locale });

  const [concepts, state] = await Promise.all([
    getActiveConcepts(),
    getWeddingConceptState(wedding!.id),
  ]);

  const serialized: SerializedConcept[] = concepts.map((c) => ({
    id: c.id,
    title: resolveConceptTitle(c, locale),
    tagline: locale === 'he' ? (c.tagline_he ?? c.tagline_en ?? '') : (c.tagline_en ?? c.tagline_he ?? ''),
    palette: c.palette,
    isPremium: c.isPremium,
    coverUrl: c.images[0]?.url ?? null,
    coverAlt: c.images[0] ? (locale === 'he' ? (c.images[0].alt_he ?? '') : (c.images[0].alt_en ?? '')) : '',
    isFavorite: state.favoriteConceptIds.includes(c.id),
    isSelected: state.selectedConceptId === c.id,
  }));

  return (
    <main className="mx-auto w-full max-w-5xl p-6 sm:p-8">
      <ConceptsGallery locale={locale} concepts={serialized} />
    </main>
  );
}
```

- [ ] **Step 2: Build the gallery + card client components**

`app/[locale]/(app)/concepts/concept-card.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/lib/i18n/navigation';
import { toggleFavorite } from '@/lib/actions/concepts';

export interface SerializedConcept {
  id: string;
  title: string;
  tagline: string;
  palette: string[];
  isPremium: boolean;
  coverUrl: string | null;
  coverAlt: string;
  isFavorite: boolean;
  isSelected: boolean;
}

export function ConceptCard({ concept }: { concept: SerializedConcept }) {
  const t = useTranslations('Concepts');
  const [favorite, setFavorite] = useState(concept.isFavorite);
  const [pending, setPending] = useState(false);

  async function onToggleFavorite(e: React.MouseEvent) {
    e.preventDefault();
    setPending(true);
    const prev = favorite;
    setFavorite(!prev);
    const r = await toggleFavorite(concept.id);
    if (!r.ok) setFavorite(prev);
    setPending(false);
  }

  return (
    <Link
      href={`/concepts/${concept.id}`}
      className="group flex flex-col overflow-hidden rounded-card bg-surface shadow-sm"
    >
      <div className="relative aspect-[4/3] w-full bg-muted/10">
        {concept.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={concept.coverUrl} alt={concept.coverAlt} className="h-full w-full object-cover" />
        ) : null}
        {concept.isPremium ? (
          <span className="absolute end-3 top-3 rounded-full bg-text/80 px-3 py-1 text-xs font-medium text-background">
            {t('premium')}
          </span>
        ) : null}
        {concept.isSelected ? (
          <span className="absolute start-3 top-3 rounded-full bg-primary px-3 py-1 text-xs font-medium text-background">
            {t('selected')}
          </span>
        ) : null}
        <button
          type="button"
          onClick={onToggleFavorite}
          disabled={pending}
          aria-pressed={favorite}
          aria-label={favorite ? t('favorited') : t('favorite')}
          className="absolute bottom-3 end-3 rounded-full bg-background/90 px-3 py-1 text-xs text-text"
        >
          {favorite ? `♥ ${t('favorited')}` : `♡ ${t('favorite')}`}
        </button>
      </div>
      <div className="flex flex-col gap-2 p-4 text-center">
        <h2 className="font-display text-xl text-text">{concept.title}</h2>
        {concept.tagline ? <p className="text-sm text-muted">{concept.tagline}</p> : null}
        <div className="mt-1 flex justify-center gap-1.5">
          {concept.palette.map((hex, i) => (
            <span key={i} className="h-4 w-4 rounded-full border border-muted/20" style={{ backgroundColor: hex }} />
          ))}
        </div>
      </div>
    </Link>
  );
}
```

`app/[locale]/(app)/concepts/concepts-gallery.tsx`:

```tsx
'use client';

import { useTranslations } from 'next-intl';
import { ConceptCard, type SerializedConcept } from './concept-card';

export type { SerializedConcept };

export function ConceptsGallery({ locale, concepts }: { locale: string; concepts: SerializedConcept[] }) {
  const t = useTranslations('Concepts');
  return (
    <div className="flex flex-col gap-6">
      <header className="text-center">
        <h1 className="font-display text-3xl text-text">{t('title')}</h1>
        <p className="mt-2 text-sm text-muted">{t('subtitle')}</p>
      </header>
      {concepts.length === 0 ? (
        <p className="text-center text-sm text-muted">{t('empty')}</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {concepts.map((c) => (
            <ConceptCard key={c.id} concept={c} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Build the detail page loader (RSC)**

`app/[locale]/(app)/concepts/[conceptId]/page.tsx`:

```tsx
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getCurrentWedding } from '@/lib/wedding/queries';
import { getConceptDetail, getWeddingConceptState } from '@/lib/concepts/queries';
import { resolveConceptTitle } from '@/lib/concepts/title';
import { redirect } from '@/lib/i18n/navigation';
import { ConceptDetail, type SerializedConceptDetail } from './concept-detail';

export default async function ConceptDetailPage({
  params,
}: {
  params: Promise<{ locale: string; conceptId: string }>;
}) {
  const { locale, conceptId } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user?.id) redirect({ href: '/login', locale });
  const wedding = await getCurrentWedding(session!.user.id);
  if (!wedding) redirect({ href: '/onboarding', locale });

  const [concept, state] = await Promise.all([
    getConceptDetail(conceptId),
    getWeddingConceptState(wedding!.id),
  ]);
  if (!concept) notFound();

  const pick = (he: string | null, en: string | null) =>
    locale === 'he' ? (he ?? en ?? '') : (en ?? he ?? '');

  const detail: SerializedConceptDetail = {
    id: concept.id,
    title: resolveConceptTitle(concept, locale),
    tagline: pick(concept.tagline_he, concept.tagline_en),
    description: pick(concept.description_he, concept.description_en),
    palette: concept.palette,
    isPremium: concept.isPremium,
    isSelected: state.selectedConceptId === concept.id,
    images: concept.images.map((im) => ({ url: im.url, alt: pick(im.alt_he, im.alt_en) })),
    elements: concept.elements.map((el) => ({
      id: el.id,
      title: resolveConceptTitle(el, locale),
      description: pick(el.description_he, el.description_en),
      category: el.category,
      estCostMin: el.estCostMin,
      estCostMax: el.estCostMax,
      isAdded: state.pushedElementIds.includes(el.id),
    })),
  };

  return (
    <main className="mx-auto w-full max-w-5xl p-6 sm:p-8">
      <ConceptDetail locale={locale} concept={detail} />
    </main>
  );
}
```

- [ ] **Step 4: Build the detail client component**

`app/[locale]/(app)/concepts/[conceptId]/concept-detail.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { TaskCategory } from '@prisma/client';
import { Link } from '@/lib/i18n/navigation';
import { chooseConcept, clearSelectedConcept, addElementToChecklist } from '@/lib/actions/concepts';

export interface SerializedElement {
  id: string;
  title: string;
  description: string;
  category: TaskCategory;
  estCostMin: number | null;
  estCostMax: number | null;
  isAdded: boolean;
}

export interface SerializedConceptDetail {
  id: string;
  title: string;
  tagline: string;
  description: string;
  palette: string[];
  isPremium: boolean;
  isSelected: boolean;
  images: { url: string; alt: string }[];
  elements: SerializedElement[];
}

export function ConceptDetail({ locale, concept }: { locale: string; concept: SerializedConceptDetail }) {
  const t = useTranslations('Concepts');
  const tCategory = useTranslations('TaskCategory');
  const [selected, setSelected] = useState(concept.isSelected);
  const [added, setAdded] = useState<Record<string, boolean>>(
    Object.fromEntries(concept.elements.map((e) => [e.id, e.isAdded])),
  );

  async function onToggleSelect() {
    const prev = selected;
    setSelected(!prev);
    const r = prev ? await clearSelectedConcept() : await chooseConcept(concept.id);
    if (!r.ok) setSelected(prev);
  }

  async function onAdd(elementId: string) {
    setAdded((m) => ({ ...m, [elementId]: true }));
    const r = await addElementToChecklist(elementId);
    if (!r.ok) setAdded((m) => ({ ...m, [elementId]: false }));
  }

  const cover = concept.images[0];

  return (
    <div className="flex flex-col gap-6">
      <Link href="/concepts" className="text-sm text-muted">← {t('back')}</Link>

      <div className="relative overflow-hidden rounded-card bg-muted/10">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover.url} alt={cover.alt} className="h-56 w-full object-cover sm:h-72" />
        ) : null}
        <div className="absolute inset-0 flex flex-col items-end justify-end bg-gradient-to-t from-black/50 to-transparent p-6 text-end">
          <h1 className="font-display text-3xl text-white">{concept.title}</h1>
          {concept.tagline ? <p className="text-sm text-white/90">{concept.tagline}</p> : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-[minmax(0,16rem)_1fr]">
        <aside className="flex flex-col items-center gap-3 rounded-card bg-surface p-5 text-center">
          <h2 className="font-display text-lg text-text">{t('makeItYours')}</h2>
          <p className="text-xs text-muted">{t('makeItYoursBody')}</p>
          <button
            type="button"
            onClick={onToggleSelect}
            className="rounded-card bg-primary px-4 py-2 text-sm font-medium text-background"
          >
            {selected ? t('clearSelection') : t('select')}
          </button>
        </aside>

        <section className="flex flex-col gap-4">
          {concept.description ? <p className="text-text">{concept.description}</p> : null}
          {concept.palette.length > 0 ? (
            <div>
              <h3 className="mb-2 font-display text-lg text-text">{t('colorPalette')}</h3>
              <div className="flex flex-wrap gap-3">
                {concept.palette.map((hex, i) => (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <span className="h-10 w-10 rounded-card border border-muted/20" style={{ backgroundColor: hex }} />
                    <span dir="ltr" className="text-xs text-muted">{hex}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      </div>

      <section className="flex flex-col gap-3">
        <h3 className="font-display text-lg text-text">{t('ideas')}</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {concept.elements.map((el) => (
            <article key={el.id} className="flex flex-col gap-2 rounded-card bg-surface p-4">
              <span className="text-xs uppercase tracking-wide text-muted">{tCategory(el.category)}</span>
              <h4 className="font-display text-base text-text">{el.title}</h4>
              {el.description ? <p className="text-sm text-muted">{el.description}</p> : null}
              {el.estCostMin != null || el.estCostMax != null ? (
                <p className="text-xs text-muted">
                  {t('estCost')}: {el.estCostMin ?? '—'}–{el.estCostMax ?? '—'} ₪
                </p>
              ) : null}
              <button
                type="button"
                onClick={() => onAdd(el.id)}
                disabled={added[el.id]}
                className="mt-1 self-start rounded-card border border-muted/30 px-3 py-1.5 text-sm text-text disabled:opacity-60"
              >
                {added[el.id] ? `✓ ${t('added')}` : t('addToChecklist')}
              </button>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 5: Write a component test**

`app/[locale]/(app)/concepts/concepts-view.test.tsx` — mock `next-intl` (return the key) and `@/lib/actions/concepts`, in the style of `checklist-view.test.tsx` (read it first). Assert: gallery renders a card with title + PREMIUM badge; detail renders grouped ideas and an idea already added shows the "added" state.

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next-intl', () => ({ useTranslations: () => (k: string) => k }));
vi.mock('@/lib/i18n/navigation', () => ({ Link: (p: any) => <a href={p.href}>{p.children}</a> }));
vi.mock('@/lib/actions/concepts', () => ({
  toggleFavorite: vi.fn(), chooseConcept: vi.fn(), clearSelectedConcept: vi.fn(), addElementToChecklist: vi.fn(),
}));

import { ConceptCard } from './concept-card';
import { ConceptDetail } from './[conceptId]/concept-detail';

describe('ConceptCard', () => {
  it('shows the title and premium badge', () => {
    render(<ConceptCard concept={{
      id: 'c1', title: 'Old Money', tagline: 'Timeless', palette: ['#C9A227'],
      isPremium: true, coverUrl: null, coverAlt: '', isFavorite: false, isSelected: false,
    }} />);
    expect(screen.getByText('Old Money')).toBeInTheDocument();
    expect(screen.getByText('premium')).toBeInTheDocument();
  });
});

describe('ConceptDetail', () => {
  it('renders ideas and reflects an already-added idea', () => {
    render(<ConceptDetail locale="en" concept={{
      id: 'c1', title: 'Party Time', tagline: '', description: 'Desc', palette: [], isPremium: false, isSelected: false,
      images: [], elements: [
        { id: 'el1', title: 'Two DJs', description: '', category: 'MUSIC', estCostMin: 6000, estCostMax: 14000, isAdded: true },
      ],
    }} />);
    expect(screen.getByText('Two DJs')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /added/i })).toBeDisabled();
  });
});
```

- [ ] **Step 6: Run the component tests**

Run: `npm run test -- app/[locale]/\(app\)/concepts/concepts-view.test.tsx`
Expected: PASS.

- [ ] **Step 7: Typecheck, lint, and smoke-run the page**

Run: `npm run typecheck && npm run lint`
Expected: PASS. (If `next/image` is preferred over `<img>`, that's a later polish — the ESLint disable comments keep the build green now.)

- [ ] **Step 8: Commit**

```bash
git add "app/[locale]/(app)/concepts"
git commit -m "feat: add couple concept gallery and detail UI"
```

---

### Task 7: Admin UI — concept CMS

**Files:**
- Create: `app/[locale]/admin/concepts/page.tsx`
- Create: `app/[locale]/admin/concepts/concepts-admin.tsx`
- Create: `app/[locale]/admin/concepts/concept-form.tsx`
- Create: `app/[locale]/admin/concepts/concepts-admin.test.tsx`
- Modify: `app/[locale]/admin/page.tsx` (add a Concepts link)

**Interfaces:**
- Consumes: `getAllConcepts` from `@/lib/concepts/queries`; admin actions from `@/lib/actions/admin-concepts`; `CATEGORY_OPTIONS`, `TITLE_LOCALE_OPTIONS` from `@/lib/concepts/schema`.
- Produces: `SerializedAdminConcept` type for the loader + test.

- [ ] **Step 1: Build the admin page loader (RSC)**

`app/[locale]/admin/concepts/page.tsx`:

```tsx
import { setRequestLocale } from 'next-intl/server';
import { auth } from '@/lib/auth';
import { redirect } from '@/lib/i18n/navigation';
import { getAllConcepts } from '@/lib/concepts/queries';
import { ConceptsAdmin, type SerializedAdminConcept } from './concepts-admin';

export default async function AdminConceptsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (session?.user?.role !== 'ADMIN') redirect({ href: '/dashboard', locale });

  const concepts = await getAllConcepts();
  const serialized: SerializedAdminConcept[] = concepts.map((c) => ({
    id: c.id,
    title_en: c.title_en, title_he: c.title_he, titleLocale: c.titleLocale,
    tagline_en: c.tagline_en, tagline_he: c.tagline_he,
    description_en: c.description_en, description_he: c.description_he,
    palette: c.palette, isPremium: c.isPremium, active: c.active, sortOrder: c.sortOrder,
    images: c.images.map((im) => ({ id: im.id, url: im.url, alt_en: im.alt_en, alt_he: im.alt_he, sortOrder: im.sortOrder })),
    elements: c.elements.map((el) => ({
      id: el.id, title_en: el.title_en, title_he: el.title_he, titleLocale: el.titleLocale,
      description_en: el.description_en, description_he: el.description_he,
      category: el.category, estCostMin: el.estCostMin, estCostMax: el.estCostMax,
      active: el.active, sortOrder: el.sortOrder,
    })),
  }));

  return (
    <main className="mx-auto w-full max-w-5xl p-6 sm:p-8">
      <ConceptsAdmin concepts={serialized} />
    </main>
  );
}
```

- [ ] **Step 2: Build the admin list + form client components**

`app/[locale]/admin/concepts/concept-form.tsx` — a form over `conceptSchema` fields plus nested image/element rows, calling `createConcept`/`updateConcept`, `addImage`/`deleteImage`, `createElement`/`deleteElement`. Model it structurally on `app/[locale]/admin/checklist-templates/template-form.tsx` (read it first for the exact form/callback idiom). Serialize palette as a comma-separated hex string in the input and split on submit.

```tsx
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { TaskCategory, TitleLocale } from '@prisma/client';
import { CATEGORY_OPTIONS, TITLE_LOCALE_OPTIONS } from '@/lib/concepts/schema';
import {
  createConcept, updateConcept, createElement, deleteElement, addImage, deleteImage,
} from '@/lib/actions/admin-concepts';

export interface AdminImage { id: string; url: string; alt_en: string | null; alt_he: string | null; sortOrder: number }
export interface AdminElement {
  id: string; title_en: string; title_he: string; titleLocale: TitleLocale;
  description_en: string | null; description_he: string | null; category: TaskCategory;
  estCostMin: number | null; estCostMax: number | null; active: boolean; sortOrder: number;
}
export interface SerializedAdminConcept {
  id: string; title_en: string; title_he: string; titleLocale: TitleLocale;
  tagline_en: string | null; tagline_he: string | null;
  description_en: string | null; description_he: string | null;
  palette: string[]; isPremium: boolean; active: boolean; sortOrder: number;
  images: AdminImage[]; elements: AdminElement[];
}

export function ConceptForm({ concept, onSaved, onCancel }: {
  concept: SerializedAdminConcept | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations('AdminConcepts');
  const tCategory = useTranslations('TaskCategory');
  const [titleEn, setTitleEn] = useState(concept?.title_en ?? '');
  const [titleHe, setTitleHe] = useState(concept?.title_he ?? '');
  const [titleLocale, setTitleLocale] = useState<TitleLocale>(concept?.titleLocale ?? 'AUTO');
  const [taglineEn, setTaglineEn] = useState(concept?.tagline_en ?? '');
  const [taglineHe, setTaglineHe] = useState(concept?.tagline_he ?? '');
  const [descEn, setDescEn] = useState(concept?.description_en ?? '');
  const [descHe, setDescHe] = useState(concept?.description_he ?? '');
  const [palette, setPalette] = useState((concept?.palette ?? []).join(', '));
  const [isPremium, setIsPremium] = useState(concept?.isPremium ?? false);
  const [active, setActive] = useState(concept?.active ?? true);
  const [sortOrder, setSortOrder] = useState(concept?.sortOrder ?? 0);
  const [error, setError] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(false);
    setPending(true);
    const payload = {
      title_en: titleEn.trim(), title_he: titleHe.trim(), titleLocale,
      tagline_en: taglineEn.trim() || null, tagline_he: taglineHe.trim() || null,
      description_en: descEn.trim() || null, description_he: descHe.trim() || null,
      palette: palette.split(',').map((s) => s.trim()).filter(Boolean),
      isPremium, active, sortOrder,
    };
    const r = concept ? await updateConcept(concept.id, payload) : await createConcept(payload);
    setPending(false);
    if (!r.ok) { setError(true); return; }
    onSaved();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 rounded-card bg-surface p-4">
      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-xs text-muted">{t('titleEn')}
          <input value={titleEn} onChange={(e) => setTitleEn(e.target.value)} className="rounded-card border border-muted/30 bg-background px-3 py-2 text-sm text-text" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">{t('titleHe')}
          <input value={titleHe} onChange={(e) => setTitleHe(e.target.value)} className="rounded-card border border-muted/30 bg-background px-3 py-2 text-sm text-text" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">{t('titleLocale')}
          <select value={titleLocale} onChange={(e) => setTitleLocale(e.target.value as TitleLocale)} className="rounded-card border border-muted/30 bg-background px-2 py-2 text-sm text-text">
            {TITLE_LOCALE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-xs text-muted">{t('taglineEn')}
          <input value={taglineEn} onChange={(e) => setTaglineEn(e.target.value)} className="rounded-card border border-muted/30 bg-background px-3 py-2 text-sm text-text" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">{t('taglineHe')}
          <input value={taglineHe} onChange={(e) => setTaglineHe(e.target.value)} className="rounded-card border border-muted/30 bg-background px-3 py-2 text-sm text-text" />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-xs text-muted">{t('descriptionEn')}
        <textarea value={descEn} onChange={(e) => setDescEn(e.target.value)} className="rounded-card border border-muted/30 bg-background px-3 py-2 text-sm text-text" />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted">{t('descriptionHe')}
        <textarea value={descHe} onChange={(e) => setDescHe(e.target.value)} className="rounded-card border border-muted/30 bg-background px-3 py-2 text-sm text-text" />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted">{t('palette')}
        <input value={palette} onChange={(e) => setPalette(e.target.value)} dir="ltr" placeholder="#C9A227, #1C1C1C" className="rounded-card border border-muted/30 bg-background px-3 py-2 text-sm text-text" />
      </label>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-xs text-muted"><input type="checkbox" checked={isPremium} onChange={(e) => setIsPremium(e.target.checked)} />{t('premium')}</label>
        <label className="flex items-center gap-2 text-xs text-muted"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />{t('active')}</label>
        <label className="flex items-center gap-2 text-xs text-muted">{t('sortOrder')}
          <input type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} className="w-20 rounded-card border border-muted/30 bg-background px-2 py-1 text-sm text-text" />
        </label>
      </div>

      {error ? <p className="text-sm text-red-600">{t('error')}</p> : null}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="rounded-card bg-primary px-4 py-2 text-sm font-medium text-background disabled:opacity-60">{t('save')}</button>
        <button type="button" onClick={onCancel} className="rounded-card border border-muted/30 px-4 py-2 text-sm text-text">{t('cancel')}</button>
      </div>

      {concept ? (
        <NestedEditors concept={concept} onChanged={onSaved} tCategory={tCategory} t={t} />
      ) : (
        <p className="text-xs text-muted">{t('save')} → {t('addElement')} / {t('addImage')}</p>
      )}
    </form>
  );
}

function NestedEditors({ concept, onChanged, t, tCategory }: {
  concept: SerializedAdminConcept;
  onChanged: () => void;
  t: ReturnType<typeof useTranslations>;
  tCategory: ReturnType<typeof useTranslations>;
}) {
  const [url, setUrl] = useState('');
  const [elTitleEn, setElTitleEn] = useState('');
  const [elTitleHe, setElTitleHe] = useState('');
  const [elCategory, setElCategory] = useState<TaskCategory>('OTHER');

  async function onAddImage() {
    if (!url.trim()) return;
    await addImage(concept.id, { url: url.trim(), sortOrder: concept.images.length });
    setUrl('');
    onChanged();
  }
  async function onAddElement() {
    if (!elTitleEn.trim() || !elTitleHe.trim()) return;
    await createElement(concept.id, {
      title_en: elTitleEn.trim(), title_he: elTitleHe.trim(), category: elCategory, sortOrder: concept.elements.length,
    });
    setElTitleEn(''); setElTitleHe('');
    onChanged();
  }

  return (
    <div className="mt-3 flex flex-col gap-4 border-t border-muted/20 pt-3">
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium text-text">{t('images')}</h3>
        {concept.images.map((im) => (
          <div key={im.id} className="flex items-center gap-2 text-xs text-muted">
            <span dir="ltr" className="truncate">{im.url}</span>
            <button type="button" onClick={async () => { await deleteImage(im.id); onChanged(); }} className="text-red-600">{t('delete')}</button>
          </div>
        ))}
        <div className="flex gap-2">
          <input value={url} onChange={(e) => setUrl(e.target.value)} dir="ltr" placeholder={t('imageUrl')} className="flex-1 rounded-card border border-muted/30 bg-background px-2 py-1 text-sm text-text" />
          <button type="button" onClick={onAddImage} className="rounded-card border border-muted/30 px-3 py-1 text-sm text-text">{t('addImage')}</button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium text-text">{t('elements')}</h3>
        {concept.elements.map((el) => (
          <div key={el.id} className="flex items-center gap-2 text-xs text-muted">
            <span className="truncate">{el.title_en} / {el.title_he} · {tCategory(el.category)}</span>
            <button type="button" onClick={async () => { await deleteElement(el.id); onChanged(); }} className="text-red-600">{t('delete')}</button>
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          <input value={elTitleEn} onChange={(e) => setElTitleEn(e.target.value)} placeholder={t('titleEn')} className="rounded-card border border-muted/30 bg-background px-2 py-1 text-sm text-text" />
          <input value={elTitleHe} onChange={(e) => setElTitleHe(e.target.value)} placeholder={t('titleHe')} className="rounded-card border border-muted/30 bg-background px-2 py-1 text-sm text-text" />
          <select value={elCategory} onChange={(e) => setElCategory(e.target.value as TaskCategory)} className="rounded-card border border-muted/30 bg-background px-2 py-1 text-sm text-text">
            {CATEGORY_OPTIONS.map((o) => <option key={o} value={o}>{tCategory(o)}</option>)}
          </select>
          <button type="button" onClick={onAddElement} className="rounded-card border border-muted/30 px-3 py-1 text-sm text-text">{t('addElement')}</button>
        </div>
      </div>
    </div>
  );
}
```

`app/[locale]/admin/concepts/concepts-admin.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ConceptForm, type SerializedAdminConcept } from './concept-form';
import { deleteConcept } from '@/lib/actions/admin-concepts';

export type { SerializedAdminConcept };

export function ConceptsAdmin({ concepts }: { concepts: SerializedAdminConcept[] }) {
  const t = useTranslations('AdminConcepts');
  const router = useRouter();
  const [editing, setEditing] = useState<SerializedAdminConcept | null>(null);
  const [creating, setCreating] = useState(false);

  function refresh() { setEditing(null); setCreating(false); router.refresh(); }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center justify-between">
        <h1 className="font-display text-2xl text-text">{t('title')}</h1>
        <button type="button" onClick={() => { setCreating(true); setEditing(null); }} className="rounded-card bg-primary px-4 py-2 text-sm font-medium text-background">{t('new')}</button>
      </header>

      {creating ? <ConceptForm concept={null} onSaved={refresh} onCancel={() => setCreating(false)} /> : null}

      <ul className="flex flex-col gap-2">
        {concepts.map((c) => (
          <li key={c.id} className="rounded-card bg-surface p-3">
            {editing?.id === c.id ? (
              <ConceptForm concept={c} onSaved={refresh} onCancel={() => setEditing(null)} />
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-sm text-text">{c.title_en} / {c.title_he}{c.isPremium ? ' · ★' : ''}{c.active ? '' : ' · (inactive)'}</span>
                <span className="flex gap-2">
                  <button type="button" onClick={() => { setEditing(c); setCreating(false); }} className="text-sm text-muted">{t('edit')}</button>
                  <button type="button" onClick={async () => { await deleteConcept(c.id); refresh(); }} className="text-sm text-red-600">{t('delete')}</button>
                </span>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 3: Add the admin nav link**

In `app/[locale]/admin/page.tsx`, render links to the admin sections. Replace the body with:

```tsx
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/navigation';

export default async function AdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Admin');
  const tConcepts = await getTranslations('AdminConcepts');
  const tTemplates = await getTranslations('AdminTemplates');
  return (
    <main className="mx-auto w-full max-w-3xl p-8">
      <p className="mb-4 text-text">{t('placeholder')}</p>
      <ul className="flex flex-col gap-2">
        <li><Link href="/admin/checklist-templates" className="text-primary underline">{tTemplates('title')}</Link></li>
        <li><Link href="/admin/concepts" className="text-primary underline">{tConcepts('title')}</Link></li>
      </ul>
    </main>
  );
}
```

Note: if `AdminTemplates` has no `title` key, use the existing key it does expose for that page's heading (check `messages/en.json`), or reuse `Admin.placeholder`-adjacent copy — keep it to existing keys.

- [ ] **Step 4: Write an admin component test**

`app/[locale]/admin/concepts/concepts-admin.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('next-intl', () => ({ useTranslations: () => (k: string) => k }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@/lib/actions/admin-concepts', () => ({
  createConcept: vi.fn(), updateConcept: vi.fn(), deleteConcept: vi.fn(),
  createElement: vi.fn(), deleteElement: vi.fn(), addImage: vi.fn(), deleteImage: vi.fn(),
}));

import { ConceptsAdmin } from './concepts-admin';

describe('ConceptsAdmin', () => {
  it('lists concepts and opens the create form', () => {
    render(<ConceptsAdmin concepts={[{
      id: 'c1', title_en: 'Old Money', title_he: 'אלגנטיות', titleLocale: 'AUTO',
      tagline_en: null, tagline_he: null, description_en: null, description_he: null,
      palette: [], isPremium: true, active: true, sortOrder: 0, images: [], elements: [],
    }]} />);
    expect(screen.getByText(/Old Money/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('new'));
    expect(screen.getByText('save')).toBeInTheDocument();
  });
});
```

- [ ] **Step 5: Run the admin test, typecheck, lint**

Run: `npm run test -- app/[locale]/admin/concepts/concepts-admin.test.tsx && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add "app/[locale]/admin/concepts" "app/[locale]/admin/page.tsx"
git commit -m "feat: add ADMIN concept CMS UI"
```

---

### Task 8: Dashboard nudge + E2E flows + acceptance verification

**Files:**
- Modify: `app/[locale]/(app)/dashboard/page.tsx`
- Create: `e2e/concepts.spec.ts`

**Interfaces:**
- Consumes: everything above. Reads `e2e/checklist.spec.ts` for the login/setup helper idiom (auth fixture, seeding).

- [ ] **Step 1: Add the dashboard nudge**

In `app/[locale]/(app)/dashboard/page.tsx`, load the wedding's `selectedConceptId` and, when null, render a nudge card linking to `/concepts`. Add (adapt imports to the file's existing structure — read it first):

```tsx
// after resolving `wedding` and `locale`, with getTranslations('Dashboard') as `t`:
{!wedding?.selectedConceptId ? (
  <section className="rounded-card bg-surface p-5">
    <h2 className="font-display text-lg text-text">{t('chooseConceptTitle')}</h2>
    <p className="mt-1 text-sm text-muted">{t('chooseConceptBody')}</p>
    <Link href="/concepts" className="mt-3 inline-block rounded-card bg-primary px-4 py-2 text-sm font-medium text-background">
      {t('chooseConceptCta')}
    </Link>
  </section>
) : null}
```

If the dashboard page doesn't already load the wedding, add `getCurrentWedding(session.user.id)` (import from `@/lib/wedding/queries`) and `Link` from `@/lib/i18n/navigation`.

- [ ] **Step 2: Typecheck & lint the dashboard change**

Run: `npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 3: Write the e2e spec**

`e2e/concepts.spec.ts` — read `e2e/checklist.spec.ts` first to reuse its register/login/onboarding-complete helper and base URL setup. Cover the acceptance flow:

```typescript
import { test, expect } from '@playwright/test';
// Reuse the helper pattern from checklist.spec.ts to register a fresh user,
// complete onboarding, and land in the (app) area. Then:

test('couple browses concepts, selects one, and pushes an idea to the checklist', async ({ page }) => {
  // ... register + complete onboarding (helper) ...
  await page.goto('/concepts');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  // Open the first concept
  await page.getByRole('link', { name: /Party Time|מסיבה/ }).first().click();
  await expect(page).toHaveURL(/\/concepts\/concept-/);

  // Select it
  await page.getByRole('button', { name: /Select this concept|בחרו קונספט/ }).click();

  // Push the first idea to the checklist
  const addButton = page.getByRole('button', { name: /Add to checklist|הוספה לרשימה/ }).first();
  await addButton.click();
  await expect(page.getByRole('button', { name: /Added|נוסף/ }).first()).toBeDisabled();

  // It appears in the checklist
  await page.goto('/checklist');
  await expect(page.getByText(/DJ|תקליטן/).first()).toBeVisible();
});

test('logged-out users are redirected from /concepts', async ({ page }) => {
  await page.goto('/concepts');
  await expect(page).toHaveURL(/\/login/);
});
```

- [ ] **Step 4: Run the e2e suite**

Run: `npm run test:e2e -- concepts`
Expected: PASS. (Ensure the DB is seeded — `npm run db:seed` — so the concept gallery is non-empty.)

- [ ] **Step 5: Full verification gate**

Run: `npm run lint && npm run typecheck && npm run test && npm run test:e2e`
Expected: all green. Confirm each acceptance criterion (1–11) from the spec is met; note any deferred.

- [ ] **Step 6: Commit**

```bash
git add "app/[locale]/(app)/dashboard/page.tsx" e2e/concepts.spec.ts
git commit -m "test: add concepts e2e flows and dashboard nudge; verify acceptance criteria"
```

- [ ] **Step 7: Update the implementation log**

Add a "Phase 4 — Wedding Concepts" section to `docs/superpowers/IMPLEMENTATION-LOG.md` (mirroring the Phase 3 entry: spec/plan links, delivered summary, key decisions, verification counts), and record any new deferred follow-ups (e.g. image-upload flow, budget consumption in Phase 5, `updateConcept` full-object replace, `next/image` migration). Commit:

```bash
git add docs/superpowers/IMPLEMENTATION-LOG.md
git commit -m "docs: record Phase 4 (Wedding Concepts) in the implementation log"
```

---

## Self-Review

**1. Spec coverage:**
- Data model (4 models + Wedding/Task fields) → Task 1. ✅
- Seed ~4 bilingual concepts, idempotent → Task 1 (Steps 4–6). ✅
- Title resolver / Zod / queries → Task 2. ✅
- Couple actions (choose/clear/favorite/push add-once-while-live) → Task 3. ✅
- Admin CRUD (concept/element/image, live-DB role, cascade/SetNull) → Task 4. ✅
- `/concepts` login-gate + i18n namespaces → Task 5. ✅
- Couple gallery + detail (hero, palette, grouped ideas, favorite, select, add-to-checklist) → Task 6. ✅
- Admin CMS UI + admin nav link → Task 7. ✅
- Dashboard nudge + e2e + acceptance verification + log → Task 8. ✅
- Premium flag modeled + badge, no enforcement → schema (Task 1), badge (Task 6), `setConceptPremium` (Task 4). ✅
- Deferred (image upload, budget consumption, vendor recs) → captured in spec Non-goals + Task 8 Step 7. ✅

**2. Placeholder scan:** No "TBD"/"add error handling"/"similar to Task N" — each code step carries real code. UI tasks that say "read X first" also include the full component code; the read is for idiom-matching, not missing content. ✅

**3. Type consistency:** `ConceptActionResult` (Task 3) and `AdminResult` (Task 4) are used consistently; `elementToTaskPayload(weddingId, element, sortOrder)` signature matches between Task 2 (definition), Task 2 test, and Task 3 (call site); `SerializedConcept` is defined in `concept-card.tsx` and re-exported from `concepts-gallery.tsx` (Task 6); `SerializedAdminConcept` defined in `concept-form.tsx`, re-exported from `concepts-admin.tsx` (Task 7); `toggleFavorite` uses the `weddingId_conceptId` compound-unique selector matching the `@@unique([weddingId, conceptId])` in Task 1. ✅
