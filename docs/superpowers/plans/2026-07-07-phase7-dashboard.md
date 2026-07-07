# Phase 7 — Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the placeholder `/dashboard` into a real read-only home view — a wedding-date countdown hero, four dual-mode overview cards (checklist / budget / vendors / concept), and a "next up" task list — all aggregated from existing phase data.

**Architecture:** A pure, unit-tested aggregation seam (`lib/dashboard/aggregate.ts`) composes the existing per-phase queries (`getTasks`, `rollupTasks`, `getWeddingQuotes`, selected-concept lookup) into one `DashboardData` payload and computes all derivations (countdown, progress, budget, vendor counts, next-up). The `/dashboard` RSC loader calls it once and renders the hero + card grid + next-up. No new schema, no mutations.

**Tech Stack:** Next.js 16 (App Router, RSC), Prisma 6.19.3 + Postgres, next-intl (he default/RTL + en), Vitest (+ @testing-library/react), Playwright, Tailwind v4 design tokens.

## Global Constraints

- **Read-only, no new schema, no mutations** — Phase 7 only reads existing models (`Wedding`, `Task`, `VendorQuote`, `Concept`) and renders. No Prisma changes, no server actions.
- **Pure derivations are injectable-`now`** — the value helpers take `now: Date` as a parameter (never call `Date.now()` internally) so they're deterministic and unit-testable; the page passes `new Date()`.
- **No hard-coded UI strings** — all chrome via the `Dashboard` i18n namespace, identical key sets in `messages/he.json`/`messages/en.json` (ESLint + key-parity test enforce this). Reuse the existing `Dashboard` nudge keys for the dual-mode nudges.
- **RTL-safe** — logical Tailwind properties (`ps-`/`pe-`/`ms-`/`me-`/`text-start`), never `pl-`/`pr-`/`text-left`. `₪`/number/date via `toLocaleString(locale)` / `Intl` with the locale.
- **Whole-shekel integers** for money (matches the app).
- **Reuse existing queries/resolvers** — `getTasks` (`@/lib/checklist/queries`), `rollupTasks` (`@/lib/budget/rollup`), `getWeddingQuotes` (`@/lib/vendors/queries`), `resolveConceptTitle` (`@/lib/concepts/title`), `getCurrentWedding` (`@/lib/wedding/queries`). Do not duplicate their logic.
- **Lint/type gate** — `npm run lint` (`--max-warnings 0`) and `npm run typecheck` stay green.
- **Design tokens** — `bg-surface`, `text-text`, `text-muted`, `bg-primary`, `text-background`, `bg-accent/20`, `rounded-card`, `font-display`, `font-body`. Match the "old-money" look.

## File Structure

**Create:**
- `lib/dashboard/aggregate.ts` — pure derivations (`daysUntilWedding`, `checklistProgress`, `budgetSummary`, `vendorCounts`, `nextUpTasks`) + composer `getDashboardData` + types.
- `lib/dashboard/aggregate.test.ts` — unit tests for the pure derivations.
- `app/[locale]/(app)/dashboard/countdown-hero.tsx` — partner names + days-to-go (+ no-date/approximate/passed states).
- `app/[locale]/(app)/dashboard/overview-cards.tsx` — the four dual-mode cards (checklist/budget/vendors/concept).
- `app/[locale]/(app)/dashboard/next-up.tsx` — the upcoming/overdue task list.
- `app/[locale]/(app)/dashboard/dashboard-view.test.tsx` — component tests (hero states + a dual-mode card).

**Modify:**
- `app/[locale]/(app)/dashboard/page.tsx` — replace the placeholder + inline nudge cards with the aggregator + new components.
- `messages/en.json` + `messages/he.json` — expand the `Dashboard` namespace (hero, checklist card, summaries, next-up); keep the existing nudge keys.

---

### Task 1: Dashboard aggregation (`lib/dashboard/aggregate.ts`)

**Files:**
- Create: `lib/dashboard/aggregate.ts`, `lib/dashboard/aggregate.test.ts`

