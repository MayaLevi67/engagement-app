# Budget & Payments Donut Charts — Design

**Status:** Approved (brainstorming; dataviz consulted) — ready for implementation plan.
**Date:** 2026-07-11
**Type:** Small presentational feature — adds two donut charts. Builds on the editorial foundation (palette tokens + kit). Reference: the user's "הקצאה / Allocation" donut mockup.

## Goal

Add two donut charts (inline SVG, no chart library) in the old-money palette:
1. **Budget page** — an **"הקצאה / Allocation"** donut visualizing the optimizer's **recommended** per-category budget split, with a legend of `● category · % · ₪amount` (matches the user's reference mockup).
2. **Payments page** — a **by-payer** donut ("who paid so far") over the existing `rollup().byPayer` totals, payer roles resolved to the couple's real names.

Both make the money split friendlier than rows of numbers, and live inside the already-premium-gated pages.

## Non-Goals

- No chart library dependency (hand-rolled inline SVG).
- No dark-mode chart variant — the app is a single light theme (charts sit on cream/ivory); validate against the light surface only.
- No drill-down / click-through / animation beyond a hover tooltip (deferred).
- Not changing the budget optimizer or the payments rollup — charts consume existing outputs.
- Budget donut shows **all non-zero categories** (no "Other" folding) per the user's choice.

## Global Constraints

- **Tokens only** — chart colors are theme tokens (`--color-chart-1..N` in `app/globals.css`), not ad-hoc hex in components; legend/tooltip **text uses ink/muted text tokens**, never the slice color (the color dot carries identity). No gold (the `globals-nogold` guard still passes).
- **Categorical palette is validated, not eyeballed** — run the dataviz `validate_palette.js` on the chosen palette against the cream surface; fix/snap FAILs. Assign colors in **fixed order per entity** (a category/payer always gets the same color — never by rank/size).
- **Accessibility:** the **legend is always present** (label + value) so identity is never color-alone — this is the required secondary encoding for a >8-slice categorical chart; each slice has an SVG `<title>` (category/payer · % · ₪); the existing numeric breakdown rows on each page serve as the table/text fallback.
- **RTL-safe** — legend rows use logical properties (`ms/me`, `text-start/end`); the donut ring is direction-neutral. he default + en; chart titles + any new copy via i18n (identical he/en key sets); category names reuse existing `TaskCategory` i18n; payer names via `payerDisplayName`.
- **Whole-shekel Int** money, formatted `₪{n.toLocaleString(locale)}` like the rest of the app.
- Presentational only — no behavior/data/gating change; premium gating inherited from the pages. Lint (`--max-warnings 0`) + typecheck green; new tests; existing suite green; e2e warm/`--workers=1`.

## Components (`components/charts/`)

