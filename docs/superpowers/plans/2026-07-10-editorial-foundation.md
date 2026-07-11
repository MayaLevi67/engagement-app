# Old-Money Editorial Redesign — Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the "old-money editorial" visual system — no-gold green-led palette, Bellefair Hebrew display, a forest hero band, and a reusable editorial component kit — apply it app-wide, and fully compose the Dashboard as the showcase.

**Architecture:** Presentational-only. A token retune in `app/globals.css` cascades the palette everywhere (components already use tokens); the Hebrew display font swap cascades type; a new `components/editorial/` kit provides the building blocks; only the Dashboard is bespoke-composed this pass (other pages inherit palette/type now, get bespoke layouts in later waves).

**Tech Stack:** Next.js 16 (App Router, RSC), Tailwind v4 (`@theme` tokens), next-intl (he default/RTL + en), next/font/google, Vitest + Testing Library, Playwright.

## Global Constraints

- **Presentational only** — no change to server actions, data, gating, routes, or behavior. Existing tests stay green.
- **Tokens only** — all color/type/radius via `app/globals.css` `@theme` tokens; **no hard-coded hex** in components. **No gold anywhere** (a grep guard test enforces this).
- **he + en parity** (identical i18n key sets); **RTL-safe logical properties only** — `ps/pe/ms/me`, `text-start/end`, `border-s/e`; never physical `left/right/ml/mr/pl/pr/text-left/right`.
- **AA contrast** for text; images lazy-load and degrade gracefully when no `src`.
- **Green-led:** `primary` (sage) = action; `wine` = emphasis/money; `forest`/`oxblood` = dark bands; `line` = hairlines.
- Lint (`--max-warnings 0`) + typecheck green; e2e run **warm** and with **`--workers=1`** (known infra note — parallel overwhelms the dev server).

## File Structure

**Modify:**
- `app/globals.css` — retune `@theme` tokens; remove gold.
- `app/[locale]/layout.tsx` — wire Bellefair + `--font-display-strong`.
- `app/[locale]/(app)/vendors/vendor-card.tsx`, `vendors/[vendorId]/vendor-detail.tsx`, `checklist/task-row.tsx`, `budget/budget-view.tsx` — reassign the 4 `bg-accent/20` usages.
- `app/[locale]/(app)/dashboard/page.tsx` + `countdown-hero.tsx` (+ `dashboard-view.test.tsx`) — recompose the showcase.
- `messages/en.json` + `messages/he.json` — new `Editorial` namespace (image alt/placeholder).

**Create:** `components/editorial/monogram.ts` (+ test), `hero.tsx` (+ test), `section-header.tsx`, `card.tsx`, `feature-card.tsx`, `pill.tsx` (+ `editorial-text.test.tsx`), `image-block.tsx`, `image-rail.tsx`, `image-section.tsx`, `photo-card.tsx` (+ `editorial-image.test.tsx`), and `app/globals-nogold.test.ts` (guard).

---

### Task 1: Theme foundation — tokens, fonts, remove gold

**Files:** Modify `app/globals.css`, `app/[locale]/layout.tsx`, the 4 gold-using components; Create `app/globals-nogold.test.ts`.

**Interfaces:**
- Produces: tokens `--color-{background,surface,primary,forest,wine,oxblood,text,muted,line}` + `--font-{display,display-strong,body}` → Tailwind utilities `bg-forest`, `bg-wine`, `bg-oxblood`, `border-line`, `font-display-strong`, etc.

- [ ] **Step 1: Retune `app/globals.css`**

Replace the `@theme` block with (removes `--color-accent`; adds forest/wine/oxblood/line + `--font-display-strong`):
```css
@import "tailwindcss";

@theme {
  --color-background: #F4EEE2;
  --color-surface: #FBF8F1;
  --color-primary: #5B7553;
  --color-forest: #2C3A2C;
  --color-wine: #7A2E3A;
  --color-oxblood: #4E2028;
  --color-text: #242320;
  --color-muted: #8A8578;
  --color-line: rgba(36, 35, 32, 0.14);

  --font-display: var(--font-playfair);
  --font-display-strong: var(--font-frank-ruhl);
  --font-body: var(--font-inter);

  --radius-card: 1rem;
}

body {
  background-color: var(--color-background);
  color: var(--color-text);
  font-family: var(--font-body), system-ui, sans-serif;
}
```