**Interfaces:**
- Consumes: `getTasks` (`@/lib/checklist/queries`), `rollupTasks` (`@/lib/budget/rollup`), `getWeddingQuotes` (`@/lib/vendors/queries`), `prisma` (`@/lib/db`); `Wedding`, `TaskStatus`, `TitleLocale`, `VendorQuoteStatus` from `@prisma/client`.
- Produces:
  - Pure: `daysUntilWedding(weddingDate: Date | null, now: Date): number | null`; `checklistProgress(tasks, now): ChecklistSummary`; `budgetSummary(budgetTotal: number | null, tasks): BudgetSummary | null`; `vendorCounts(quotes): VendorCounts`; `nextUpTasks(tasks, now, limit): NextUpTask[]`.
  - `getDashboardData(wedding: Wedding, now: Date): Promise<DashboardData>`.
  - Types `ChecklistSummary`, `BudgetSummary`, `VendorCounts`, `NextUpTask`, `ConceptSummary`, `DashboardData`.

- [ ] **Step 1: Write the failing tests**

`lib/dashboard/aggregate.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  daysUntilWedding, checklistProgress, budgetSummary, vendorCounts, nextUpTasks,
} from './aggregate';

const D = (s: string) => new Date(s);
const NOW = D('2026-07-07T09:00:00Z');

describe('daysUntilWedding', () => {
  it('returns whole days to a future date', () => {
    expect(daysUntilWedding(D('2026-07-17T00:00:00Z'), NOW)).toBe(10);
  });
  it('returns 0 for today and negative for the past', () => {
    expect(daysUntilWedding(D('2026-07-07T23:00:00Z'), NOW)).toBe(0);
    expect(daysUntilWedding(D('2026-07-05T00:00:00Z'), NOW)).toBe(-2);
  });
  it('returns null when there is no date', () => {
    expect(daysUntilWedding(null, NOW)).toBeNull();
  });
});

const task = (over: Partial<Parameters<typeof checklistProgress>[0][number]>) => ({
  id: 'x', title_en: 'T', title_he: 'ט', titleLocale: 'AUTO' as const,
  category: 'MUSIC' as const, status: 'OPEN' as const,
  dueDate: null as Date | null, amountPaid: null as number | null,
  estimatedCost: null as number | null, deletedAt: null as Date | null, ...over,
});

describe('checklistProgress', () => {
  it('counts done/total/pct and overdue (open + past due)', () => {
    const r = checklistProgress([
      task({ status: 'DONE' }),
      task({ status: 'OPEN', dueDate: D('2026-07-01T00:00:00Z') }), // overdue
      task({ status: 'OPEN', dueDate: D('2026-08-01T00:00:00Z') }), // future
    ], NOW);
    expect(r).toEqual({ done: 1, total: 3, pct: 33, overdue: 1 });
  });
  it('excludes soft-deleted tasks and handles empty', () => {
    expect(checklistProgress([task({ status: 'DONE', deletedAt: D('2026-01-01') })], NOW))
      .toEqual({ done: 0, total: 0, pct: 0, overdue: 0 });
  });
});

describe('budgetSummary', () => {
  it('is null when no budget is set', () => {
    expect(budgetSummary(null, [])).toBeNull();
  });
  it('sums committed (paid on DONE) and computes remaining/pct', () => {
    const r = budgetSummary(100000, [
      task({ status: 'DONE', amountPaid: 20000 }),
      task({ status: 'OPEN', amountPaid: 9999 }), // not committed (not DONE)
    ]);
    expect(r).toEqual({ total: 100000, committed: 20000, remaining: 80000, pct: 20 });
  });
});

describe('vendorCounts', () => {
  it('counts all quotes as shortlisted and BOOKED as booked', () => {
    expect(vendorCounts([{ status: 'CONSIDERING' }, { status: 'BOOKED' }, { status: 'QUOTED' }]))
      .toEqual({ shortlisted: 3, booked: 1 });
  });
});

describe('nextUpTasks', () => {
  it('returns soonest OPEN tasks, nulls last, overdue flagged, limited', () => {
    const r = nextUpTasks([
      task({ id: 'done', status: 'DONE', dueDate: D('2026-07-08') }),
      task({ id: 'nodate', status: 'OPEN', dueDate: null }),
      task({ id: 'overdue', status: 'OPEN', dueDate: D('2026-07-01') }),
      task({ id: 'soon', status: 'OPEN', dueDate: D('2026-07-10') }),
    ], NOW, 2);
    expect(r.map((t) => t.id)).toEqual(['overdue', 'soon']);
    expect(r[0].overdue).toBe(true);
    expect(r[1].overdue).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test -- lib/dashboard/aggregate.test.ts`
