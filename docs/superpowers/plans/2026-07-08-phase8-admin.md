# Phase 8 — Admin Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wrap the four standalone admin CMSes in a shared `/admin` shell — one live-DB admin gate (fixing the stale-JWT loaders), consistent chrome (header + section nav), and a read-only overview replacing the bare link list — and fold in the named admin cleanups (`updateConcept` flag-stomp, `admin-concepts` export-parity, image `AdminResult.ok` checks).

**Architecture:** A shared `app/[locale]/admin/layout.tsx` performs a single server-side live-DB admin check (via a pure `adminGateDecision` helper) and renders the shell (header + data-driven section nav); the four CMS pages shed their own gate + outer wrapper and render as `{children}`. A `lib/admin/` module holds the pure gate decision, the nav sections config, and a read-only overview-counts composer. No new schema, no new admin capabilities.

**Tech Stack:** Next.js 16 (App Router, RSC + layouts), Prisma 6.19.3 + Postgres, next-intl (he default/RTL + en), Vitest (+ @testing-library/react), Playwright, Tailwind v4 design tokens.

## Global Constraints

- **No new schema, no new admin data domains** — Phase 8 reads existing models for counts and re-hosts existing CMSes. No user/couple management, no role changing, no audit log.
- **One live-DB gate in the layout** — `app/[locale]/admin/layout.tsx` is the single server-side admin check for `/admin/*`: `auth()` (→ `/login`) then a fresh `prisma.user.findUnique({ select: { role } })` (→ `/dashboard` if not `ADMIN`). NEVER gate on `session.user.role` (the stale JWT claim). The four CMS page loaders drop their own gate. Mutation `requireAdmin()` (live-DB) stays as the real boundary; the edge `proxy.ts` `/admin` gate stays.
- **Nav labels reuse existing per-CMS `title` keys** (`AdminTemplates.title`/`AdminConcepts.title`/`AdminBudget.title`/`AdminVendors.title`); the `Admin` namespace is expanded only for panel chrome (panel title, "Overview" label, overview card labels, budget-imbalance warning). Identical he/en key sets.
- **`updateConcept` writes content fields only** — strip `isPremium`/`active`/`sortOrder` (owned by `setConceptActive`/`setConceptPremium`/`reorderConcept`); keep `title_en`/`title_he`/`titleLocale`/`tagline_en`/`tagline_he`/`description_en`/`description_he`/`palette`.
- **No hard-coded UI strings** — all chrome via i18n; identical he/en key sets (a key-parity test exists). RTL-safe logical Tailwind props (`ps-`/`pe-`/`ms-`/`me-`/`text-start`), never `pl-`/`pr-`/`text-left`.
- **Lint/type gate** — `npm run lint` (`--max-warnings 0`) and `npm run typecheck` stay green.
- **Design tokens** — `bg-surface`, `text-text`, `text-muted`, `bg-primary`, `text-background`, `bg-accent/20`, `rounded-card`, `font-display`, `font-body`.

## File Structure

**Create:**
- `lib/admin/gate.ts` — `adminGateDecision(userId, dbRole)` pure decision helper + `.test.ts`.
- `lib/admin/sections.ts` — `ADMIN_SECTIONS` + `activeSectionKey(pathname)` + `.test.ts`.
- `lib/admin/overview.ts` — `getAdminOverview()` composer + `budgetBaselineStatus(rows)` pure helper + `.test.ts`.
- `app/[locale]/admin/layout.tsx` — the gate + shell (header + nav container).
- `app/[locale]/admin/admin-nav.tsx` — client section nav (active-highlight).
- `app/[locale]/admin/admin-panel.test.tsx` — component tests (nav + overview card).