- **`donut-geometry.ts`** (pure) — `donutSegments(items: { value: number }[]): { startAngle, endAngle, percent, index }[]` computing cumulative angles (start at 12 o'clock, clockwise), each slice's `percent = value/total`; and `arcPath(cx, cy, rOuter, rInner, startAngle, endAngle): string` producing the SVG ring-segment `d`. Zero-total → empty. Handles a single 100% slice (full ring).
- **`Donut`** (`donut.tsx`) — presentational SVG: takes `slices: { label: string; value: number; colorToken: string }[]`, renders a thin ring with a **2px surface (cream) gap** between segments, each `<path>` filled via its `colorToken` (`fill-chart-N`) with an SVG `<title>` (`label · % · ₪value`). Empty state (`no data`) renders a muted placeholder ring/text. Fixed viewBox, responsive via `max-width`.
- **`DonutLegend`** (`donut-legend.tsx`) — the legend list: one row per slice `● {label} · {percent}% · ₪{amount}`, sorted largest-first, color dot = `bg-chart-N`, text in `text-text`/`text-muted`. RTL-safe.
- **`DonutChart`** (`donut-chart.tsx`) — composes `Donut` + `DonutLegend` under an optional title (`font-display`), a reusable card-ready block. This is what pages drop in.

## Palette (tokens; validated) — STRICTLY greens + burgundy

Chart colors come **only from the brand palette: greens + burgundy** (cream/ivory are the chart **surface + the 2px inter-slice gaps**, never slice fills — a cream slice would vanish on the cream page). Add a fixed-order categorical ramp to `app/globals.css` `@theme`: `--color-chart-1 … --color-chart-12`, built from **tints/shades of green and burgundy only** — e.g. forest `#2C3A2C`, wine `#7A2E3A`, sage `#587151`, oxblood `#4E2028`, light-sage `#8A9B7E`, dusty-rose-burgundy `#A56B74`, deep-olive-green `#6E7A55`, mauve-burgundy `#9B6B72`, pale-sage `#B4C0A8`, muted-plum `#7C4A55`, pine `#3F5540`, rosewood `#8C5560` (candidate order — **the order alternates green↔burgundy and steps lightness to maximize adjacent-slice contrast within the two-hue limit**). A fixed **entity→token map**:
- **Budget:** `TaskCategory` → `chart-N` by the enum's declared order (stable; VENUE=1, CATERING=2, …), so a category's color never changes.
- **Payments:** `PayerRole` → `chart-N` by role order (PARTNER_1, PARTNER_2, BOTH, PARTNER_1_FAMILY, PARTNER_2_FAMILY, OTHER); `OTHER` with distinct labels cycle through the remaining tokens deterministically by label.
- **Validation:** run `node scripts/validate_palette.js "<the hex ramp>" --mode light` (cream surface). Fix/snap any lightness/chroma/**contrast** FAIL (each slice must be readable on cream). Twelve slices confined to two hue families **cannot** all pass CVD adjacent-pair separation — that is expected and acceptable here **because the ever-present legend (label + % + ₪) is the required secondary-encoding channel** and each slice carries a `<title>`; order the ramp to maximize adjacent contrast, and accept the CVD WARN with the legend as the documented mitigation (never rely on color alone).

## Data wiring

- **Budget:** in the budget page/view, take the optimizer's `allocations: { category, recommended }[]`, keep `recommended > 0`, map to `slices` (`label = tCategory(category)`, `value = recommended`, `colorToken = categoryColor(category)`), render `<DonutChart title={t('allocationTitle')}>`. Percentages computed from the shown slices' total.
- **Payments:** in the payments view's money-spent/by-payer section, take `rollup(rows).byPayer`, map to `slices` (`label = payerDisplayName(payer, payerLabel, names, labels)`, `value = amount`, `colorToken = payerColor(payer, payerLabel)`), render `<DonutChart title={t('byPayerTitle')}>`. Empty (no payments) → the donut's empty state.

## i18n

New keys (both locales): `Charts.allocationTitle` ("Recommended allocation" / "הקצאה מומלצת"), `Charts.byPayerTitle` ("Paid by" / "מי שילם"), `Charts.legendRow` (ICU `"{percent}% · {amount}"`), `Charts.empty` ("No data yet" / "אין נתונים עדיין"), `Charts.sliceTitle` (`"{label}: {percent}% · {amount}"` for the `<title>`). Category + payer names reuse existing namespaces.

## Testing

- **Pure:** `donutSegments` (two slices → correct cumulative angles + percents; single slice → full ring; empty → []), `arcPath` (well-formed `d`, inner+outer radii), the entity→color maps (stable/deterministic; distinct labels for OTHER get distinct tokens).
- **Component:** `Donut` renders N `<path>`s with `<title>`s; `DonutLegend` renders sorted rows with `%`+`₪` and color dots; empty state renders the placeholder; text uses text tokens not slice colors.
- **Palette validation:** run the dataviz validator on the chart palette (a script invocation in the task; record pass/fix).
- **Integration:** budget page renders the allocation donut from optimizer output; payments page renders the by-payer donut; both hidden/paywalled for free couples (inherit gating) — verify no regression. Existing suite green; e2e warm `--workers=1`.

## Acceptance Criteria

1. A `Donut`/`DonutLegend`/`DonutChart` set exists in `components/charts/`, inline-SVG, no chart-lib dependency, token-based, RTL-safe.
2. Budget page shows the recommended-allocation donut (all non-zero categories) with a `● category · % · ₪` legend, sorted largest-first, matching the reference.
3. Payments page shows the by-payer donut over `rollup().byPayer` with resolved payer names.
4. Chart palette is a validated, fixed-order token set; colors are assigned per entity (stable), never by rank; legend text uses text tokens; no gold.
5. Each slice has an accessible `<title>`; legend provides color-independent identity; empty states handled.
6. he/en parity; premium gating inherited; presentational-only; lint/typecheck/unit/e2e green.

## Deferred

- Hover tooltip richness beyond `<title>` / click-to-filter / animation.
- Applying these within the eventual Budget/Payments editorial *waves* (this drops the charts in now; the waves refine surrounding layout).