Expected: FAIL ("Cannot find module './aggregate'").

- [ ] **Step 3: Implement the aggregator**

`lib/dashboard/aggregate.ts`:

```typescript
import type { TaskStatus, TitleLocale, VendorQuoteStatus, Wedding } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getTasks } from '@/lib/checklist/queries';
import { getWeddingQuotes } from '@/lib/vendors/queries';
import { rollupTasks } from '@/lib/budget/rollup';

export interface ChecklistSummary { done: number; total: number; pct: number; overdue: number }
export interface BudgetSummary { total: number; committed: number; remaining: number; pct: number }
export interface VendorCounts { shortlisted: number; booked: number }
export interface ConceptSummary {
  id: string; title_en: string; title_he: string; titleLocale: TitleLocale; palette: string[];
}
export interface NextUpTask {
  id: string; title_en: string; title_he: string; titleLocale: TitleLocale;
  dueDate: string | null; overdue: boolean;
}
export interface DashboardData {
  partner1Name: string | null;
  partner2Name: string | null;
  weddingDate: string | null;
  countdownDays: number | null;
  dateIsApproximate: boolean;
  checklist: ChecklistSummary;
  budget: BudgetSummary | null;
  vendors: VendorCounts;
  concept: ConceptSummary | null;
  nextUp: NextUpTask[];
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Whole days from `now` to `weddingDate` (0 = today, negative = past); null if no date. */
export function daysUntilWedding(weddingDate: Date | null, now: Date): number | null {
  if (!weddingDate) return null;
  const ms = startOfDay(weddingDate).getTime() - startOfDay(now).getTime();
  return Math.round(ms / 86_400_000);
}

type ProgressTask = { status: TaskStatus; dueDate: Date | null; deletedAt: Date | null };

export function checklistProgress(tasks: ProgressTask[], now: Date): ChecklistSummary {
  const active = tasks.filter((t) => !t.deletedAt);
  const total = active.length;
  const done = active.filter((t) => t.status === 'DONE').length;
  const today = startOfDay(now).getTime();
  const overdue = active.filter(
    (t) => t.status === 'OPEN' && t.dueDate != null && startOfDay(t.dueDate).getTime() < today,
  ).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return { done, total, pct, overdue };
}

type RollupTask = Parameters<typeof rollupTasks>[0][number];

export function budgetSummary(budgetTotal: number | null, tasks: RollupTask[]): BudgetSummary | null {
  if (budgetTotal == null) return null;
  const { committed } = rollupTasks(tasks);
  const committedTotal = Object.values(committed).reduce((s, n) => s + (n ?? 0), 0);
  const remaining = budgetTotal - committedTotal;
  const pct = budgetTotal > 0 ? Math.round((committedTotal / budgetTotal) * 100) : 0;
  return { total: budgetTotal, committed: committedTotal, remaining, pct };
}

export function vendorCounts(quotes: { status: VendorQuoteStatus }[]): VendorCounts {
  return { shortlisted: quotes.length, booked: quotes.filter((q) => q.status === 'BOOKED').length };
}

type NextUpInput = {
  id: string; title_en: string; title_he: string; titleLocale: TitleLocale;
  status: TaskStatus; dueDate: Date | null; deletedAt: Date | null;
};

export function nextUpTasks(tasks: NextUpInput[], now: Date, limit: number): NextUpTask[] {
  const today = startOfDay(now).getTime();
  const open = tasks.filter((t) => !t.deletedAt && t.status === 'OPEN');
  const sorted = [...open].sort((a, b) => {
    if (a.dueDate == null && b.dueDate == null) return 0;
    if (a.dueDate == null) return 1; // nulls last
    if (b.dueDate == null) return -1;
    return a.dueDate.getTime() - b.dueDate.getTime();
  });
  return sorted.slice(0, limit).map((t) => ({
    id: t.id,
    title_en: t.title_en,
    title_he: t.title_he,
    titleLocale: t.titleLocale,
    dueDate: t.dueDate ? t.dueDate.toISOString() : null,
    overdue: t.dueDate != null && startOfDay(t.dueDate).getTime() < today,
  }));
}

/** Compose the per-phase queries into one dashboard payload. `now` is injected for testability. */
export async function getDashboardData(wedding: Wedding, now: Date): Promise<DashboardData> {
  const [tasks, quotes, concept] = await Promise.all([
    getTasks(wedding.id),
    getWeddingQuotes(wedding.id),
    wedding.selectedConceptId
      ? prisma.concept.findUnique({
          where: { id: wedding.selectedConceptId },
          select: { id: true, title_en: true, title_he: true, titleLocale: true, palette: true },
        })
      : Promise.resolve(null),
  ]);

  return {
    partner1Name: wedding.partner1Name,
    partner2Name: wedding.partner2Name,
    weddingDate: wedding.weddingDate ? wedding.weddingDate.toISOString() : null,
    countdownDays: daysUntilWedding(wedding.weddingDate, now),
    dateIsApproximate: wedding.dateIsApproximate,
    checklist: checklistProgress(tasks, now),
    budget: budgetSummary(wedding.budgetTotal, tasks),
    vendors: vendorCounts(quotes),
    concept: concept ?? null,
    nextUp: nextUpTasks(tasks, now, 3),
  };
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm run test -- lib/dashboard/aggregate.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Typecheck, lint & commit**

Run: `npm run typecheck && npm run lint`
Expected: PASS.

```bash
git add lib/dashboard
git commit -m "feat: add dashboard aggregation (countdown, progress, budget, vendors, next-up)"
```

---

### Task 2: Dashboard UI + i18n

**Files:**
- Modify: `app/[locale]/(app)/dashboard/page.tsx`, `messages/en.json`, `messages/he.json`
- Create: `app/[locale]/(app)/dashboard/countdown-hero.tsx`, `overview-cards.tsx`, `next-up.tsx`, `dashboard-view.test.tsx`

**Interfaces:**
- Consumes: `getDashboardData` + the types from `@/lib/dashboard/aggregate`; `resolveConceptTitle` (`@/lib/concepts/title`); `resolveTaskTitle` (`@/lib/checklist/title`); `getCurrentWedding`; `Link` (`@/lib/i18n/navigation`).
- Produces: the rendered `/dashboard`.

- [ ] **Step 1: Expand the `Dashboard` i18n namespace (English)**

In `messages/en.json`, replace the `Dashboard` namespace's contents with (keep the existing nudge keys, add the new ones):

```json
"Dashboard": {
  "placeholder": "Dashboard (protected)",
  "heroCouple": "{p1} & {p2}",
  "heroCoupleSolo": "{p1}",
  "daysToGo": "{days, plural, =0 {The big day is today!} one {# day to go} other {# days to go}}",
  "datePassed": "Congratulations — enjoy married life!",
  "dateApproximate": "Your date is still approximate",
  "noDateTitle": "Set your wedding date",
  "noDateCta": "Add a date",
  "checklistTitle": "Checklist",
  "checklistSummary": "{done} of {total} done",
  "checklistOverdue": "{count, plural, one {# overdue} other {# overdue}}",
  "checklistEmpty": "Your checklist is ready",
  "checklistCta": "Open checklist",
  "vendorsSummary": "{shortlisted} shortlisted · {booked} booked",
  "conceptChosen": "Your concept: {name}",
  "nextUpTitle": "Next up",
  "nextUpEmpty": "You're all caught up.",
  "nextUpOverdue": "Overdue",
  "noDueDate": "No date",
  "chooseConceptTitle": "Choose your wedding concept",
  "chooseConceptBody": "Pick a style that speaks to you and shape your day around it.",
  "chooseConceptCta": "Browse concepts",
  "budgetTitle": "Plan your budget",
  "budgetBody": "Set a total and let us split it across your categories.",
  "budgetCta": "Open budget",
  "budgetSummary": "Budget: {committed} committed of {total}",
  "vendorsTitle": "Find your vendors",
  "vendorsBody": "Browse suppliers matched to your area and budget.",
  "vendorsCta": "Browse vendors"
}
```

- [ ] **Step 2: Expand the `Dashboard` namespace (Hebrew)**

In `messages/he.json`, mirror it with identical keys:

```json
"Dashboard": {
  "placeholder": "לוח בקרה (מוגן)",
  "heroCouple": "{p1} ו{p2}",
  "heroCoupleSolo": "{p1}",
  "daysToGo": "{days, plural, =0 {היום זה קורה!} one {נותר יום אחד} other {נותרו # ימים}}",
  "datePassed": "מזל טוב — תיהנו מהחיים הנשואים!",
  "dateApproximate": "התאריך שלכם עדיין משוער",
  "noDateTitle": "הגדירו את תאריך החתונה",
  "noDateCta": "הוספת תאריך",
  "checklistTitle": "צ'ק ליסט",
  "checklistSummary": "{done} מתוך {total} הושלמו",
  "checklistOverdue": "{count, plural, one {משימה אחת באיחור} other {# משימות באיחור}}",
  "checklistEmpty": "הצ'ק ליסט שלכם מוכן",
  "checklistCta": "פתחו צ'ק ליסט",
  "vendorsSummary": "{shortlisted} ברשימה · {booked} הוזמנו",
  "conceptChosen": "הקונספט שלכם: {name}",
  "nextUpTitle": "הבא בתור",
  "nextUpEmpty": "אתם מעודכנים לגמרי.",
  "nextUpOverdue": "באיחור",
  "noDueDate": "אין תאריך",
  "chooseConceptTitle": "בחרו את קונספט החתונה",
  "chooseConceptBody": "בחרו סגנון שמדבר אליכם ובנו סביבו את היום.",
  "chooseConceptCta": "עיון בקונספטים",
  "budgetTitle": "תכננו את התקציב",
  "budgetBody": "הגדירו סכום כולל ואנחנו נחלק אותו בין הקטגוריות.",
  "budgetCta": "פתחו תקציב",
  "budgetSummary": "תקציב: {committed} שולמו מתוך {total}",
  "vendorsTitle": "מצאו את הספקים שלכם",
  "vendorsBody": "עיינו בספקים שתואמים לאזור ולתקציב שלכם.",
  "vendorsCta": "עיון בספקים"
}
```

- [ ] **Step 3: Verify i18n parses + parity**

Run: `npm run test && npm run lint`
Expected: PASS (JSON valid; he/en key-parity holds).

- [ ] **Step 4: Write the component test**

`app/[locale]/(app)/dashboard/dashboard-view.test.tsx` — render with `NextIntlClientProvider` (mirror `concepts-view.test.tsx`).

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';
import { CountdownHero } from './countdown-hero';
import { OverviewCards } from './overview-cards';

function wrap(ui: React.ReactNode) {
  return render(<NextIntlClientProvider locale="en" messages={en}>{ui}</NextIntlClientProvider>);
}

describe('CountdownHero', () => {
  it('shows days to go for a future date', () => {
    wrap(<CountdownHero locale="en" partner1Name="Maya" partner2Name="Alex" countdownDays={10} dateIsApproximate={false} weddingDate="2026-07-17T00:00:00.000Z" />);
    expect(screen.getByText(/10 days to go/i)).toBeTruthy();
    expect(screen.getByText(/Maya & Alex/i)).toBeTruthy();
  });
  it('shows the set-date state when there is no date', () => {
    wrap(<CountdownHero locale="en" partner1Name="Maya" partner2Name={null} countdownDays={null} dateIsApproximate={false} weddingDate={null} />);
    expect(screen.getByText(/set your wedding date/i)).toBeTruthy();
  });
});

describe('OverviewCards (dual-mode)', () => {
  const base = {
    locale: 'en',
    checklist: { done: 2, total: 5, pct: 40, overdue: 1 },
    vendors: { shortlisted: 3, booked: 1 },
  };
  it('shows the budget summary when a budget exists', () => {
    wrap(<OverviewCards {...base} budget={{ total: 100000, committed: 20000, remaining: 80000, pct: 20 }} concept={null} />);
    expect(screen.getByText(/committed of/i)).toBeTruthy();
  });
  it('shows the budget nudge when no budget is set', () => {
    wrap(<OverviewCards {...base} budget={null} concept={null} />);
    expect(screen.getByText(/plan your budget/i)).toBeTruthy();
  });
});
```