**Modify:**
- `app/[locale]/admin/page.tsx` — replace the bare link list with the overview cards.
- `app/[locale]/admin/checklist-templates/page.tsx`, `concepts/page.tsx`, `budget-templates/page.tsx`, `vendors/page.tsx` — drop the per-page auth/role gate + outer `<main className="mx-auto …">` wrapper (now the layout's).
- `lib/actions/admin-concepts.ts` — `updateConcept` content-only write.
- `lib/actions/admin-concepts.test.ts` — export-parity assertion + `updateConcept` flag-preservation regression.
- `app/[locale]/admin/concepts/concept-form.tsx`, `app/[locale]/admin/vendors/vendor-form.tsx` — image add/delete `AdminResult.ok` handling.
- `messages/en.json` + `messages/he.json` — expand the `Admin` namespace.
- `e2e/admin.spec.ts` — create.

---

### Task 1: Admin action cleanups (`updateConcept` flag-stomp + export-parity test)

**Files:**
- Modify: `lib/actions/admin-concepts.ts`, `lib/actions/admin-concepts.test.ts`

**Interfaces:**
- Produces: `updateConcept` that no longer writes `isPremium`/`active`/`sortOrder`; a new export-parity test.

- [ ] **Step 1: Write the failing regression test for `updateConcept`**

In `lib/actions/admin-concepts.test.ts`, add (read the file first for its mocking idiom — it mocks `@/lib/auth` + `@/lib/db` and has an `asAdmin(true|false)` helper; reuse them):

```typescript
describe('updateConcept does not reset independently-managed flags', () => {
  it('omits isPremium/active/sortOrder from the update when the payload omits them', async () => {
    asAdmin(true);
    (prisma.concept.findUnique as unknown as Mock).mockResolvedValue({ id: 'c1' });
    await updateConcept('c1', { title_en: 'X', title_he: 'י', palette: ['#C9A227'] });
    expect(prisma.concept.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({
          isPremium: expect.anything(),
          active: expect.anything(),
          sortOrder: expect.anything(),
        }),
      }),
    );
  });
});
```

Also add the export-parity assertion (match the `admin-vendors.test.ts` / `admin-budget.test.ts` pattern — `import * as adminConcepts from './admin-concepts'`; the file already has a parametrized non-admin FORBIDDEN list of the 14 exports — reuse that list, or hardcode it):

```typescript
it('every admin-concepts export is an admin-gated action (export parity)', () => {
  expect(Object.keys(adminConcepts).sort()).toEqual(
    [
      'createConcept', 'updateConcept', 'deleteConcept', 'setConceptActive',
      'setConceptPremium', 'reorderConcept', 'createElement', 'updateElement',
      'deleteElement', 'reorderElement', 'addImage', 'updateImage', 'deleteImage',
      'reorderImage',
    ].sort(),
  );
});
```

(If `AdminResult` is exported as a `type`, it is erased at compile time and won't appear in `Object.keys` — confirm the 14 runtime exports match. Ensure `import * as adminConcepts` is present.)

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test -- lib/actions/admin-concepts.test.ts`
Expected: the flag-preservation test FAILS (current `updateConcept` writes `data: parsed.data`, which includes the schema-defaulted `isPremium: false, active: true, sortOrder: 0`). The export-parity test should PASS if the 14 names match (fix the list if the assertion reveals a drift).

- [ ] **Step 3: Fix `updateConcept` (content-only write)**

In `lib/actions/admin-concepts.ts`, replace the `updateConcept` body's write:

```typescript
export async function updateConcept(id: string, input: unknown): Promise<AdminResult> {
  if (!(await requireAdmin())) return { ok: false, error: 'FORBIDDEN' };
  const parsed = conceptSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'INVALID' };
  const existing = await prisma.concept.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return { ok: false, error: 'NOT_FOUND' };
  // isPremium/active/sortOrder are owned by setConceptActive/setConceptPremium/reorderConcept.
  // Write only content fields so a partial edit can't reset them via schema defaults.
  const d = parsed.data;
  await prisma.concept.update({
    where: { id },
    data: {
      title_en: d.title_en,
      title_he: d.title_he,
      titleLocale: d.titleLocale,
      tagline_en: d.tagline_en,
      tagline_he: d.tagline_he,
      description_en: d.description_en,
      description_he: d.description_he,
      palette: d.palette,
    },
  });
  return { ok: true, id };
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm run test -- lib/actions/admin-concepts.test.ts`
Expected: PASS (flag-preservation + export-parity + existing cases).

- [ ] **Step 5: Typecheck, lint & commit**

Run: `npm run typecheck && npm run lint`
Expected: PASS.

```bash
git add lib/actions/admin-concepts.ts lib/actions/admin-concepts.test.ts
git commit -m "fix: updateConcept writes content only; add admin-concepts export-parity test"
```

---

### Task 2: Admin domain (`lib/admin/` — gate, sections, overview)

**Files:**
- Create: `lib/admin/gate.ts` + `.test.ts`, `lib/admin/sections.ts` + `.test.ts`, `lib/admin/overview.ts` + `.test.ts`

**Interfaces:**
- Consumes: `prisma` (`@/lib/db`); `UserRole` from `@prisma/client`.
- Produces:
  - `adminGateDecision(userId: string | undefined, dbRole: UserRole | null | undefined): 'login' | 'dashboard' | 'allow'`
  - `ADMIN_SECTIONS: { key: string; href: string; labelKey: string }[]`; `activeSectionKey(pathname: string): string | null`
  - `budgetBaselineStatus(rows: { defaultPercent: number; active: boolean }[]): { sum: number; balanced: boolean }`; `getAdminOverview(): Promise<AdminOverview>` + type `AdminOverview`.

- [ ] **Step 1: Write the gate + sections tests**

`lib/admin/gate.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { adminGateDecision } from './gate';

describe('adminGateDecision', () => {
  it('sends anonymous visitors to login', () => {
    expect(adminGateDecision(undefined, null)).toBe('login');
  });
  it('sends a logged-in non-admin to the dashboard', () => {
    expect(adminGateDecision('u1', 'USER')).toBe('dashboard');
  });
  it('bounces a stale-JWT demoted admin by the live-DB role', () => {
    // JWT is irrelevant here — the decision only ever sees the live DB role.
    expect(adminGateDecision('u1', 'USER')).toBe('dashboard');
    expect(adminGateDecision('u1', null)).toBe('dashboard');
  });
  it('allows a live-DB admin', () => {
    expect(adminGateDecision('u1', 'ADMIN')).toBe('allow');
  });
});
```

`lib/admin/sections.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { ADMIN_SECTIONS, activeSectionKey } from './sections';

describe('ADMIN_SECTIONS', () => {
  it('lists the overview + four CMSes', () => {
    expect(ADMIN_SECTIONS.map((s) => s.key)).toEqual([
      'overview', 'checklist-templates', 'concepts', 'budget-templates', 'vendors',
    ]);
  });
});

describe('activeSectionKey', () => {
  it('matches the overview exactly (with and without /en)', () => {
    expect(activeSectionKey('/admin')).toBe('overview');
    expect(activeSectionKey('/en/admin')).toBe('overview');
  });
  it('matches a CMS section and its sub-paths', () => {
    expect(activeSectionKey('/admin/concepts')).toBe('concepts');
    expect(activeSectionKey('/en/admin/vendors/abc')).toBe('vendors');
  });
  it('returns null for an unknown path', () => {
    expect(activeSectionKey('/dashboard')).toBeNull();
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm run test -- lib/admin/gate.test.ts lib/admin/sections.test.ts`
Expected: FAIL ("Cannot find module './gate'").

- [ ] **Step 3: Implement `gate.ts` and `sections.ts`**

`lib/admin/gate.ts`:

```typescript
import type { UserRole } from '@prisma/client';

/**
 * The admin-access decision for the /admin layout. Consults ONLY the live-DB role
 * (never the JWT claim), so a stale-JWT demoted admin is correctly bounced.
 */
export function adminGateDecision(
  userId: string | undefined,
  dbRole: UserRole | null | undefined,
): 'login' | 'dashboard' | 'allow' {
  if (!userId) return 'login';
  if (dbRole !== 'ADMIN') return 'dashboard';
  return 'allow';
}
```

`lib/admin/sections.ts`:

```typescript
export interface AdminSection {
  key: string;
  href: string;
  labelKey: string; // i18n key, resolved by the nav component
}

export const ADMIN_SECTIONS: AdminSection[] = [
  { key: 'overview', href: '/admin', labelKey: 'Admin.overviewNav' },
  { key: 'checklist-templates', href: '/admin/checklist-templates', labelKey: 'AdminTemplates.title' },
  { key: 'concepts', href: '/admin/concepts', labelKey: 'AdminConcepts.title' },
  { key: 'budget-templates', href: '/admin/budget-templates', labelKey: 'AdminBudget.title' },
  { key: 'vendors', href: '/admin/vendors', labelKey: 'AdminVendors.title' },
];

/** Strip an optional /en locale prefix, then match the most specific section. */
export function activeSectionKey(pathname: string): string | null {
  const rest = pathname.replace(/^\/en(?=\/|$)/, '') || '/';
  if (rest === '/admin') return 'overview';
  // Non-overview sections: match /admin/<seg> and any sub-path.
  const match = ADMIN_SECTIONS.find(
    (s) => s.key !== 'overview' && (rest === s.href || rest.startsWith(`${s.href}/`)),
  );
  return match?.key ?? null;
}
```

- [ ] **Step 4: Run them to verify they pass**

Run: `npm run test -- lib/admin/gate.test.ts lib/admin/sections.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the overview test (pure helper)**

`lib/admin/overview.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { budgetBaselineStatus } from './overview';

describe('budgetBaselineStatus', () => {
  it('sums only active rows and flags balanced at exactly 100', () => {
    expect(budgetBaselineStatus([
      { defaultPercent: 60, active: true },
      { defaultPercent: 40, active: true },
      { defaultPercent: 99, active: false },
    ])).toEqual({ sum: 100, balanced: true });
  });
  it('flags imbalance when the active sum is not 100', () => {
    expect(budgetBaselineStatus([{ defaultPercent: 60, active: true }])).toEqual({ sum: 60, balanced: false });
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npm run test -- lib/admin/overview.test.ts`
Expected: FAIL ("Cannot find module './overview'").

- [ ] **Step 7: Implement `overview.ts`**

`lib/admin/overview.ts`:

```typescript
import { prisma } from '@/lib/db';

export interface AdminOverview {
  checklistTemplates: { total: number; active: number };
  concepts: { total: number; active: number };
  vendors: { total: number; active: number };
  budget: { sum: number; balanced: boolean };
}

/** Sum active baseline percentages and flag whether they total exactly 100. */
export function budgetBaselineStatus(rows: { defaultPercent: number; active: boolean }[]): {
  sum: number;
  balanced: boolean;
} {
  const sum = rows.filter((r) => r.active).reduce((s, r) => s + r.defaultPercent, 0);
  return { sum, balanced: sum === 100 };
}

/** Read-only counts of admin-managed content for the overview page. */
export async function getAdminOverview(): Promise<AdminOverview> {
  const [
    checklistTotal, checklistActive,
    conceptsTotal, conceptsActive,
    vendorsTotal, vendorsActive,
    baselineRows,
  ] = await Promise.all([
    prisma.checklistTemplate.count(),
    prisma.checklistTemplate.count({ where: { active: true } }),
    prisma.concept.count(),
    prisma.concept.count({ where: { active: true } }),
    prisma.vendor.count({ where: { weddingId: null } }),
    prisma.vendor.count({ where: { weddingId: null, active: true } }),
    prisma.budgetTemplate.findMany({ select: { defaultPercent: true, active: true } }),
  ]);
  return {
    checklistTemplates: { total: checklistTotal, active: checklistActive },
    concepts: { total: conceptsTotal, active: conceptsActive },
    vendors: { total: vendorsTotal, active: vendorsActive },
    budget: budgetBaselineStatus(baselineRows),
  };
}
```

- [ ] **Step 8: Run it; run the whole admin domain; typecheck; lint; commit**

Run: `npm run test -- lib/admin && npm run typecheck && npm run lint`
Expected: PASS.

```bash
git add lib/admin
git commit -m "feat: add admin domain (live-DB gate decision, nav sections, overview counts)"
```

---

### Task 3: Shared admin layout + nav + overview page + i18n

**Files:**
- Create: `app/[locale]/admin/layout.tsx`, `app/[locale]/admin/admin-nav.tsx`, `app/[locale]/admin/admin-panel.test.tsx`
- Modify: `app/[locale]/admin/page.tsx`, `messages/en.json`, `messages/he.json`

**Interfaces:**
- Consumes: `adminGateDecision`, `ADMIN_SECTIONS`, `activeSectionKey` (`@/lib/admin/*`); `getAdminOverview` (`@/lib/admin/overview`); `auth`, `prisma`, `redirect`, `Link`, `usePathname` (i18n navigation).

- [ ] **Step 1: Expand the `Admin` i18n namespace (English)**

In `messages/en.json`, replace the `Admin` namespace (currently `{ "placeholder": "…" }`) with:

```json
"Admin": {
  "placeholder": "Admin area (admins only)",
  "panelTitle": "Admin",
  "backToApp": "Back to app",
  "overviewNav": "Overview",
  "overviewTitle": "Overview",
  "countActive": "{active} active of {total}",
  "budgetCardTitle": "Budget baseline",
  "budgetBalanced": "Active percentages total 100%.",
  "budgetImbalanced": "Active percentages total {sum}% (should be 100%).",
  "open": "Open"
}
```

- [ ] **Step 2: Expand the `Admin` namespace (Hebrew, identical keys)**

In `messages/he.json`:

```json
"Admin": {
  "placeholder": "אזור ניהול (מנהלים בלבד)",
  "panelTitle": "ניהול",
  "backToApp": "חזרה לאפליקציה",
  "overviewNav": "סקירה",
  "overviewTitle": "סקירה",
  "countActive": "{active} פעילים מתוך {total}",
  "budgetCardTitle": "בסיס תקציב",
  "budgetBalanced": "סך האחוזים הפעילים 100%.",
  "budgetImbalanced": "סך האחוזים הפעילים {sum}% (צריך להיות 100%).",
  "open": "פתחו"
}
```

- [ ] **Step 3: Verify i18n parses + parity**

Run: `npm run test && npm run lint`
Expected: PASS (JSON valid; he/en parity holds).

- [ ] **Step 4: Implement the section nav (client)**

`app/[locale]/admin/admin-nav.tsx`:

```tsx
'use client';

import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/lib/i18n/navigation';
import { ADMIN_SECTIONS, activeSectionKey } from '@/lib/admin/sections';

export function AdminNav() {
  const t = useTranslations();
  const pathname = usePathname();
  const active = activeSectionKey(pathname);

  return (
    <nav className="flex flex-row gap-2 overflow-x-auto sm:flex-col sm:overflow-visible">
      {ADMIN_SECTIONS.map((section) => (
        <Link
          key={section.key}
          href={section.href}
          aria-current={active === section.key ? 'page' : undefined}
          className={
            active === section.key
              ? 'rounded-card bg-primary px-3 py-2 text-sm font-medium text-background'
              : 'rounded-card px-3 py-2 text-sm text-text hover:bg-surface'
          }
        >
          {t(section.labelKey)}
        </Link>
      ))}
    </nav>
  );
}
```

Note: `usePathname` from `@/lib/i18n/navigation` returns the locale-stripped path in this project's next-intl setup; `activeSectionKey` also tolerates an `/en` prefix defensively. If `usePathname` is not exported there, import it from `next-intl/navigation`'s configured helpers as the sibling client components do — check `@/lib/i18n/navigation`'s exports first.

- [ ] **Step 5: Implement the shared layout (the gate + shell)**

`app/[locale]/admin/layout.tsx`:

```tsx
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { redirect, Link } from '@/lib/i18n/navigation';
import { adminGateDecision } from '@/lib/admin/gate';
import { AdminNav } from './admin-nav';

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Admin');

  const session = await auth();
  const dbRole = session?.user?.id
    ? (await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } }))?.role ?? null
    : null;

  const decision = adminGateDecision(session?.user?.id, dbRole);
  if (decision === 'login') redirect({ href: '/login', locale });
  if (decision === 'dashboard') redirect({ href: '/dashboard', locale });

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6 sm:flex-row sm:p-8">
      <aside className="flex flex-col gap-4 sm:w-56 sm:shrink-0">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-xl text-text">{t('panelTitle')}</h1>
          <Link href="/dashboard" className="text-xs text-primary">{t('backToApp')}</Link>
        </div>
        <AdminNav />
      </aside>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
```

- [ ] **Step 6: Rewrite the overview page**

Replace `app/[locale]/admin/page.tsx`:

```tsx
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/navigation';
import { getAdminOverview } from '@/lib/admin/overview';

export default async function AdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Admin');
  const tTemplates = await getTranslations('AdminTemplates');
  const tConcepts = await getTranslations('AdminConcepts');
  const tBudget = await getTranslations('AdminBudget');
  const tVendors = await getTranslations('AdminVendors');

  const overview = await getAdminOverview();

  function Card({ title, href, children }: { title: string; href: string; children: React.ReactNode }) {
    return (
      <section className="flex flex-col gap-2 rounded-card bg-surface p-5 shadow-sm">
        <h2 className="font-display text-lg text-text">{title}</h2>
        <div className="flex-1 text-sm text-muted">{children}</div>
        <Link href={href} className="mt-2 inline-block self-start rounded-card bg-primary px-4 py-2 text-sm font-medium text-background">
          {t('open')}
        </Link>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-display text-2xl text-text">{t('overviewTitle')}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card title={tTemplates('title')} href="/admin/checklist-templates">
          {t('countActive', { active: overview.checklistTemplates.active, total: overview.checklistTemplates.total })}
        </Card>
        <Card title={tConcepts('title')} href="/admin/concepts">
          {t('countActive', { active: overview.concepts.active, total: overview.concepts.total })}
        </Card>
        <Card title={tVendors('title')} href="/admin/vendors">
          {t('countActive', { active: overview.vendors.active, total: overview.vendors.total })}
        </Card>
        <Card title={t('budgetCardTitle')} href="/admin/budget-templates">
          <span className={overview.budget.balanced ? 'text-muted' : 'text-red-600'}>
            {overview.budget.balanced ? t('budgetBalanced') : t('budgetImbalanced', { sum: overview.budget.sum })}
          </span>
        </Card>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Write the component test**

`app/[locale]/admin/admin-panel.test.tsx` — render the nav with `NextIntlClientProvider` (mirror `concepts-view.test.tsx`); mock `@/lib/i18n/navigation` for `Link`/`usePathname` (sibling-test idiom).

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';

vi.mock('@/lib/i18n/navigation', () => ({
  Link: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>{children}</a>
  ),
  usePathname: () => '/admin/concepts',
}));

import { AdminNav } from './admin-nav';

describe('AdminNav', () => {
  it('renders all sections and marks the active one', () => {
    render(<NextIntlClientProvider locale="en" messages={en}><AdminNav /></NextIntlClientProvider>);
    expect(screen.getByText('Overview')).toBeTruthy();
    expect(screen.getByText('Concepts')).toBeTruthy();
    const active = screen.getByText('Concepts').closest('a');
    expect(active?.getAttribute('aria-current')).toBe('page');
  });
});
```

- [ ] **Step 8: Run the component test; full suite; typecheck; lint**

Run: `npm run test -- "app/[locale]/admin/admin-panel.test.tsx" && npm run test && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add "app/[locale]/admin/layout.tsx" "app/[locale]/admin/admin-nav.tsx" "app/[locale]/admin/admin-panel.test.tsx" "app/[locale]/admin/page.tsx" messages/en.json messages/he.json
git commit -m "feat: add shared admin shell (live-DB gate, section nav, overview)"
```

---

### Task 4: Rehost the four CMS pages + image AdminResult.ok cleanup

**Files:**
- Modify: `app/[locale]/admin/checklist-templates/page.tsx`, `concepts/page.tsx`, `budget-templates/page.tsx`, `vendors/page.tsx`
- Modify: `app/[locale]/admin/concepts/concept-form.tsx`, `app/[locale]/admin/vendors/vendor-form.tsx`

**Interfaces:**
- Consumes: the shared layout (Task 3) now gates + wraps all `/admin/*`.

- [ ] **Step 1: Drop the per-page gate + outer wrapper from all four CMS loaders**

For EACH of the four page files, remove (a) the `auth()` call + the role-gate `redirect` block, and (b) the outer `<main className="mx-auto …">` wrapper — return the content component directly (the layout provides the container). Keep `setRequestLocale`, the data fetching, and the serialization. Remove now-unused imports (`auth`, and `redirect` if unused elsewhere in the file, and `prisma`/`session` if only used by the gate).

Example — `app/[locale]/admin/concepts/page.tsx` becomes:

```tsx
import { setRequestLocale } from 'next-intl/server';
import { getAllConcepts } from '@/lib/concepts/queries';
import { ConceptsAdmin, type SerializedAdminConcept } from './concepts-admin';

export default async function AdminConceptsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const concepts = await getAllConcepts();
  const serialized: SerializedAdminConcept[] = concepts.map((c) => ({
    /* …unchanged mapping… */
  }));

  return <ConceptsAdmin concepts={serialized} />;
}
```

Apply the equivalent edit to `checklist-templates/page.tsx`, `budget-templates/page.tsx`, and `vendors/page.tsx`: delete their `auth`/role-gate lines and unwrap the `<main>` (return the `*Admin` component directly). Do NOT change what data they fetch or how they serialize it. After editing, verify no unused imports remain (lint will catch it).

- [ ] **Step 2: Fix the image `AdminResult.ok` handling in `concept-form.tsx`**

In `app/[locale]/admin/concepts/concept-form.tsx`, the image add/delete handlers currently call the action then `onChanged()` unconditionally. Guard on the result and surface the shared error. The `NestedEditors`/image sub-component already has a `t` (translations) in scope; add an error state like the concept-save path (which does `if (!r.ok) { … }`). Change the add handler:

```tsx
    const r = await addImage(concept.id, { url: url.trim(), sortOrder: concept.images.length });
    if (!r.ok) { setError(true); return; }
    setUrl('');
    onChanged();
```

and the delete handler:

```tsx
    const r = await deleteImage(imageId);
    if (!r.ok) { setError(true); return; }
    onChanged();
```

Add a local `const [error, setError] = useState(false);` in that sub-component and render `{error ? <p className="text-sm text-red-600">{t('error')}</p> : null}` near the image controls (reuse the existing `AdminConcepts`/`t('error')` key already used by the concept-save path). Reset `setError(false)` at the start of each handler.

- [ ] **Step 3: Fix the image `AdminResult.ok` handling in `vendor-form.tsx`**

Apply the same pattern in `app/[locale]/admin/vendors/vendor-form.tsx`'s `VendorImageEditor`:

```tsx
    const r = await addVendorImage(vendor.id, { url: url.trim(), sortOrder: vendor.images.length });
    if (!r.ok) { setError(true); return; }
    setUrl('');
    onChanged();
```

```tsx
    const r = await deleteVendorImage(imageId);
    if (!r.ok) { setError(true); return; }
    onChanged();
```

Add the `error` state + the `{error ? … t('error') …}` line (reuse the `AdminVendors.error` key already present).

- [ ] **Step 4: Write/extend a component test for the image-error handling**

Add to the concepts admin test (`app/[locale]/admin/concepts/concepts-admin.test.tsx`) — mock `addImage` to return `{ ok: false, error: 'INVALID' }`, render the concept form's image editor, trigger add, and assert the error text renders and `onChanged` is NOT called. (Match the file's existing mock setup for `@/lib/actions/admin-concepts`.) If wiring a full form-interaction test is disproportionate, assert at minimum that the handler path checks `.ok` — but prefer a real RTL interaction if the existing test already mounts the form.

- [ ] **Step 5: Run the affected tests; full suite; typecheck; lint**

Run: `npm run test -- "app/[locale]/admin" && npm run test && npm run typecheck && npm run lint`
Expected: PASS. (Existing admin CMS component tests still pass — they render the `*Admin` content components, which are unchanged; only the page loaders + image handlers changed.)

- [ ] **Step 6: Commit**

```bash
git add "app/[locale]/admin/checklist-templates/page.tsx" "app/[locale]/admin/concepts/page.tsx" "app/[locale]/admin/budget-templates/page.tsx" "app/[locale]/admin/vendors/page.tsx" "app/[locale]/admin/concepts/concept-form.tsx" "app/[locale]/admin/vendors/vendor-form.tsx" "app/[locale]/admin/concepts/concepts-admin.test.tsx"
git commit -m "refactor: rehost admin CMSes in the shared shell; surface image action errors"
```

---

### Task 5: E2E + acceptance verification

**Files:**
- Create: `e2e/admin.spec.ts`

- [ ] **Step 1: Write the E2E spec**

`e2e/admin.spec.ts`. The primary, robust test is the **non-admin gate** (needs no admin user). For the **admin-sees-shell** test, promote a freshly-registered user to `ADMIN` in the DB, then re-login so the JWT carries `ADMIN` (the edge `proxy.ts` `/admin` gate reads the JWT, and the layout then confirms live-DB). Copy the inline register/login helpers from `e2e/concepts.spec.ts` (prefix `e2e-admin-`).

```typescript
import { test, expect, type Page } from '@playwright/test';
import { prisma } from '@/lib/db';
// ---- paste the inline register/login/onboard helpers from e2e/concepts.spec.ts (prefix e2e-admin-) ----

test.describe('Admin panel', () => {
  test('a non-admin is redirected away from /admin and every sub-route', async ({ page }) => {
    await registerAndOnboard(page); // a normal USER, lands on /dashboard
    for (const path of ['/admin', '/admin/concepts', '/admin/vendors', '/admin/budget-templates', '/admin/checklist-templates']) {
      await page.goto(path);
      await expect(page).not.toHaveURL(new RegExp(path.replace('/', '\\/') + '$'));
      // proxy/layout bounce lands on /dashboard (or /login if the session dropped)
      await expect(page).toHaveURL(/\/(dashboard|login)/);
    }
  });

  test('an admin sees the shell overview + nav and can open a CMS', async ({ page }) => {
    const email = uniqueEmail();
    await registerAndLogin(page, email);      // creates the user (role USER)
    await fillNamesAndContinue(page); await skipRemainingSteps(page); await finishOnboarding(page);
    // Promote to ADMIN in the DB, then re-login so the JWT also carries ADMIN (proxy edge gate).
    await prisma.user.update({ where: { email }, data: { role: 'ADMIN' } });
    await page.goto('/login');
    await page.getByLabel(/email|אימייל/i).fill(email);
    await page.getByLabel(/password|סיסמה/i).fill('pw12345678');
    await page.getByRole('button', { name: /log in|sign in|התחבר/i }).click();

    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: /overview|סקירה/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /concepts|קונספטים/i })).toBeVisible(); // nav
    await page.getByRole('link', { name: /concepts|קונספטים/i }).first().click();
    await expect(page).toHaveURL(/\/admin\/concepts/);
  });
});

test.afterAll(async () => { await prisma.$disconnect(); });
```

Adjust selectors to the shipped login form + `Admin`/CMS i18n labels (read them). Confirm the Playwright process can import `@/lib/db` and reach the same DB the dev server uses (the webserver's `DATABASE_URL` is in the env); if a spec-side prisma import proves impractical in this harness, instead seed a known admin in `prisma/seed.ts` and log in as them — but do NOT weaken the non-admin gate assertions. Do NOT delete an assertion to make the admin test pass; if promotion+relogin can't be made to work, STOP and report it.

- [ ] **Step 2: Run the E2E spec**

Run: `npm run test:e2e -- admin.spec.ts`
Expected: PASS. (Restart a stale `next dev` if a prior server holds an old client.)

- [ ] **Step 3: Full verification sweep against acceptance criteria**

```bash
npm run lint && npm run typecheck && npm run test && npm run test:e2e
```
Walk the spec's Acceptance criteria (1–9) and confirm each maps to a passing test or a manual check. Record the unit + e2e counts.

- [ ] **Step 4: Commit**

```bash
git add e2e/admin.spec.ts
git commit -m "test: add admin panel e2e (non-admin gate, admin shell + nav)"
```

---

### Final: Whole-branch review

- [ ] **Step 1: Run the full gate**

```bash
npm run lint && npm run typecheck && npm run test && npm run test:e2e
```
Expected: all green. Record counts.

- [ ] **Step 2: Adversarial whole-branch review**

Request a review of the whole `phase-8-admin` diff (final reviewer on the most capable model). Focus areas:
- **Gate correctness & no regression** — the layout gates ALL `/admin/*` via live-DB (`adminGateDecision`), and every one of the four CMS pages had its own gate REMOVED (confirm none is now ungated in a way the layout doesn't cover; confirm the layout actually wraps them — they're under `app/[locale]/admin/`). A stale-JWT demoted admin is bounced.
- **No lost functionality** — the four CMSes still fetch/serialize/render the same data; only the gate + `<main>` wrapper were removed; their forms/actions/tests still pass.
- **`updateConcept`** — writes content only; `isPremium`/`active`/`sortOrder` preserved on partial edit (regression-tested); export-parity test present.
- **Image-ok** — concepts + vendors image add/delete now check `.ok` and surface errors; no unconditional refresh-on-failure.
- **i18n** — he/en parity for the expanded `Admin` namespace; no hard-coded strings; RTL logical props; sidebar mirrors.
- **No new schema / no user-management / no role-change surface** introduced.

- [ ] **Step 3: Address findings; update the implementation log**

Apply Critical/Important fixes (commit each). Add the Phase 8 section to `docs/superpowers/IMPLEMENTATION-LOG.md` (mirror the Phase 7 entry: delivered summary, verification counts, key decisions/deviations; mark RESOLVED the backlog items now closed — stale-JWT admin loaders, `updateConcept` flag-stomp, `admin-concepts` export-parity, image-ok checks). Commit.

- [ ] **Step 4: Push / PR** (only on the user's explicit go-ahead — never commit/push without per-request permission).
