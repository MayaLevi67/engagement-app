# Wedding Planner AI — Phase 4: Wedding Concepts

**Status:** Approved for planning
**Date:** 2026-07-05
**Builds on:** Phase 1 (Foundation), Phase 2 (Onboarding & Wedding Profile), Phase 3 (Checklist & Timeline)

## Context

Phases 1–3 delivered auth, i18n (he default/RTL + en), the `Wedding` model with profile fields + `onboardingCompletedAt`, the onboarding wizard, the `/settings/wedding` edit page, and the checklist engine — the signature admin-master → per-couple **snapshot copy** architecture (`ChecklistTemplate` → `Task`), the couple-facing `/checklist` (complete/edit/delete-to-trash/restore/add-custom/reminders), a relative-due-date timeline, and a minimal `ADMIN` CRUD at `/admin/checklist-templates`. Admin role-gating (`/admin`, live-DB `User.role === ADMIN`) exists from Phase 1.

Phase 4 is **Wedding Concepts**: a curated, admin-authored library of wedding "concepts" (styles/directions — e.g. *Party Time*, *Italian Summer*, *Old Money*, *Modern Luxury*). Each concept carries a bilingual name, tagline, description, a color palette, a **vision board** (photos), and a **list of "ideas"/elements** (e.g. Party Time → "two DJs — mainstream + techno after-party", "extra party lighting", "sunglass station"). Couples browse the gallery, **favorite** a shortlist to compare, and **choose one** concept as their wedding's direction. From a concept's detail page, a couple can **push individual ideas into their Phase 3 checklist** as tasks. The chosen concept becomes the anchor that later phases build on: **budget optimization (Phase 5)** reads the selected concept's ideas + cost ranges, and **vendor recommendations (Phase 6)** hang off concept ideas.

This is a couple-facing content-consumption feature plus an admin CMS — no payments, no AI, no vendors in this phase.

## Goals

- An admin-managed master library of **concepts** (bilingual, with palette, vision-board images, and a list of ideas), plus a seeded default set of ~4 concepts to start from and to give tests real data.
- A couple-facing **`/concepts` gallery** (flat grid of active concepts) with favoriting (shortlist) and a concept **detail page** (hero, description, palette, ideas grouped by category).
- **One chosen concept per wedding** (`Wedding.selectedConceptId`) — the direction later phases target; selecting a new one replaces it. Choosing is a **reference**, not a full copy (Approach A).
- **Push-idea-to-checklist**: from a concept's detail page, a couple adds an idea to their checklist, creating an independent snapshot `Task` (reusing the Phase 3 copy pattern). Add-once-while-live; re-addable after the task is trashed.
- A minimal `ADMIN`-only CRUD to author concepts, their ideas, and their vision-board images (URL references), with reorder / active / premium toggles.

## Non-goals (deferred)

- **Image upload flow.** Vision-board photos are stored as **URL references** this phase (admin pastes URLs). The DB shape (`ConceptImage` rows with `url` + alt text) is identical to what an uploader would populate, so a drag-drop uploader (e.g. Cloudflare R2, ~$0 at this scale) drops in later with **no migration**. Deferred, not blocked.
- **Premium paywall enforcement.** `Concept.isPremium` is modeled now and the PREMIUM badge renders, but everyone can open/select any concept. Actual gating arrives with **Phase 9 (payments)**.
- **Budget optimization consuming concepts.** Concept ideas carry `estCostMin`/`estCostMax` + a category so **Phase 5** can sum/weight them, but no budget logic is built here.
- **Vendor recommendations per idea.** **Phase 6.**
- **AI-generated concepts.** Concepts are hand-authored by admin. AI is **Phase 10**.
- **Rich admin shell.** The admin CRUD here is minimal/functional, matching Phase 3; the polished shared admin panel is **Phase 8**.
- **Onboarding integration / gating.** Choosing a concept is optional and happens anytime from the `/concepts` nav item — it is **not** part of the onboarding gate.

## Key decisions