- [ ] **Step 2: Wire Bellefair + `--font-display-strong` in `app/[locale]/layout.tsx`**

Add the import + instance + fontVars entry, and set the per-locale display vars:
```tsx
import { Playfair_Display, Inter, Frank_Ruhl_Libre, Assistant, Bellefair } from 'next/font/google';
// ...existing instances...
const bellefair = Bellefair({ variable: '--font-bellefair', weight: '400', subsets: ['hebrew', 'latin'], display: 'swap' });

const fontVars = [playfair.variable, inter.variable, frankRuhl.variable, assistant.variable, bellefair.variable].join(' ');
```
Update `localeFontVars`:
```tsx
const localeFontVars =
  locale === 'he'
    ? {
        '--font-display': 'var(--font-bellefair)',
        '--font-display-strong': 'var(--font-frank-ruhl)',
        '--font-body': 'var(--font-assistant)',
      }
    : {
        '--font-display': 'var(--font-playfair)',
        '--font-display-strong': 'var(--font-playfair)',
        '--font-body': 'var(--font-inter)',
      };
```

- [ ] **Step 3: Reassign the 4 gold usages → `bg-muted/20`**

In each file, replace `bg-accent/20` with `bg-muted/20` (chrome; keeps `text-text`):
- `app/[locale]/(app)/vendors/vendor-card.tsx:59` — private badge.
- `app/[locale]/(app)/vendors/[vendorId]/vendor-detail.tsx:156` — private badge.
- `app/[locale]/(app)/checklist/task-row.tsx:248` — paid label badge.
- `app/[locale]/(app)/budget/budget-view.tsx:62` — banner. (Grep `bg-accent` after to confirm zero remain.)

- [ ] **Step 4: Write the no-gold guard test**

`app/globals-nogold.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';

describe('no-gold guard', () => {
  it('no gold hex or accent token remains in app/ or components/', () => {
    const out = execSync(
      `grep -rniE "(bg|text|border|ring|from|to|via|fill|stroke)-accent|--color-accent|#c9a961" app components --include=*.tsx --include=*.ts --include=*.css || true`,
      { encoding: 'utf8' },
    );
    const hits = out.split('\n').filter((l) => l.trim() && !l.includes('globals-nogold.test.ts'));
    expect(hits).toEqual([]);
  });
});
```

- [ ] **Step 5: Verify + commit**

Run: `npm run test -- globals-nogold.test.ts && npm run test && npm run typecheck && npm run lint` → all green (the token swap is transparent to existing tests; guard passes).
```bash
git add app/globals.css "app/[locale]/layout.tsx" "app/[locale]/(app)/vendors/vendor-card.tsx" "app/[locale]/(app)/vendors/[vendorId]/vendor-detail.tsx" "app/[locale]/(app)/checklist/task-row.tsx" "app/[locale]/(app)/budget/budget-view.tsx" app/globals-nogold.test.ts
git commit -m "feat: old-money palette tokens + Bellefair Hebrew display, remove gold accent"
```

---

### Task 2: Forest hero band + monogram

**Files:** Create `components/editorial/monogram.ts` (+ `.test.ts`), `components/editorial/hero.tsx` (+ `.test.tsx`).

**Interfaces:**
- Produces: `monogram(p1?: string|null, p2?: string|null): string`; `Hero({ coupleName, partner1Name, partner2Name, children }: { coupleName: string|null; partner1Name: string|null; partner2Name: string|null; children?: React.ReactNode })`.

- [ ] **Step 1: Monogram test**

`components/editorial/monogram.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { monogram } from './monogram';
describe('monogram', () => {
  it('joins first initials', () => { expect(monogram('Maya', 'Asaf')).toBe('M & A'); });
  it('handles Hebrew initials', () => { expect(monogram('מיה', 'אסף')).toBe('מ & א'); });
  it('one name', () => { expect(monogram('Maya', null)).toBe('M'); });
  it('no names', () => { expect(monogram(null, null)).toBe(''); });
});
```

- [ ] **Step 2: Run (FAIL), implement `monogram.ts`**
```typescript
export function monogram(p1?: string | null, p2?: string | null): string {
  const a = p1?.trim()?.[0];
  const b = p2?.trim()?.[0];
  return [a, b].filter(Boolean).join(' & ');
}
```
Run the test → PASS.

