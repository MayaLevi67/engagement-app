# Budget & Payments Donut Charts — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two inline-SVG donut charts — a recommended-budget-allocation donut on the Budget page and a by-payer donut on the Payments page — in the brand greens+burgundy palette, with a legend that carries identity.

**Architecture:** A dependency-free chart kit in `components/charts/` (pure geometry → presentational `Donut`/`DonutLegend`/`DonutChart`), a fixed entity→color-token map, and a validated greens+burgundy categorical token ramp in `app/globals.css`. Charts consume existing outputs (optimizer `allocations`, payments `rollup().byPayer`); presentational-only.

**Tech Stack:** Next.js 16 (RSC), Tailwind v4 (`@theme` tokens), next-intl (he/RTL + en), Vitest + Testing Library, Playwright. No chart library.

## Global Constraints

- **Chart colors = brand greens + burgundy only**, as `--color-chart-1..12` tokens; **cream/ivory are the surface + the 2px inter-slice gaps, never slice fills**. No ad-hoc hex in components. No gold (the `globals-nogold` guard stays green — chart tokens are green/burgundy).
- **Legend is the identity channel** (label + % + ₪), always present, sorted largest-first; **legend/tooltip text uses ink/muted text tokens**, never the slice color. Each slice has an SVG `<title>`. This is the mandated secondary encoding — the muted palette's residual chroma/CVD validator flags are accepted **because** of it.
- **RTL-safe** logical properties only (`ms/me/ps/pe`, `text-start/end`); the ring is direction-neutral. he default + en, identical i18n key sets. Whole-shekel **₪ Int**, formatted `₪{n.toLocaleString(locale)}`.
- **Presentational only** — no change to the budget optimizer, payments rollup, routes, or gating; premium gating inherited from the pages. Lint (`--max-warnings 0`) + typecheck green; existing tests green + new tests; e2e **warm, `--workers=1`**.

## File Structure

**Create:** `components/charts/donut-geometry.ts` (+ `.test.ts`), `components/charts/chart-palette.ts` (+ `.test.ts`, the entity→token maps), `components/charts/donut.tsx`, `donut-legend.tsx`, `donut-chart.tsx` (+ `charts.test.tsx`).
**Modify:** `app/globals.css` (`--color-chart-1..12`), `messages/en.json` + `messages/he.json` (`Charts` namespace), `app/[locale]/(app)/budget/budget-view.tsx` (allocation donut), `app/[locale]/(app)/payments/payments-view.tsx` (by-payer donut).

---

### Task 1: Chart palette tokens (validated)

**Files:** Modify `app/globals.css`.

**Interfaces:** Produces Tailwind utilities `fill-chart-1..12` / `bg-chart-1..12` from `--color-chart-1..12`.

- [ ] **Step 1: Add the greens+burgundy ramp to `@theme`**

In `app/globals.css` `@theme`, add (candidate ramp, alternating green↔burgundy, mid-lightness):
```css
  --color-chart-1: #3C6248;
  --color-chart-2: #9C3F4C;
  --color-chart-3: #6E9560;
  --color-chart-4: #B36A74;
  --color-chart-5: #4A7A52;
  --color-chart-6: #7E3541;
  --color-chart-7: #869E5E;
  --color-chart-8: #A84E5A;
  --color-chart-9: #35643F;
  --color-chart-10: #8A5560;
  --color-chart-11: #5C8A4E;
  --color-chart-12: #7C3846;
```

- [ ] **Step 2: Validate + nudge the fixable checks only**