- [ ] **Step 5: Run it to verify it fails**

Run: `npm run test -- "app/[locale]/(app)/dashboard/dashboard-view.test.tsx"`
Expected: FAIL ("Cannot find module './countdown-hero'").

- [ ] **Step 6: Implement `countdown-hero.tsx`**

`app/[locale]/(app)/dashboard/countdown-hero.tsx`:

```tsx
import { useTranslations } from 'next-intl';
import { Link } from '@/lib/i18n/navigation';

interface CountdownHeroProps {
  locale: string;
  partner1Name: string | null;
  partner2Name: string | null;
  countdownDays: number | null;
  dateIsApproximate: boolean;
  weddingDate: string | null;
}

export function CountdownHero(props: CountdownHeroProps) {
  const t = useTranslations('Dashboard');
  const { partner1Name, partner2Name, countdownDays, dateIsApproximate } = props;

  const couple =
    partner1Name && partner2Name
      ? t('heroCouple', { p1: partner1Name, p2: partner2Name })
      : partner1Name
        ? t('heroCoupleSolo', { p1: partner1Name })
        : null;

  return (
    <section className="rounded-card bg-surface p-8 text-center shadow-sm">
      {couple ? <h1 className="font-display text-3xl text-text">{couple}</h1> : null}
      {countdownDays == null ? (
        <div className="mt-3">
          <p className="text-sm text-muted">{t('noDateTitle')}</p>
          <Link href="/settings/wedding" className="mt-2 inline-block rounded-card bg-primary px-4 py-2 text-sm font-medium text-background">
            {t('noDateCta')}
          </Link>
        </div>
      ) : countdownDays < 0 ? (
        <p className="mt-3 font-body text-lg text-text">{t('datePassed')}</p>
      ) : (
        <>
          <p className="mt-3 font-display text-2xl text-primary">{t('daysToGo', { days: countdownDays })}</p>
          {dateIsApproximate ? <p className="mt-1 text-xs text-muted">{t('dateApproximate')}</p> : null}
        </>
      )}
    </section>
  );
}
```