- [ ] **Step 3: Hero test**

`components/editorial/hero.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Hero } from './hero';
describe('Hero', () => {
  it('renders monogram, couple name, and children (countdown slot)', () => {
    render(<Hero coupleName="Maya & Asaf" partner1Name="Maya" partner2Name="Asaf"><span>40 days</span></Hero>);
    expect(screen.getByText('M & A')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Maya & Asaf' })).toBeInTheDocument();
    expect(screen.getByText('40 days')).toBeInTheDocument();
  });
  it('omits the heading when no couple name', () => {
    render(<Hero coupleName={null} partner1Name={null} partner2Name={null} />);
    expect(screen.queryByRole('heading')).toBeNull();
  });
});
```

- [ ] **Step 4: Run (FAIL), implement `hero.tsx`**
```tsx
import { monogram } from './monogram';

export function Hero({
  coupleName,
  partner1Name,
  partner2Name,
  children,
}: {
  coupleName: string | null;
  partner1Name: string | null;
  partner2Name: string | null;
  children?: React.ReactNode;
}) {
  const mono = monogram(partner1Name, partner2Name);
  return (
    <section className="rounded-card bg-forest px-6 py-10 text-center text-background">
      {mono ? <div className="font-display text-sm tracking-[0.25em] text-background/80">{mono}</div> : null}
      {coupleName ? <h1 className="mt-2 font-display text-4xl text-background sm:text-5xl">{coupleName}</h1> : null}
      {children ? (
        <div className="mt-5 inline-block border-y border-background/40 px-6 py-2 font-display text-2xl text-background">
          {children}
        </div>
      ) : null}
    </section>
  );
}
```
Run the test → PASS.

- [ ] **Step 5: Typecheck; lint; commit**
```bash
git add components/editorial/monogram.ts components/editorial/monogram.test.ts components/editorial/hero.tsx components/editorial/hero.test.tsx
git commit -m "feat: add editorial forest Hero band + monogram helper"
```

---

### Task 3: Editorial text kit — SectionHeader, Card, FeatureCard, Pill

**Files:** Create `components/editorial/section-header.tsx`, `card.tsx`, `feature-card.tsx`, `pill.tsx`, `editorial-text.test.tsx`.

**Interfaces:**
- Produces:
  - `SectionHeader({ title: string; numeral?: string; kicker?: string })`
  - `Card({ children: React.ReactNode; accent?: 'sage'|'wine'|'none'; className?: string })`
  - `FeatureCard({ kicker?: string; title: string; meta?: React.ReactNode; image?: React.ReactNode })`
  - `Pill({ children: React.ReactNode; tone?: 'neutral'|'active'|'emphasis' })`

- [ ] **Step 1: Write the kit test**

`components/editorial/editorial-text.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SectionHeader } from './section-header';
import { Card } from './card';
import { FeatureCard } from './feature-card';
import { Pill } from './pill';

describe('editorial text kit', () => {
  it('SectionHeader renders title, optional numeral + kicker', () => {
    render(<SectionHeader title="אולם" numeral="01" kicker="הבא בתור" />);
    expect(screen.getByRole('heading', { name: 'אולם' })).toBeInTheDocument();
    expect(screen.getByText('01')).toBeInTheDocument();
    expect(screen.getByText('הבא בתור')).toBeInTheDocument();
  });
  it('Card wine accent uses the logical inline-start border', () => {
    const { container } = render(<Card accent="wine">x</Card>);
    expect(container.firstChild).toHaveClass('border-wine');
    expect(container.firstChild).toHaveClass('border-s-[3px]');
  });
  it('Pill emphasis tone uses wine', () => {
    const { container } = render(<Pill tone="emphasis">₪7,000</Pill>);
    expect(container.firstChild).toHaveClass('bg-wine');
  });
  it('FeatureCard shows kicker + title', () => {
    render(<FeatureCard kicker="הבא בתור" title="סגירת אולם" meta={<span>נותרו ₪7,000</span>} />);
    expect(screen.getByText('סגירת אולם')).toBeInTheDocument();
    expect(screen.getByText('נותרו ₪7,000')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run (FAIL), implement the four components**

`section-header.tsx`:
```tsx
export function SectionHeader({ title, numeral, kicker }: { title: string; numeral?: string; kicker?: string }) {
  return (
    <div className="mb-4 mt-2 flex items-center gap-3">
      {numeral ? <span className="font-display text-4xl leading-none text-primary/40">{numeral}</span> : null}
      <div>
        {kicker ? <div className="text-xs uppercase tracking-[0.14em] text-wine">{kicker}</div> : null}
        <h2 className="font-display text-2xl text-forest">{title}</h2>
      </div>
      <span className="ms-2 h-px flex-1 bg-line" />
    </div>
  );
}
```
`card.tsx`:
```tsx
export function Card({
  children,
  accent = 'sage',
  className = '',
}: {
  children: React.ReactNode;
  accent?: 'sage' | 'wine' | 'none';
  className?: string;
}) {
  const border =
    accent === 'wine' ? 'border-s-[3px] border-wine' : accent === 'sage' ? 'border-s-[3px] border-primary' : '';
  return <div className={`rounded-card bg-surface p-4 shadow-sm ${border} ${className}`.trim()}>{children}</div>;
}
```
`pill.tsx`:
```tsx
export function Pill({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'active' | 'emphasis';
}) {
  const cls =
    tone === 'active' ? 'bg-primary text-background' : tone === 'emphasis' ? 'bg-wine text-background' : 'bg-muted/20 text-muted';
  return <span className={`inline-block rounded-full px-3 py-1 text-xs tracking-wide ${cls}`}>{children}</span>;
}
```
`feature-card.tsx`:
```tsx
import { Card } from './card';