1. **Reference + selective push (Approach A), not full snapshot.** The couple's relationship to a concept is a reference (`Wedding.selectedConceptId` + `ConceptFavorite` rows). Couples view the **live** admin-curated concept — admin edits are reflected (desirable for inspiration content). The snapshot pattern is reused only where it earns its keep: when a couple **pushes an idea into the checklist**, that becomes a self-contained `Task` (frozen against later concept edits, exactly like `Task`↔`ChecklistTemplate`). Chosen over a full per-couple copy because couples don't customize ideas in place — they only select a direction and pull ideas into the checklist.
2. **`ConceptElement.category` reuses the existing `TaskCategory` enum.** Makes "push idea → checklist" a trivial 1:1 map (`element.category → Task.category`) and gives the UI category grouping (FLORALS→FLOWERS, DECORATION→DESIGN, MUSIC, DRESS INSPIRATION→ATTIRE…). Avoids inventing a second taxonomy prematurely; Phase 5 may introduce a dedicated budget category later if its breakdown needs one.
3. **Vision board is a related `ConceptImage` table**, not a JSON blob — orderable, alt-text per image, and the exact rows a future uploader would write. The first image by `sortOrder` doubles as the detail-page **hero/cover**.
4. **`palette` is a plain `String[]` of hex codes** on `Concept` — enough to render swatches; no palette sub-model.
5. **One chosen concept, plus a favorites shortlist.** `Wedding.selectedConceptId` is the single committed direction (replace-on-select). `ConceptFavorite` (unique `[weddingId, conceptId]`) is the compare-list. (User-chosen over single-only or multi-active.)
6. **Add-once-while-live push.** `addElementToChecklist` is a no-op while a non-deleted `Task` with that `sourceConceptElementId` exists (UI shows "Added ✓"); after the couple trashes that task, the idea becomes addable again. Uses a lookup, not a unique constraint, to respect the checklist's soft-delete semantics.
7. **Per-item title language override.** Concepts and ideas render through the same `TitleLocale` (`AUTO`/`EN`/`HE`) resolver pattern as Phase 3 (reused/extended), defaulting to the couple's locale, both titles always stored — the admin controls wording in both languages (a direct response to disliking auto-translated Hebrew).
8. **Live-DB admin authorization** on every admin mutation (`User.role === ADMIN` read fresh, rejecting a stale JWT) — the Phase 3 pattern.
9. **Minimal admin CRUD now + a committed idempotent seed** of ~4 bilingual concepts — matching the Phase 3 approach.

## Scale & cost calibration

Right-sized to a few thousand couples. Concepts are a small admin-curated catalog (~dozen concepts × a handful of images/ideas each — well under 1 GB of images ever), read-heavy and cacheable. Storing images as **URL references** adds **zero new external services or secrets** this phase; a real uploader (Cloudflare R2 — 10 GB free, zero egress, ~$0 at this scale) is a purely additive later task. Gallery/detail reads are indexed by concept; couple state (selection + favorites) is a single `selectedConceptId` field plus a small `ConceptFavorite` set. Pushing an idea is one `Task` insert reusing the existing indexed checklist path. No background jobs introduced.

## Data model

Four new models + one field (plus a relation) on `Wedding`, and one provenance field on `Task`. All mirror Phase 3 conventions (bilingual `_he`/`_en`, `TitleLocale`, `active`/`sortOrder`).

```prisma
model Concept {
  id             String   @id @default(cuid())
  title_en       String
  title_he       String
  titleLocale    TitleLocale @default(AUTO)
  tagline_en     String?           // "Lemons, linen and golden light"
  tagline_he     String?
  description_en String?           // longer intro paragraph
  description_he String?
  palette        String[]          // hex swatches, e.g. ["#7A1F2B","#C9A227","#FFFFFF","#1C1C1C"]
  isPremium      Boolean  @default(false)
  active         Boolean  @default(true)
  sortOrder      Int      @default(0)

  images         ConceptImage[]
  elements       ConceptElement[]
  favoritedBy    ConceptFavorite[]
  selectedBy     Wedding[]         // couples who chose this one (via Wedding.selectedConceptId)

  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}

model ConceptImage {          // vision board — URL refs now, upload-ready later
  id         String  @id @default(cuid())
  conceptId  String
  concept    Concept @relation(fields: [conceptId], references: [id], onDelete: Cascade)
  url        String
  alt_en     String?
  alt_he     String?
  sortOrder  Int     @default(0)   // first = hero/cover
}

model ConceptElement {        // one "idea" (e.g. "Techno after-party DJ")
  id             String   @id @default(cuid())
  conceptId      String
  concept        Concept  @relation(fields: [conceptId], references: [id], onDelete: Cascade)
  title_en       String
  title_he       String
  titleLocale    TitleLocale @default(AUTO)
  description_en String?
  description_he String?
  category       TaskCategory       // reuse existing enum (MUSIC, DESIGN, CATERING, FLOWERS, ATTIRE…)
  estCostMin     Int?               // ₪ range for Phase 5 budget optimization
  estCostMax     Int?
  active         Boolean  @default(true)
  sortOrder      Int      @default(0)
}

model ConceptFavorite {       // couple's shortlist to compare
  id        String   @id @default(cuid())
  weddingId String
  wedding   Wedding  @relation(fields: [weddingId], references: [id], onDelete: Cascade)
  conceptId String
  concept   Concept  @relation(fields: [conceptId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
  @@unique([weddingId, conceptId])   // idempotent favorite
}
```