- [ ] **Step 7: Implement `overview-cards.tsx`**

`app/[locale]/(app)/dashboard/overview-cards.tsx` — the four dual-mode cards. `ConceptSummary`/`BudgetSummary`/etc. types come from the aggregator.

```tsx
import { useTranslations } from 'next-intl';
import { Link } from '@/lib/i18n/navigation';
import { resolveConceptTitle } from '@/lib/concepts/title';
import type { BudgetSummary, ChecklistSummary, ConceptSummary, VendorCounts } from '@/lib/dashboard/aggregate';

interface OverviewCardsProps {
  locale: string;
  checklist: ChecklistSummary;
  budget: BudgetSummary | null;
  vendors: VendorCounts;
  concept: ConceptSummary | null;
}

function Card({ title, href, cta, children }: { title: string; href: string; cta: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2 rounded-card bg-surface p-5 shadow-sm">
      <h2 className="font-display text-lg text-text">{title}</h2>
      <div className="flex-1 text-sm text-muted">{children}</div>
      <Link href={href} className="mt-2 inline-block self-start rounded-card bg-primary px-4 py-2 text-sm font-medium text-background">
        {cta}
      </Link>
    </section>
  );
}

export function OverviewCards({ locale, checklist, budget, vendors, concept }: OverviewCardsProps) {
  const t = useTranslations('Dashboard');
  const fmt = (n: number) => `₪${n.toLocaleString(locale)}`;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {/* Checklist */}
      <Card title={t('checklistTitle')} href="/checklist" cta={t('checklistCta')}>
        {checklist.total > 0 ? (
          <div className="flex flex-col gap-2">
            <span>{t('checklistSummary', { done: checklist.done, total: checklist.total })}</span>
            <div className="h-2 w-full overflow-hidden rounded-card bg-background">
              <div className="h-full rounded-card bg-primary" style={{ width: `${checklist.pct}%` }} />
            </div>
            {checklist.overdue > 0 ? <span className="text-red-600">{t('checklistOverdue', { count: checklist.overdue })}</span> : null}
          </div>
        ) : (
          <span>{t('checklistEmpty')}</span>
        )}
      </Card>

      {/* Budget — dual-mode (summary vs nudge body; same CTA either way) */}
      <Card title={t('budgetTitle')} href="/budget" cta={t('budgetCta')}>
        {budget ? (
          <span>{t('budgetSummary', { committed: fmt(budget.committed), total: fmt(budget.total) })}</span>
        ) : (
          <span>{t('budgetBody')}</span>
        )}
      </Card>

      {/* Vendors — dual-mode */}
      <Card title={t('vendorsTitle')} href="/vendors" cta={t('vendorsCta')}>
        {vendors.shortlisted > 0 ? (
          <span>{t('vendorsSummary', { shortlisted: vendors.shortlisted, booked: vendors.booked })}</span>
        ) : (
          <span>{t('vendorsBody')}</span>
        )}
      </Card>

      {/* Concept — dual-mode */}
      <Card title={t('chooseConceptTitle')} href="/concepts" cta={t('chooseConceptCta')}>
        {concept ? (
          <div className="flex flex-col gap-2">
            <span>{t('conceptChosen', { name: resolveConceptTitle(concept, locale) })}</span>
            <div className="flex gap-1">
              {concept.palette.slice(0, 5).map((hex, i) => (
                <span key={`${hex}-${i}`} className="h-5 w-5 rounded-full border border-muted/30" style={{ backgroundColor: hex }} />
              ))}
            </div>
          </div>
        ) : (
          <span>{t('chooseConceptBody')}</span>
        )}
      </Card>
    </div>
  );
}
```