Run the dataviz validator (path is the loaded dataviz skill's base dir):
`node /private/tmp/claude-502/bundled-skills/2.1.205/9c77dd6eaeba04dafe904baabc3b6800/dataviz/scripts/validate_palette.js "#3C6248,#9C3F4C,#6E9560,#B36A74,#4A7A52,#7E3541,#869E5E,#A84E5A,#35643F,#8A5560,#5C8A4E,#7C3846" --mode light`
(If that path has moved, re-locate `validate_palette.js` under the dataviz skill dir.)
**Nudge into range** any slice that FAILs **Lightness band** (make it lighter/darker, staying muted greens/burgundy) or the **Contrast** WARN (darken a too-light green like `#869E5E` until ≥3:1 on cream). **Do NOT chase the Chroma-floor FAIL or the CVD WARN by over-saturating** — those are the accepted muted-aesthetic tradeoff (the legend is the secondary encoding). Update the tokens to your final nudged values. Record the final validator output in the report.

- [ ] **Step 3: Verify + commit**

Run: `npm run test -- globals-nogold.test.ts && npm run test && npm run typecheck && npm run lint` → green (the guard still passes; chart tokens are green/burgundy, no gold).
```bash
git add app/globals.css
git commit -m "feat: add validated greens+burgundy chart palette tokens (chart-1..12)"
```

---

### Task 2: Pure chart data layer — geometry, entity→color maps, i18n

**Files:** Create `components/charts/donut-geometry.ts` (+ `.test.ts`), `components/charts/chart-palette.ts` (+ `.test.ts`); Modify `messages/en.json` + `messages/he.json`.

**Interfaces:**
- Produces:
  - `donutSegments(values: number[]): { start: number; end: number; percent: number }[]` — cumulative angles in **degrees**, start at 12 o'clock (−90°), clockwise; `percent = value/total`; total 0 → `[]`.
  - `arcPath(cx: number, cy: number, rOuter: number, rInner: number, startDeg: number, endDeg: number): string` — SVG ring-segment `d`.
  - `categoryToken(category: TaskCategory): string` → `'chart-1'..'chart-12'` by the `TaskCategory` enum order (stable).
  - `payerToken(payer: PayerRole, payerLabel: string | null): string` → base roles PARTNER_1→chart-1 … OTHER→chart-6; extra distinct OTHER labels deterministically map to chart-7..12 by sorted label.

- [ ] **Step 1: Geometry test** — `donut-geometry.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { donutSegments, arcPath } from './donut-geometry';
describe('donutSegments', () => {
  it('two equal values → two 50% halves from -90', () => {
    const s = donutSegments([50, 50]);
    expect(s).toHaveLength(2);
    expect(s[0].percent).toBeCloseTo(0.5);
    expect(s[0].start).toBeCloseTo(-90);
    expect(s[0].end).toBeCloseTo(90);
    expect(s[1].end).toBeCloseTo(270);
  });
  it('single value → one full ring', () => {
    expect(donutSegments([10])[0].percent).toBe(1);
  });
  it('zero total → empty', () => { expect(donutSegments([0, 0])).toEqual([]); });
});
describe('arcPath', () => {
  it('returns a well-formed ring-segment path', () => {
    const d = arcPath(50, 50, 45, 28, -90, 0);
    expect(d.startsWith('M')).toBe(true);
    expect(d).toContain('A'); // arc commands
    expect(d.trim().endsWith('Z')).toBe(true);
  });
});
```

- [ ] **Step 2: Run (FAIL), implement `donut-geometry.ts`**
```typescript
function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const rad = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

export function donutSegments(values: number[]): { start: number; end: number; percent: number }[] {
  const total = values.reduce((s, v) => s + Math.max(0, v), 0);
  if (total <= 0) return [];
  let cursor = -90;
  return values.map((v) => {
    const percent = Math.max(0, v) / total;
    const start = cursor;
    const end = cursor + percent * 360;
    cursor = end;
    return { start, end, percent };
  });
}

export function arcPath(cx: number, cy: number, rOuter: number, rInner: number, startDeg: number, endDeg: number): string {
  const large = endDeg - startDeg > 180 ? 1 : 0;
  const [ox1, oy1] = polar(cx, cy, rOuter, startDeg);
  const [ox2, oy2] = polar(cx, cy, rOuter, endDeg);
  const [ix2, iy2] = polar(cx, cy, rInner, endDeg);
  const [ix1, iy1] = polar(cx, cy, rInner, startDeg);
  return `M ${ox1} ${oy1} A ${rOuter} ${rOuter} 0 ${large} 1 ${ox2} ${oy2} L ${ix2} ${iy2} A ${rInner} ${rInner} 0 ${large} 0 ${ix1} ${iy1} Z`;
}
```
Run → PASS.

- [ ] **Step 3: Color-map test** — `chart-palette.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { categoryToken, payerToken } from './chart-palette';
describe('categoryToken', () => {
  it('is stable per category (same category → same token) and green/burgundy tokens', () => {
    const a = categoryToken('VENUE'); const b = categoryToken('VENUE');
    expect(a).toBe(b);
    expect(a).toMatch(/^chart-([1-9]|1[0-2])$/);
    expect(categoryToken('CATERING')).not.toBe(categoryToken('VENUE'));
  });
});
describe('payerToken', () => {
  it('maps the six base roles to fixed tokens', () => {
    expect(payerToken('PARTNER_1', null)).toBe('chart-1');
    expect(payerToken('OTHER', null)).toBe('chart-6');
  });
  it('distinct OTHER labels get distinct deterministic tokens', () => {
    const g = payerToken('OTHER', 'Grandma'); const u = payerToken('OTHER', 'Uncle');
    expect(g).not.toBe(u);
    expect(payerToken('OTHER', 'Grandma')).toBe(g); // stable
  });
});
```

- [ ] **Step 4: Run (FAIL), implement `chart-palette.ts`**
```typescript
import type { TaskCategory, PayerRole } from '@prisma/client';

const CATEGORY_ORDER: TaskCategory[] = [
  'VENUE', 'CATERING', 'PHOTOGRAPHY', 'MUSIC', 'ATTIRE', 'DESIGN',
  'FLOWERS', 'GUESTS', 'CEREMONY', 'PLANNING', 'BUDGET', 'OTHER',
];
const N = 12;
const token = (i: number) => `chart-${(((i % N) + N) % N) + 1}`;

export function categoryToken(category: TaskCategory): string {
  const idx = CATEGORY_ORDER.indexOf(category);
  return token(idx < 0 ? N - 1 : idx);
}

const PAYER_ORDER: PayerRole[] = ['PARTNER_1', 'PARTNER_2', 'BOTH', 'PARTNER_1_FAMILY', 'PARTNER_2_FAMILY', 'OTHER'];

export function payerToken(payer: PayerRole, payerLabel: string | null): string {
  const base = PAYER_ORDER.indexOf(payer);
  if (payer !== 'OTHER' || !payerLabel) return token(base < 0 ? 5 : base);
  // Distinct OTHER labels: deterministic offset into the remaining tokens (6..11 → chart-7..12).
  let h = 0;
  for (const ch of payerLabel) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return token(6 + (h % (N - 6)));
}
```
Run → PASS. (Confirm `TaskCategory`/`PayerRole` union values match the schema; if the enum has different members, use its exact values.)

- [ ] **Step 5: Add the `Charts` i18n namespace (both locales)**

Add to `messages/en.json` + `messages/he.json` (identical keys): `Charts.allocationTitle` ("Recommended allocation"/"הקצאה מומלצת"), `byPayerTitle` ("Paid by"/"מי שילם"), `legendRow` (`"{percent}%"` — the legend appends ` · ₪amount` itself), `sliceTitle` (`"{label}: {percent}% · {amount}"`), `empty` ("No data yet"/"אין נתונים עדיין").

- [ ] **Step 6: Run all; typecheck; lint; commit**

Run: `npm run test -- components/charts && npm run test && npm run typecheck && npm run lint` → green.
```bash
git add components/charts/donut-geometry.ts components/charts/donut-geometry.test.ts components/charts/chart-palette.ts components/charts/chart-palette.test.ts messages/en.json messages/he.json
git commit -m "feat: add donut geometry, entity->color token maps, and Charts i18n"
```

---

### Task 3: Chart components — Donut, DonutLegend, DonutChart

**Files:** Create `components/charts/donut.tsx`, `donut-legend.tsx`, `donut-chart.tsx`, `charts.test.tsx`.

**Interfaces:**
- Consumes: `donutSegments`, `arcPath` (`./donut-geometry`).
- Produces: `type Slice = { label: string; value: number; token: string }`; `Donut({ slices, sliceTitle }: { slices: Slice[]; sliceTitle: (s: Slice, percent: number) => string })`; `DonutLegend({ slices, formatRow, formatAmount }: {...})`; `DonutChart({ title, slices, sliceTitle, formatRow, formatAmount, emptyLabel })`.

- [ ] **Step 1: Component test** — `charts.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Donut } from './donut';
import { DonutLegend } from './donut-legend';
const slices = [
  { label: 'Venue', value: 75000, token: 'chart-1' },
  { label: 'Catering', value: 73500, token: 'chart-2' },
];
describe('Donut', () => {
  it('renders one path per slice with an accessible <title>', () => {
    const { container } = render(<Donut slices={slices} sliceTitle={(s, p) => `${s.label}:${Math.round(p*100)}%`} />);
    expect(container.querySelectorAll('path').length).toBe(2);
    expect(container.querySelector('title')?.textContent).toContain('Venue');
  });
  it('empty slices render no paths', () => {
    const { container } = render(<Donut slices={[]} sliceTitle={() => ''} />);
    expect(container.querySelectorAll('path').length).toBe(0);
  });
});
describe('DonutLegend', () => {
  it('renders a row per slice sorted largest-first with % and amount, text in text tokens', () => {
    render(<DonutLegend slices={slices} formatRow={(p) => `${Math.round(p*100)}%`} formatAmount={(v) => `₪${v}`} />);
    expect(screen.getByText('Venue')).toBeInTheDocument();
    expect(screen.getByText(/₪75000/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run (FAIL), implement the three components**

`donut.tsx`:
```tsx
import { donutSegments, arcPath } from './donut-geometry';

export type Slice = { label: string; value: number; token: string };

export function Donut({ slices, sliceTitle }: { slices: Slice[]; sliceTitle: (s: Slice, percent: number) => string }) {
  const segs = donutSegments(slices.map((s) => s.value));
  const size = 180, cx = 90, cy = 90, rOuter = 84, rInner = 52;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto block h-auto w-full max-w-[220px]" role="img">
      {segs.map((seg, i) => {
        // 2px cream gap between slices: inset the arc a hair at each end.
        const gap = segs.length > 1 ? 1.2 : 0;
        return (
          <path
            key={slices[i].label}
            d={arcPath(cx, cy, rOuter, rInner, seg.start + gap, seg.end - gap)}
            className={`fill-${slices[i].token}`}
          >
            <title>{sliceTitle(slices[i], seg.percent)}</title>
          </path>
        );
      })}
    </svg>
  );
}
```
(`slices[i].token` is `chart-N`, so `fill-${token}` = `fill-chart-N`; the legend uses `bg-${token}` the same way.)

`donut-legend.tsx`:
```tsx
import type { Slice } from './donut';