Added to `Wedding`:
```prisma
selectedConceptId String?
selectedConcept   Concept? @relation(fields: [selectedConceptId], references: [id], onDelete: SetNull)
favorites         ConceptFavorite[]
```

Added to `Task` (provenance only, mirrors `sourceTemplateId`):
```prisma
sourceConceptElementId String?   // null on element/concept delete; provenance only
```

## Domain logic & server actions

Following the Phase 3 layout: pure logic + Zod in `lib/concepts/`, server actions in `lib/actions/`.

**`lib/concepts/` (pure, unit-tested):**
- `title.ts` — the `TitleLocale` resolver for concepts + ideas (reuse/extend the Phase 3 resolver if generic).
- `schema.ts` — Zod: `conceptInput`, `conceptElementInput`, `conceptImageInput`. Validates hex format for each `palette` entry, `estCostMin ≤ estCostMax` (when both set), URL shape + required `url` per image, non-empty `title_en`/`title_he`, `category ∈ TaskCategory`.
- `queries.ts` — `getActiveConcepts()` (gallery), `getConceptDetail(id)` (images + active elements ordered), `getWeddingConceptState(weddingId)` (`selectedConceptId` + favorited concept ids + which element ids already have a live pushed task), `elementToTaskPayload(element)` (maps an element → a `Task` snapshot).

**`lib/actions/concepts.ts` — couple actions** (ownership-scoped to the session `weddingId`, same guard as `checklist.ts`; reject when no `weddingId`):
- `chooseConcept(conceptId)` → set `Wedding.selectedConceptId` (replace prior).
- `clearSelectedConcept()` → null it.
- `toggleFavorite(conceptId)` → upsert/delete `ConceptFavorite` (idempotent via unique index).
- `addElementToChecklist(elementId)` → snapshot the element into a `Task` (titles + category from element, `dueOffsetDays: null`, `sourceConceptElementId` set). The task is created with **`isCustom: true`** — it behaves as a fully couple-managed task (editable/deletable/restorable like any hand-added one), with `sourceConceptElementId` recording its concept origin (distinct from `isCustom`, which governs editability, not provenance). **No-op while a live copy exists.**

**`lib/actions/admin-concepts.ts` — admin CMS actions** (live-DB `ADMIN` check on every mutation, like `admin-templates.ts`):
- Concept: `createConcept`, `updateConcept` (partial-update where practical, or documented full-replace), `deleteConcept`, `setConceptActive`, `setConceptPremium`, `reorderConcepts`.
- Element: `createElement`, `updateElement`, `deleteElement`, `reorderElements`.
- Image: `addImage`, `updateImage`, `deleteImage`, `reorderImages`.

## UI & navigation

**Placement:** a standalone **`/concepts`** couple-facing section, a nav item alongside `/checklist` — not part of the onboarding gate. Added to the proxy `APP_PREFIXES` login-gate (the Phase 3 final-review lesson). A light **dashboard nudge** ("Choose your wedding concept") shows when none is selected (changeable/removable).

**Couple UI — `app/[locale]/(app)/concepts/`:**
- `page.tsx` — flat **gallery** grid: cards with cover image, name, tagline, palette swatches, PREMIUM badge, favorite (heart) toggle, and a "selected" indicator. Server component; loads active concepts + the wedding's selection/favorite state.
- `concept-card.tsx` — the card + client favorite toggle.
- `[conceptId]/page.tsx` — **detail**: hero (cover image + name + tagline overlay), a "Select this concept" card, description, **Color Palette** (hex-labeled swatches), then **idea cards grouped by category**, each showing title + description + cost range + an **"Add to checklist"** button (→ "Added ✓" while live).
- Client components (`favorite-button.tsx`, `choose-concept-button.tsx`, `add-idea-button.tsx`) call the server actions with optimistic UI, mirroring `task-row.tsx`.

**Admin CMS — `app/[locale]/admin/concepts/`:**
- `page.tsx` — concepts list (reorder, active toggle, premium toggle, edit/delete) — mirrors `checklist-templates`.
- `concept-form.tsx` — bilingual titles/tagline/description, `titleLocale`, palette (hex inputs), premium/active.
- Focused sub-editors for **elements** (add/edit/reorder ideas: bilingual title/description, category, cost range) and **images** (url + alt text + order), kept as small components so no file grows too large.
- Admin nav: add a "Concepts" link next to "Checklist Templates".