Note: the budget card's `cta` is `t('budgetCta')` in both modes (the label "Open budget" fits set-or-unset); the summary-vs-nudge only swaps the body text. Same idea for vendors/concept.

- [ ] **Step 8: Implement `next-up.tsx`**

`app/[locale]/(app)/dashboard/next-up.tsx`:

```tsx
import { useTranslations } from 'next-intl';
import { Link } from '@/lib/i18n/navigation';
import { resolveTaskTitle } from '@/lib/checklist/title';
import type { NextUpTask } from '@/lib/dashboard/aggregate';

export function NextUp({ locale, tasks }: { locale: string; tasks: NextUpTask[] }) {
  const t = useTranslations('Dashboard');
  const fmtDate = (iso: string) =>
    new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(iso));

  return (
    <section className="flex flex-col gap-2 rounded-card bg-surface p-5 shadow-sm">
      <h2 className="font-display text-lg text-text">{t('nextUpTitle')}</h2>
      {tasks.length === 0 ? (
        <p className="text-sm text-muted">{t('nextUpEmpty')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {tasks.map((task) => (
            <li key={task.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="text-text">{resolveTaskTitle(task, locale)}</span>
              <span className={task.overdue ? 'text-red-600' : 'text-muted'}>
                {task.overdue ? `${t('nextUpOverdue')} · ` : ''}
                {task.dueDate ? fmtDate(task.dueDate) : t('noDueDate')}
              </span>
            </li>
          ))}
        </ul>
      )}
      <Link href="/checklist" className="mt-1 text-sm text-primary">{t('checklistCta')}</Link>
    </section>
  );
}
```

