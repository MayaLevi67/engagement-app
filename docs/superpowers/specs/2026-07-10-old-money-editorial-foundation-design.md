# Old-Money Editorial Redesign — Foundation — Design

**Status:** Approved (brainstorming, via visual companion) — ready for implementation plan.
**Date:** 2026-07-10
**Type:** UI/visual redesign. This spec is **sub-project 1 of the overhaul: the design foundation.** Per-page bespoke compositions are follow-on waves (roadmap at the end), each its own spec → plan.

## Goal

Transform the wedding-planner's look from flat cream-and-green rows into a bold, "old-money / Vogue editorial" experience that still stays user-friendly. This foundation establishes the visual **system** — palette, typography (incl. a classic-chic Hebrew display font), a forest hero band, and a reusable **editorial component kit** (section headers, elevated cards, feature cards, image blocks incl. the signature image-rail) — applies it **app-wide** so every page instantly looks richer, and **fully composes one flagship page (the Dashboard)** in the magazine/image-rail style as the proof + template.

## Decisions (locked during brainstorming)

- **Direction:** Hybrid — light, legible working pages + dark, cinematic hero/imagery bands.
- **Palette:** greens + burgundy + lights, **no gold** (the gold accent is removed/repurposed to wine). **Green-led** — sage green is the primary action color; wine (burgundy) is the emphasis/accent.
- **Hero:** the classic **forest band** (solid deep green, ivory serif, monogram, thin double-rule, countdown). No photo in the hero.
- **Imagery:** lives **in-page** as image blocks (signature = the **image-rail** spread), not in the hero; the couple supplies real photos later, so image slots must degrade gracefully when empty.
- **Hebrew display font:** **Bellefair** (names/hero/large titles), with **Frank Ruhl Libre** as the sturdier fallback for small/dense titles; Hebrew body stays **Assistant**.
- **English display:** stays **Playfair Display** for now (revisit later). Body: Inter (en) / Assistant (he) unchanged.
- **Layout signature:** magazine/asymmetric, **image-rail editorial spread (B)** as the signature pattern; pages compose **distinctly** from the shared kit (no two pages identical).
- **Sequencing:** foundation first (this spec) → per-page waves.

## Global Constraints

- **he + en parity** (identical i18n key sets, RTL default); **RTL-safe logical properties only** (`ps-`/`pe-`/`ms-`/`me-`/`text-start`/`text-end`/`border-s`/`border-e`) — no physical `left/right/ml/mr/pl/pr`.
- **Tokens only** — all color/type/radius via the theme tokens in `app/globals.css`; **no hard-coded hex** in components. No hard-coded UI strings (i18n).
- **Stays usable** — legible contrast (WCAG AA for text), dense data pages remain scannable; the redesign elevates, never sacrifices, usability.
- **Non-destructive to behavior** — this is presentational; server actions, data, gating, and routes are unchanged. Existing tests stay green; add tests for new shared components.
- **Reduced-motion** respected for any transitions; images lazy-load and have graceful empty/fallback states.

## 1. Palette & Tokens

Retune `app/globals.css` `@theme`:

| Token | Value | Role |
|---|---|---|
| `--color-background` | `#F4EEE2` (cream) | page background |
| `--color-surface` | `#FBF8F1` (ivory) | cards / raised surfaces (was stark white) |
| `--color-primary` | `#5B7553` (sage) | **action** — buttons, active tabs, links, selected states |
| `--color-forest` | `#2C3A2C` | dark hero/section bands, strong headings |
| `--color-wine` | `#7A2E3A` | **accent/emphasis** — remaining/overpaid money, key highlights, secondary CTAs |
| `--color-oxblood` | `#4E2028` | deepest dark band / dramatic sections |
| `--color-text` | `#242320` (ink) | body text |
| `--color-muted` | `#8A8578` (taupe) | secondary text |
| `--color-line` | `rgba(36,35,32,0.14)` | hairlines/rules (replaces gold rules) |

- **Remove the gold accent** (`--color-accent: #C9A961`). Grep every usage of `accent` in components and reassign: money-emphasis/highlight uses → `wine`; structural/hairline uses → `line`; neutral chrome → `muted`. No component may reference gold after this task.
- On dark bands (`forest`/`oxblood`) text is `ivory`; hairlines are `rgba(251,248,241,0.5)`.
- Contrast check: sage `#5B7553` on ivory, wine `#7A2E3A` on cream/ivory, and ivory on forest/oxblood must meet AA for their text sizes (verify; darken sage/wine slightly if a specific pairing fails).

## 2. Typography

- Wire **Bellefair** (Google Font, Hebrew + Latin subsets) into the existing per-locale font mechanism in `app/[locale]/layout.tsx` (which already sets `--font-display`/`--font-body` per locale). For Hebrew: `--font-display` → Bellefair. Add a second token `--font-display-strong` → Frank Ruhl Libre (he) for small/dense titles where Bellefair (a light single weight) loses legibility.
- English unchanged: `--font-display` → Playfair, `--font-body` → Inter. Hebrew body: Assistant.
- Usage rule: `font-display` (Bellefair/Playfair) for hero names, page titles, section headers, big numerals; `font-display-strong` (Frank Ruhl) for small section labels / table headers in Hebrew; `font-body` for everything else. Codify as utility classes or a small set of typographic components so pages don't guess.

## 3. Hero band component