**i18n / RTL:** all chrome via `messages/he.json` + `en.json` (no hard-coded strings — ESLint enforced); logical Tailwind properties (`ps-`/`pe-`/`text-start`) so RTL Hebrew and LTR English both render correctly; old-money palette/fonts from the design tokens.

**Seed:** a committed, idempotent seed of ~4 concepts (e.g. Party Time, Italian Summer, Old Money, Modern Luxury) — each bilingual, with a palette, a few placeholder image URLs, and a handful of bilingual ideas across categories — mirroring the Phase 3 seed. Gives a working starting library and real data for tests.

## Error handling & edge cases

- **Ownership scoping** — every couple action resolves `weddingId` from the session and operates only on that wedding; reject otherwise.
- **Admin authorization** — every admin mutation re-checks `User.role === ADMIN` against the live DB (rejects a stale-JWT admin).
- **Delete a selected concept** → `selectedConceptId` → null (`onDelete: SetNull`); couple UI shows "no concept chosen".
- **Delete a favorited concept** → cascade-removes the favorite row.
- **Inactive concept** → hidden from gallery, but a couple who already selected it keeps the reference; its detail resolves read-only rather than 404.
- **Source element deleted after push** → the `Task` stands alone (snapshot); `sourceConceptElementId` dangles (provenance only).
- **Duplicate guards** — favorite idempotent (unique index); push add-once-while-live.
- **Validation** — Zod at every action boundary (hex palette, cost-range ordering, image URL/required, non-empty titles, category enum).
- **Premium** — badge renders from `isPremium`; no gating enforced (documented intentional no-op until Phase 9).
- **Concurrency** — low-stakes admin reorder races self-correct on refresh (accepted Phase 3 trade-off); no locking added.

## Testing strategy

Mirrors Phase 3's split (unit-heavy + focused e2e).

- **Unit (Vitest):**
  - `lib/concepts/schema.test.ts` — hex palette, cost-range ordering, image URL/required, category enum, empty titles.
  - `lib/concepts/title.test.ts` — resolver AUTO/EN/HE for concepts + ideas.
  - `lib/concepts/queries.test.ts` — active-only filtering, ordered images/elements, `elementToTaskPayload` mapping, "already-pushed" detection.
  - `lib/actions/concepts.test.ts` — choose/clear/replace selection; favorite toggle idempotency; push creates a correct snapshot `Task`, is a no-op while live, re-addable after trash; ownership rejection on weddingId mismatch.
  - `lib/actions/admin-concepts.test.ts` — CRUD happy paths; non-admin rejected (live-DB role); cascade/SetNull on delete.
  - Seed test — idempotent re-run doesn't duplicate.
- **Component (Vitest + RTL):** gallery card (badge, favorite state, selected indicator); detail (palette swatches, grouped idea cards, "Added ✓"); admin form validation surfacing.
- **E2E (Playwright):** couple browses gallery → favorites two → opens a concept → selects it → pushes an idea → verifies it in `/checklist` → sees "Added ✓" → trashes it → idea re-addable. Admin: create a concept with an idea + image → appears in couple gallery. Logged-out `/concepts` + non-admin `/admin/concepts` are gated.

## Acceptance criteria

1. Couple sees a flat gallery of active concepts (name, tagline, palette, PREMIUM badge), he + en, RTL correct.
2. Couple can favorite/unfavorite concepts; the shortlist persists.
3. Couple can select one concept as their wedding's direction; selecting another replaces it; clearing works.
4. Concept detail shows hero, description, palette (hex swatches), and ideas grouped by category with cost ranges.
5. Couple can push an idea to the checklist; it appears as a `Task` in `/checklist`; add-once-while-live; re-addable after trash.
6. Admin can CRUD concepts, ideas, and vision-board images (URL refs) — bilingual — with reorder, active, and premium toggles.
7. Admin mutations reject non-admins (live-DB role).
8. Deleting a selected concept clears the couple's selection gracefully; deleting a source element leaves pushed tasks intact.
9. No hard-coded strings (ESLint clean); logical properties render both RTL and LTR correctly.
10. Seed provides ~4 working bilingual concepts; re-running it does not duplicate.
11. `lint --max-warnings 0`, typecheck, and all unit + e2e tests green.

## Roadmap position

Done: Phase 1 (Foundation), Phase 2 (Onboarding & Profile), Phase 3 (Checklist & Timeline).
**This: Phase 4 — Wedding Concepts.** Next: Budget Planning (5, consumes selected concept + idea cost ranges), Vendor Database (6, recommendations per idea), Dashboard (7), Admin Panel (8), Premium/Payments (9, enforces `isPremium`), AI Multi-Agent Layer (10).