Note: `resolveTaskTitle` (`@/lib/checklist/title`) takes `{ title_en, title_he, titleLocale }` — `NextUpTask` carries exactly those fields.

- [ ] **Step 9: Rewrite the dashboard page loader**

Replace `app/[locale]/(app)/dashboard/page.tsx` entirely:

```tsx
import { setRequestLocale } from 'next-intl/server';
import { auth } from '@/lib/auth';
import { getCurrentWedding } from '@/lib/wedding/queries';
import { redirect } from '@/lib/i18n/navigation';
import { getDashboardData } from '@/lib/dashboard/aggregate';
import { CountdownHero } from './countdown-hero';
import { OverviewCards } from './overview-cards';
import { NextUp } from './next-up';

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user?.id) redirect({ href: '/login', locale });
  const wedding = await getCurrentWedding(session!.user.id);
  if (!wedding) redirect({ href: '/onboarding', locale });

  const data = await getDashboardData(wedding!, new Date());

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6 sm:p-8">
      <CountdownHero
        locale={locale}
        partner1Name={data.partner1Name}
        partner2Name={data.partner2Name}
        countdownDays={data.countdownDays}
        dateIsApproximate={data.dateIsApproximate}
        weddingDate={data.weddingDate}
      />
      <OverviewCards
        locale={locale}
        checklist={data.checklist}
        budget={data.budget}
        vendors={data.vendors}
        concept={data.concept}
      />
      <NextUp locale={locale} tasks={data.nextUp} />
    </main>
  );
}
```

- [ ] **Step 10: Run the component test; full suite; typecheck; lint**

Run: `npm run test -- "app/[locale]/(app)/dashboard" && npm run test && npm run typecheck && npm run lint`
Expected: PASS (the component test + the full unit suite, incl. i18n parity).

- [ ] **Step 11: Commit**