`Hero` (RSC-friendly, presentational) — solid **forest** band, centered:
- Small **monogram** (couple initials derived from `partner1Name`/`partner2Name`, e.g. "M & A"; Latin initials, gracefully handles missing names).
- Couple names in **Bellefair** (ivory), from wedding data.
- A thin **double-rule** (`rgba(251,248,241,0.5)`), and the **countdown** (reuse the existing countdown logic) in Bellefair.
- Props: `partner1Name`, `partner2Name`, `countdownNode`/`children` (so pages pass their own subline). RTL-safe, responsive (comfortable on mobile). No image.

## 4. Editorial component kit (`components/editorial/`)

Location: a new top-level `components/editorial/` directory (importable from both `(app)` and non-`(app)` routes like auth, since the global uplift touches those too).

Reusable, token-based, RTL-safe building blocks so each page composes a distinct layout:
- **`SectionHeader`** — Bellefair title + hairline `--color-line` rule, optional oversized Bellefair numeral (muted sage), optional kicker (uppercase wine micro-label).
- **`Card`** (elevated) — ivory surface, `rounded-card`, soft shadow, optional **category side-border** (`border-s-[3px]` in a category color — sage default, wine for emphasis), serif title slot, meta slot, quiet pill slot.
- **`FeatureCard`** — larger card for a "next up"/highlight item; supports an optional leading image thumbnail.
- **`Pill`** — quiet token-based chip (neutral `#eae3d5`/muted; active = sage; emphasis = wine).
- **`ImageRail`** — the **signature** block: a tall photo column beside a content column (CSS grid, e.g. `1.6fr 1fr`); collapses to stacked on mobile; the image side takes an optional `src` and renders a graceful placeholder (subtle tonal block + label) when empty.
- **`ImageSection`** — full-bleed image band (optional `src`, tonal placeholder + optional scrim for overlaid text).
- **`PhotoCard`** — a card with a top/side photo slot (for concept/vendor-style items).
- All image slots: lazy-load, `object-cover`, fixed aspect ratios, empty-state fallback; alt text via i18n.

These are presentational; they wrap/replace the current ad-hoc card markup. Where a page already has a card/list, it should adopt `Card`/`SectionHeader` so the global uplift is real, not skin-deep.

## 5. Global uplift + Dashboard showcase

- **Global uplift:** apply the new tokens + typography app-wide (via `globals.css` + the font wiring + swapping the shared card/section/pill/button styling to the kit). Every existing page (checklist, budget, payments, concepts, vendors, admin, auth) must immediately render in the new palette/type with elevated cards and no gold — and must not visually break (verify each route renders). This is a broad but mostly mechanical restyle (token swap + adopting the shared components / class updates).
- **Dashboard showcase:** fully recompose `app/[locale]/(app)/dashboard` in the **magazine / image-rail** style using the kit — the forest `Hero`, a `SectionHeader`, an `ImageRail` (empty-state placeholder until photos exist) or `FeatureCard` for "next up", and the overview cards as elevated `Card`s in an asymmetric arrangement (not a plain stack). This is the proof + reference template for the waves.

## 6. Wave roadmap (follow-on specs — NOT this spec)

Each page gets its **own** composition from the kit so no two feel identical:
- **Checklist** — image-rail editorial spread with grouped `SectionHeader`s.
- **Payments** — elevated editorial (feature "totals" + by-payer as a composed panel), depends on the Payments feature being merged.
- **Budget** — the allocation/optimizer as an editorial panel.
- **Concepts** — image-forward (`PhotoCard`/`ImageSection`).
- **Vendors** — photo cards + editorial detail.
- Auth/onboarding — a lighter editorial pass.

## Testing

- Component tests (Vitest + Testing Library, `NextIntlClientProvider` idiom) for `Hero` (renders names/monogram/countdown slot), `SectionHeader`, `Card`, and `ImageRail` (renders content + image when `src` given, graceful placeholder when empty; RTL).
- A **token/no-gold guard**: a test or lint check asserting no component references the removed gold hex / `accent` token (grep-based unit test is acceptable).
- Existing unit + e2e suites stay green (presentational change; e2e selectors are label/role-based, but verify none keyed off a removed class). Run e2e warm / `--workers=1` per the known infra note.
- Manual: each route renders in he (RTL) + en without breakage; AA contrast spot-check on sage/wine/ivory pairings.

## Acceptance Criteria

1. Theme tokens updated (cream/ivory/sage/forest/wine/oxblood/ink/line); **no gold** anywhere; all components reference tokens, not hard-coded hex.
2. Bellefair wired as the Hebrew display font (with Frank Ruhl fallback for small titles); English stays Playfair; body fonts unchanged.
3. `Hero` (forest band) + the editorial kit (`SectionHeader`, `Card`, `FeatureCard`, `Pill`, `ImageRail`, `ImageSection`, `PhotoCard`) exist, are token-based, RTL-safe, and image slots degrade gracefully when empty.
4. The whole app renders in the new system (elevated cards, new palette/type) with no broken route.
5. The Dashboard is fully composed in the magazine/image-rail style as the reference template.
6. he/en parity, RTL logical props, AA contrast; existing tests green + new component tests pass.

## Deferred / Future

- Per-page bespoke compositions (the waves above).
- Real photography (couple-supplied) filling the image slots; possibly an upload flow later.
- Unifying English display to Bellefair; damask/texture treatments; motion polish.