export function FeatureCard({
  kicker,
  title,
  meta,
  image,
}: {
  kicker?: string;
  title: string;
  meta?: React.ReactNode;
  image?: React.ReactNode;
}) {
  return (
    <Card accent="wine" className="flex items-stretch gap-4 p-0 overflow-hidden">
      {image ? <div className="w-28 shrink-0">{image}</div> : null}
      <div className="p-4">
        {kicker ? <div className="text-xs uppercase tracking-[0.14em] text-wine">{kicker}</div> : null}
        <h3 className="font-display text-xl text-text">{title}</h3>
        {meta ? <div className="mt-1 text-sm text-muted">{meta}</div> : null}
      </div>
    </Card>
  );
}
```

- [ ] **Step 3: Run (PASS); typecheck; lint; commit**
```bash
git add components/editorial/section-header.tsx components/editorial/card.tsx components/editorial/feature-card.tsx components/editorial/pill.tsx components/editorial/editorial-text.test.tsx
git commit -m "feat: add editorial text kit (SectionHeader, Card, FeatureCard, Pill)"
```

---

### Task 4: Editorial image kit — ImageBlock, ImageRail, ImageSection, PhotoCard

**Files:** Create `components/editorial/image-block.tsx`, `image-rail.tsx`, `image-section.tsx`, `photo-card.tsx`, `editorial-image.test.tsx`; Modify `messages/en.json` + `messages/he.json` (add `Editorial` namespace).

**Interfaces:**
- Produces:
  - `ImageBlock({ src?: string|null; alt: string; placeholderLabel?: string; className?: string })` — `<img>` when `src`, else a tonal placeholder (optional label).
  - `ImageRail({ src?: string|null; alt: string; placeholderLabel?: string; children: React.ReactNode })` — content + tall image column (grid), stacks on mobile.
  - `ImageSection({ src?: string|null; alt: string; placeholderLabel?: string; children?: React.ReactNode })` — full-bleed band with optional scrim/overlay.
  - `PhotoCard({ src?: string|null; alt: string; placeholderLabel?: string; children: React.ReactNode })` — card with a top photo slot.

- [ ] **Step 1: Add the `Editorial` i18n namespace (both locales)**

`messages/en.json` + `messages/he.json` add `Editorial`: `photoPlaceholder` ("Photo" / "תמונה"), `photoAlt` ("Wedding photo" / "תמונת חתונה"). Identical key sets.

- [ ] **Step 2: Write the image-kit test**

`components/editorial/editorial-image.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ImageBlock } from './image-block';
import { ImageRail } from './image-rail';