export function DonutLegend({
  slices,
  formatRow,
  formatAmount,
}: {
  slices: Slice[];
  formatRow: (percent: number) => string;
  formatAmount: (value: number) => string;
}) {
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  const sorted = [...slices].sort((a, b) => b.value - a.value);
  return (
    <ul className="flex flex-col gap-1.5">
      {sorted.map((s) => (
        <li key={s.label} className="flex items-center gap-2 text-sm">
          <span className={`inline-block h-3 w-3 shrink-0 rounded-full bg-${s.token}`} aria-hidden="true" />
          <span className="text-text">{s.label}</span>
          <span className="ms-auto text-muted">{formatRow(s.value / total)} · {formatAmount(s.value)}</span>
        </li>
      ))}
    </ul>
  );
}
```

`donut-chart.tsx`:
```tsx
import { Donut, type Slice } from './donut';
import { DonutLegend } from './donut-legend';

export function DonutChart({
  title,
  slices,
  sliceTitle,
  formatRow,
  formatAmount,
  emptyLabel,
}: {
  title: string;
  slices: Slice[];
  sliceTitle: (s: Slice, percent: number) => string;
  formatRow: (percent: number) => string;
  formatAmount: (value: number) => string;
  emptyLabel: string;
}) {
  return (
    <div className="rounded-card bg-surface p-5 shadow-sm">
      <h2 className="mb-4 font-display text-xl text-forest">{title}</h2>
      {slices.length === 0 ? (
        <p className="text-sm text-muted">{emptyLabel}</p>
      ) : (
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="sm:w-1/2"><Donut slices={slices} sliceTitle={sliceTitle} /></div>
          <div className="sm:w-1/2"><DonutLegend slices={slices} formatRow={formatRow} formatAmount={formatAmount} /></div>
        </div>
      )}
    </div>
  );
}
```
Note: Tailwind must see the `fill-chart-*`/`bg-chart-*` classes to generate them. Since the token suffix is dynamic (`bg-${s.token}`), add a **safelist comment** or explicit class list so JIT emits `fill-chart-1..12` + `bg-chart-1..12` — include a hidden `<span className="hidden fill-chart-1 bg-chart-1 … fill-chart-12 bg-chart-12" />` in `donut-chart.tsx` (or a Tailwind `@source inline(...)`/safelist) so the 24 classes are always generated. Verify by rendering.

- [ ] **Step 3: Run (PASS); typecheck; lint; verify classes emit; commit**

Run: `npm run test -- components/charts && npm run typecheck && npm run lint` → green. Confirm the `fill-chart-*`/`bg-chart-*` classes are present in the built CSS (the safelist span).
```bash
git add components/charts/donut.tsx components/charts/donut-legend.tsx components/charts/donut-chart.tsx components/charts/charts.test.tsx
git commit -m "feat: add Donut, DonutLegend, DonutChart (inline SVG, legend-led, RTL-safe)"
```

---

### Task 4: Wire into Budget + Payments + e2e

**Files:** Modify `app/[locale]/(app)/budget/budget-view.tsx`, `app/[locale]/(app)/payments/payments-view.tsx`; Create `e2e/charts.spec.ts`.

**Interfaces:** Consumes `DonutChart`, `categoryToken`, `payerToken`, `rollup`, `payerDisplayName`, the `Charts` i18n.

- [ ] **Step 1: Budget allocation donut**

In `budget-view.tsx` (which already receives `categories: CategoryAllocation[]`), build slices from `categories.filter((c) => c.recommended > 0)` → `{ label: tCategory(c.category), value: c.recommended, token: categoryToken(c.category) }`, and render `<DonutChart title={t('Charts.allocationTitle')} slices={slices} sliceTitle={(s,p)=>t('Charts.sliceTitle',{label:s.label, percent: Math.round(p*100), amount: fmt(s.value)})} formatRow={(p)=>t('Charts.legendRow',{percent: Math.round(p*100)})} formatAmount={fmt} emptyLabel={t('Charts.empty')} />` near the top of the budget view (above/beside the existing `CategoryBreakdown` — keep the breakdown as the text/table fallback). Use the existing `fmt` money formatter + `tCategory` translator already in the file. (The legend renders `formatRow(percent) · formatAmount(value)` → e.g. `25% · ₪75,000`; whole-shekel ₪.)

- [ ] **Step 2: Payments by-payer donut**

In `payments-view.tsx`, in the existing by-payer `<section>` (the `byPayerTitle` block, ~line 233), build slices from `totals.byPayer` → `{ label: payerDisplayName(p.payer, p.payerLabel, names, labels), value: p.amount, token: payerToken(p.payer, p.payerLabel) }` and render a `<DonutChart title={t('byPayerTitle')} ... emptyLabel={t('Charts.empty')} />` above the existing by-payer numeric list (keep the list as the fallback). Reuse the existing `payerDisplayName`/`PayerLabels`/money formatter already in the file.

- [ ] **Step 3: Component render check + commit the wiring**

Run: `npm run test && npm run typecheck && npm run lint` → green (both views still render; existing tests intact).
```bash
git add "app/[locale]/(app)/budget/budget-view.tsx" "app/[locale]/(app)/payments/payments-view.tsx"
git commit -m "feat: show allocation + by-payer donuts on the budget and payments pages"
```

- [ ] **Step 4: E2E (premium couple sees the charts)**

Create `e2e/charts.spec.ts` — copy the register/onboard + prisma-promote-to-premium idiom from `e2e/payments.spec.ts` (prefix `e2e-charts-`, `import 'dotenv/config'`, `test.afterAll` disconnect). Premium couple: set a budget total + record a payment (reuse the payments-spec flow), then assert the Budget page shows the **allocation** chart title (`Charts.allocationTitle` he/en) with a `<svg role="img">` present, and the Payments page shows the **by-payer** chart title + an `svg`. (Assert the chart heading + an svg path count > 0 — genuine, not just visible-text.) Run WARM with `--workers=1`: `lsof -ti :3000 | xargs kill; nohup npm run dev …; wait; npm run test:e2e -- charts.spec.ts --workers=1` (warm-up first if flaky).
```bash
git add e2e/charts.spec.ts
git commit -m "test: add e2e for the budget allocation + payments by-payer donuts"
```

---

### Final: Whole-branch review

- [ ] **Step 1: Full gate** — `npm run lint && npm run typecheck && npm run test && npm run test:e2e -- --workers=1` (warm) → green; record counts.
- [ ] **Step 2: Adversarial review** (most-capable model). Focus: chart colors are brand greens+burgundy tokens only (no gold, no ad-hoc hex; the accepted chroma/CVD validator residual is documented + mitigated by the always-present legend); legend/tooltip TEXT uses text tokens not slice colors; RTL-safe (logical props; ring direction-neutral; legend `ms-auto` mirrors); geometry correct (angles/percents sum; empty→no paths); entity→token maps stable (color follows entity, not rank); presentational-only (optimizer/rollup/gating untouched); premium gating inherited; he/en parity; the `fill/bg-chart-*` classes actually emit (safelist); whole-shekel ₪.
- [ ] **Step 3: Address Critical/Important (commit each); update `docs/superpowers/IMPLEMENTATION-LOG.md`** (charts summary, the palette-validation tradeoff decision, counts).
- [ ] **Step 4: Push / PR** — only on the user's explicit go-ahead.