```bash
git add "app/[locale]/(app)/dashboard" messages/en.json messages/he.json
git commit -m "feat: build the dashboard home view (countdown hero, overview cards, next-up)"
```

---

### Task 3: E2E + acceptance verification

**Files:**
- Create: `e2e/dashboard.spec.ts`

- [ ] **Step 1: Write the E2E spec**

`e2e/dashboard.spec.ts` — the sibling specs define their register/onboard helpers INLINE (no shared module). Copy the helper block from the top of `e2e/concepts.spec.ts`, changing the `uniqueEmail` prefix to `e2e-dashboard-`. Then:

```typescript
import { test, expect, type Page } from '@playwright/test';
// ---- paste the inline helpers from e2e/concepts.spec.ts (uniqueEmail prefix e2e-dashboard-) ----

test.describe('Dashboard', () => {
  test('shows the hero + section cards, and the budget card flips from nudge to summary', async ({ page }) => {
    await registerAndOnboard(page); // lands on /dashboard

    // Onboarding skips the date, so the hero shows the set-date state; the checklist card renders (seeded tasks).
    await expect(page.getByText(/set your wedding date|נותר|נותרו|היום זה קורה/i)).toBeVisible();
    await expect(page.getByRole('heading', { name: /checklist|צ'ק ליסט/i })).toBeVisible();

    // Budget card starts as a nudge.
    await expect(page.getByText(/plan your budget|תכננו את התקציב/i)).toBeVisible();

    // Set a budget, come back, and the budget card shows a summary.
    await page.goto('/budget');
    await page.getByRole('button', { name: /set budget|הגדרת תקציב/i }).click();
    await page.getByRole('spinbutton').first().fill('120000');
    await page.getByRole('button', { name: /^save$|שמירה/i }).click();
    await page.goto('/dashboard');
    await expect(page.getByText(/committed of|שולמו מתוך/i)).toBeVisible();
  });

  test('logged-out visitor cannot reach the dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });
});
```

Adjust selectors to match the sibling specs' conventions and the exact labels shipped in Task 2. Do NOT weaken the budget nudge→summary assertion — it proves the dual-mode wiring.

- [ ] **Step 2: Run the E2E spec**

Run: `npm run test:e2e -- dashboard.spec.ts`
Expected: PASS. (If a stale `next dev` holds an old client, kill it and let Playwright spawn a fresh server.)

- [ ] **Step 3: Full verification sweep against acceptance criteria**

```bash
npm run lint && npm run typecheck && npm run test && npm run test:e2e
```
Walk the spec's Acceptance criteria (1–8) and confirm each maps to a passing test or a manual check. Record the unit + e2e counts.

- [ ] **Step 4: Commit**

```bash
git add e2e/dashboard.spec.ts
git commit -m "test: add dashboard e2e (hero, cards, budget nudge->summary, gated)"
```

---

### Final: Whole-branch review

- [ ] **Step 1: Run the full gate**

```bash
npm run lint && npm run typecheck && npm run test && npm run test:e2e
```
Expected: all green. Record counts.

- [ ] **Step 2: Adversarial whole-branch review**

Request a review of the whole `phase-7-dashboard` diff (final reviewer on the most capable model). Focus areas:
- **Derivation correctness** — `daysUntilWedding` (timezone/DST via start-of-day; today=0, past negative), `checklistProgress` (pct rounding, overdue = open+past-due, soft-deleted excluded), `budgetSummary` (committed via `rollupTasks`, null-budget → null), `nextUpTasks` (open-only, nulls-last ordering, overdue flag, limit).
- **Read-only** — no mutations, no new schema; the loader only reads.
- **Dual-mode** — each card shows summary vs nudge correctly; empty states never crash.
- **i18n** — he/en key parity for the expanded `Dashboard` namespace; ICU plurals valid in both; no hard-coded strings; RTL logical props.
- **No stale references** — the old placeholder/nudge inline cards are fully removed; no dead keys.

- [ ] **Step 3: Address findings; update the implementation log**

Apply Critical/Important fixes (commit each). Add the Phase 7 section to `docs/superpowers/IMPLEMENTATION-LOG.md` (mirror the Phase 6 entry: delivered summary, verification counts, key decisions/deviations; note the Phase 2 countdown-widget deferral is now closed). Commit.

- [ ] **Step 4: Push / PR** (only on the user's explicit go-ahead — never commit/push without per-request permission).