describe('editorial image kit', () => {
  it('ImageBlock renders an img when src is given', () => {
    render(<ImageBlock src="/x.jpg" alt="Wedding photo" />);
    const img = screen.getByRole('img', { name: 'Wedding photo' });
    expect(img).toHaveAttribute('loading', 'lazy');
  });
  it('ImageBlock renders a labeled placeholder (no img) when src is empty', () => {
    render(<ImageBlock src={null} alt="Wedding photo" placeholderLabel="Photo" />);
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('Photo')).toBeInTheDocument();
  });
  it('ImageRail renders content and an image column', () => {
    render(<ImageRail src="/x.jpg" alt="Wedding photo"><span>content</span></ImageRail>);
    expect(screen.getByText('content')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Wedding photo' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run (FAIL), implement the components**

`image-block.tsx`:
```tsx
export function ImageBlock({
  src,
  alt,
  placeholderLabel,
  className = '',
}: {
  src?: string | null;
  alt: string;
  placeholderLabel?: string;
  className?: string;
}) {
  if (!src) {
    return (
      <div
        className={`flex items-end justify-center rounded-card bg-forest/10 ${className}`.trim()}
        aria-hidden="true"
      >
        {placeholderLabel ? (
          <span className="pb-3 text-xs uppercase tracking-[0.18em] text-muted">{placeholderLabel}</span>
        ) : null}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- couple-supplied external/uploaded images, not build-time assets
    <img src={src} alt={alt} loading="lazy" className={`h-full w-full rounded-card object-cover ${className}`.trim()} />
  );
}
```
`image-rail.tsx`:
```tsx
import { ImageBlock } from './image-block';
export function ImageRail({
  src,
  alt,
  placeholderLabel,
  children,
}: {
  src?: string | null;
  alt: string;
  placeholderLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-[1.6fr_1fr]">
      <div>{children}</div>
      <ImageBlock src={src} alt={alt} placeholderLabel={placeholderLabel} className="min-h-56" />
    </div>
  );
}
```
`image-section.tsx`:
```tsx
import { ImageBlock } from './image-block';
export function ImageSection({
  src,
  alt,
  placeholderLabel,
  children,
}: {
  src?: string | null;
  alt: string;
  placeholderLabel?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-card">
      <ImageBlock src={src} alt={alt} placeholderLabel={placeholderLabel} className="min-h-44" />
      {children ? (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-forest/70 to-transparent p-5 text-background">
          {children}
        </div>
      ) : null}
    </div>
  );
}
```
`photo-card.tsx`:
```tsx
import { ImageBlock } from './image-block';
export function PhotoCard({
  src,
  alt,
  placeholderLabel,
  children,
}: {
  src?: string | null;
  alt: string;
  placeholderLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-card bg-surface shadow-sm">
      <ImageBlock src={src} alt={alt} placeholderLabel={placeholderLabel} className="h-40" />
      <div className="p-4">{children}</div>
    </div>
  );
}
```

- [ ] **Step 4: Run (PASS); full suite (he/en parity holds); typecheck; lint; commit**
```bash
git add components/editorial/image-block.tsx components/editorial/image-rail.tsx components/editorial/image-section.tsx components/editorial/photo-card.tsx components/editorial/editorial-image.test.tsx messages/en.json messages/he.json
git commit -m "feat: add editorial image kit (ImageBlock/ImageRail/ImageSection/PhotoCard) + Editorial i18n"
```

---

### Task 5: Dashboard showcase (magazine / image-rail composition)

**Files:** Modify `app/[locale]/(app)/dashboard/page.tsx`, `countdown-hero.tsx` (+ `dashboard-view.test.tsx`).

**Interfaces:** Consumes `Hero`, `SectionHeader`, `Card`, `FeatureCard`, `Pill`, `ImageRail` from `components/editorial/*`; the existing `getDashboardData` loader is unchanged.

- [ ] **Step 1: Recompose the hero**

Refactor `countdown-hero.tsx` to render the new forest `Hero`: keep its existing couple-string + countdown-state logic (`t('heroCouple')`, `noDateTitle`/`daysToGo`/`dateApproximateAround`/`datePassed`), but instead of the plain white `section`, render `<Hero coupleName={couple} partner1Name partner2Name>{countdownContent}</Hero>`, passing the computed countdown line as children. (The "no date → set date" CTA stays, rendered under/inside the hero.) Keep it a client component (uses `useTranslations`).

- [ ] **Step 2: Recompose the page body in the magazine style**

In `dashboard/page.tsx`, replace the plain stacked layout with an editorial composition using the kit: a `SectionHeader` for "next up", a `FeatureCard` (or `ImageRail` with an empty `placeholderLabel={t('Editorial.photoPlaceholder')}`) for the top highlight, and the existing overview cards rendered as elevated `Card`s in an asymmetric grid (e.g. `grid gap-4 sm:grid-cols-2`, with the checklist/budget cards using `accent="wine"` for money emphasis). Reuse ALL existing data (`getDashboardData`) and links — this is layout/wrapping only, no data or behavior change. Keep the premium upgrade card + dev toggle exactly as-is (just wrapped in the new `Card`/section styling). Pass the couple's `partner1Name`/`partner2Name` (already loaded) to the hero for the monogram.

- [ ] **Step 3: Update the dashboard test**

Adjust `dashboard-view.test.tsx` only where it asserted the old hero markup (e.g. now the monogram/`Hero` renders); keep all behavioral assertions (cards present, links, premium states). Do NOT weaken.

- [ ] **Step 4: Verify + commit**

Run: `npm run test && npm run typecheck && npm run lint` → green.
```bash
git add "app/[locale]/(app)/dashboard"
git commit -m "feat: recompose the Dashboard in the editorial magazine style (showcase template)"
```

---

### Task 6: Global uplift verification + e2e

**Files:** none (verification); a tiny fix only if a route breaks.

- [ ] **Step 1: Render every route in both locales**

Start a warm dev server (`lsof -ti :3000 | xargs kill; nohup npm run dev >/tmp/ed-dev.log 2>&1 & disown`; wait for `/login`). Load each route in **he** and **en** and confirm it renders in the new system (cream/ivory, sage/wine, Bellefair headings, elevated cards, no gold, no broken layout): `/` , `/login`, `/register`, `/dashboard`, `/checklist`, `/budget`, `/payments`, `/concepts`, `/vendors`, `/settings/wedding`, `/admin`. If a route visibly breaks (e.g. white-on-cream contrast, a removed token), fix minimally (token/class only) and note it.

- [ ] **Step 2: No-gold guard + contrast spot-check**

Run: `npm run test -- globals-nogold.test.ts` → PASS. Spot-check AA contrast on the key pairings (sage `#5B7553`/wine `#7A2E3A` text on ivory/cream; ivory on forest/oxblood). If a pairing fails AA for its text size, nudge the token hex slightly (darker) and re-run the guard/tests.

- [ ] **Step 3: Full gate + e2e (warm, `--workers=1`)**

Run: `npm run lint && npm run typecheck && npm run test`, then the e2e suite against the warm server with `--workers=1` (`npm run test:e2e -- --workers=1`, warm-up run first if needed). All green (selectors are label/role-based, so a presentational change should not break them; fix any spec that keyed off a removed class — do NOT weaken assertions).

- [ ] **Step 4: Commit any fixes**
```bash
git add -A ':!docs/research'
git commit -m "fix: editorial uplift — route render + contrast fixes"   # only if Step 1/2 required changes
```

---

### Final: Whole-branch review

- [ ] **Step 1: Full gate** — `npm run lint && npm run typecheck && npm run test && npm run test:e2e -- --workers=1` (warm) → all green; record counts.
- [ ] **Step 2: Adversarial whole-branch review** (most-capable model). Focus:
  - **Tokens-only / no gold:** no hard-coded hex in components; the guard passes; every former `accent`/gold usage reassigned sensibly (wine emphasis / muted chrome / line hairline).
  - **RTL-safe:** only logical properties introduced (`ps/pe/ms/me/border-s/e/text-start/end`); no physical `left/right/ml/mr/pl/pr` in new/changed code; the forest hero, section rule, card side-border, and image rail all mirror correctly in he.
  - **Presentational only:** no server action / data / gating / route change; behavior identical; existing behavioral tests intact.
  - **Image slots degrade gracefully** (no `src` → tonal placeholder, no broken `<img>`); alt text via i18n.
  - **he/en parity** (new `Editorial` keys in both); AA contrast; every route renders unbroken in both locales.
  - **Kit quality:** components are focused, token-based, reusable; the Dashboard composition uses them (not one-off markup).
- [ ] **Step 3: Address Critical/Important findings (commit each); update `docs/superpowers/IMPLEMENTATION-LOG.md`** (feature summary, verification counts, decisions: hybrid/green-led/no-gold/Bellefair/forest-hero/kit, and the deferred per-page waves).
- [ ] **Step 4: Push / PR** — only on the user's explicit go-ahead.
