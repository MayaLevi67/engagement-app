# Wedding Planner AI — Phase 1: Foundation & Core Domain

**Status:** Approved for planning
**Date:** 2026-07-04

## Context

This is a ground-up rebuild of a wedding-planning SaaS product, previously validated as an MVP on Base44 (a no-code platform). The rebuild targets production quality, maintainability, and scalability to thousands of users, using standard software engineering practices instead of a no-code foundation.

The product is an AI-powered wedding planning platform: the single workspace that accompanies couples from engagement to wedding day, combining a checklist/timeline engine, budget planning, curated wedding concepts, a vendor database, and a multi-agent AI planning assistant. The full product spans many largely-independent subsystems, so work is being decomposed into phases, each with its own design → plan → implementation cycle:

1. **Foundation & Core Domain** *(this document)*
2. Onboarding & Wedding Profile
3. Checklist & Timeline
4. Wedding Concepts
5. Budget Planning
6. Vendor Database
7. Dashboard
8. Admin Panel
9. Premium & Payments
10. AI Multi-Agent Layer

This document covers **Phase 1 only**: the technical foundation every later phase builds on — tech stack, project structure, core domain model (User, Wedding), authentication/authorization, localization scaffolding, and baseline engineering conventions (testing, CI/CD, observability).

## Goals

- Establish a Next.js monolith architecture that can carry the whole product without needing a rewrite at "thousands of users" scale.
- Define the core `User` / `Wedding` relationship correctly up front, since it's expensive to change later (see Wedding Ownership Model below).
- Stand up authentication (email/password + Google), role-based authorization (User/Admin), and localization (Hebrew default + English, RTL) as reusable infrastructure for every later phase.
- Keep Phase 1 scoped to *foundation* — no checklist, concepts, budget, or vendor data model yet. Those are later phases.

## Non-goals (explicitly deferred)

- Wedding profile fields (date, budget, guest count, location, priorities) — Phase 2.
- Checklist/Task/ChecklistTemplate schema — Phase 3.
- Wedding Concepts, Budget categories, Vendor database — Phases 4–6.
- Admin CMS UI — Phase 8 (though the `role`-based gating mechanism is built now). Phase 8 scope now includes, beyond content management (ChecklistTemplates, Concepts, Vendors, Translations): a Users view (browse/manage accounts), basic Analytics (usage/conversion stats), and an audit Log of admin actions — patterns drawn from a reference backoffice dashboard, noted here so they aren't lost before Phase 8 is designed.
- Stripe integration and premium feature gating — Phase 9 (though the entitlement *model* is decided now, see below, since it depends on the Wedding date field this phase's schema anticipates).
- AI agents / orchestrator / RAG — Phase 10.

## Architecture

**Style:** Next.js 16 (App Router) full-stack monolith — frontend and backend in one codebase, using Route Handlers and Server Actions as the API layer. No separate backend service.

Rationale: a solo/small team benefits from one deploy, one repo, and shared TypeScript types between client and server (no API contract drift). Vercel scales a Next.js monolith comfortably past "thousands of users" — a separate backend service would add real operational overhead (two deployments, duplicated validation/types) without a corresponding need, since there's no second client (mobile, partner API) yet. The one place a monolith needs help is long-running/async work (AI agent orchestration, batch jobs) — that's handled by a background job runner rather than by splitting the app.

This repo's `AGENTS.md` flags that the installed Next.js version (16.2.10) has real breaking changes from older conventions — confirmed via `node_modules/next/dist/docs/`: `middleware.js` is renamed to `proxy.js`, and a new "Cache Components" model (`"use cache"`, `cacheLife`, `cacheTag`, `updateTag`) replaces some of the older ISR mental model. Implementation must be checked against these docs rather than assumed from general Next.js knowledge.

**Tech stack:**

| Concern | Choice | Why |
|---|---|---|
| Framework | Next.js 16, App Router | Already scaffolded; monolith decision above |
| Database | PostgreSQL (via Neon) | Relational data fits the domain; Neon autoscale-to-zero keeps early cost near $0; supports pgvector later for RAG (Phase 10) |
| ORM | Prisma | Type-safe schema/queries, mature migrations, good DX for a solo builder with a growing schema |
| Auth | Auth.js (NextAuth) + Prisma adapter | Free, no vendor lock-in, integrates directly with the Prisma schema; supports credentials + Google OAuth + custom flows |
| Sessions | JWT strategy | `proxy.ts` runs at the edge and can't cheaply query Postgres per request; role/weddingId embedded in the token for fast authorization checks. Trade-off: role changes apply on next token refresh, not instantly — acceptable since role changes are rare, manual, admin-initiated actions |
| i18n | next-intl | App Router-first, type-safe, first-class locale routing; Hebrew is the default locale (primary audience is Israeli couples), English is secondary |
| Email | Resend | Password reset and future notification emails; free tier covers early volume |
| Background jobs | Inngest | Reserved now (SDK + `/api/inngest` route wired, no functions yet) for Phase 10's multi-agent orchestration — Inngest's AgentKit is purpose-built for durable multi-agent workflows |
| Error tracking | Sentry | Free tier at current scale; catches production errors from day one instead of retrofitting after issues go unnoticed |
| Hosting | Vercel (Hobby while building → Pro at launch) | Native Next.js integration, image optimization matters for a design-forward "premium" product, AI SDK streaming is most mature on Vercel's runtime |
| Testing | Vitest (unit/integration) + Playwright (critical e2e flows) | Lean coverage for Phase 1: prove the foundation works, not exhaustive coverage |
| CI | GitHub Actions | Lint, typecheck, test on every PR; Vercel handles preview deploys separately |

All of the above have genuine free tiers sufficient through development and early launch; the only paid line item at commercial launch is Vercel Pro (~$20/month), independent of any other choice here.

## Project Structure

```
app/
  [locale]/                    # next-intl locale segment (he default, en)
    (marketing)/               # public marketing pages, own layout
    (auth)/                    # login, register, forgot-password
    (app)/                     # authenticated user area (dashboard, wedding workspace — later phases)
    admin/                     # admin-only area, gated via proxy.ts + role check
  api/                         # route handlers not tied to a locale (webhooks, auth callbacks, /api/inngest)
lib/
  auth/                        # Auth.js config, session helpers
  db/                          # Prisma client singleton
  i18n/                        # next-intl config, message loading
prisma/
  schema.prisma
  migrations/
messages/
  en.json
  he.json
proxy.ts                       # route protection (Next.js 16's renamed middleware.ts)
```

Route groups `(marketing)`, `(auth)`, `(app)` share the locale segment but get independent layouts (e.g. marketing has a public nav; `(app)` requires a session). `admin/` sits outside those groups since it's role-gated, not just session-gated. `lib/` holds cross-cutting server-side concerns so route/page files stay thin.

## Design Tokens (Visual Foundation)

The user's earlier Base44 MVP established a visual language worth carrying forward: a warm cream/parchment page background, a deep sage-green primary accent, a serif display face for headings paired with clean sans-serif body text, card-based layouts with soft shadows and generous rounded corners, and pill-shaped status badges. This is declared once now, as Tailwind theme tokens, rather than left for each later phase to reinvent — the same reasoning as the RTL logical-properties rule above: cheap to fix at the source, expensive to retrofit consistently across dozens of components later.

```
colors: {
  background: '#F7F3EC',     // page background (cream/parchment)
  surface: '#FFFFFF',        // card backgrounds
  primary: '#5B7553',        // sage green (active nav, key stat card)
  accent: '#C9A961',         // gold (premium badge, highlights)
  text: '#2A2A28',           // primary body text
  muted: '#8A8578',          // secondary/meta text
},
fontFamily: {
  display: [/* serif, e.g. Playfair Display or Fraunces */],  // couple names, section headers
  body: [/* clean sans, e.g. Inter */],                        // everything else
},
borderRadius: {
  card: '1rem',
},
```

Phase 1 only adds these token definitions to the Tailwind config and font setup (via `next/font`) as part of initial project scaffolding — it does not build any actual dashboard/checklist/etc. UI. Real screens are designed and built in their respective phases (e.g. the Dashboard screen itself is Phase 7), each pulling from this shared palette instead of hard-coded values.

## Domain Model

### Wedding Ownership Model

A `Wedding` can have multiple `User` members (a couple planning together), rather than a strict one-user-per-wedding model. This was a deliberate deviation from the original MVP spec's "every user owns exactly one wedding," because most couples plan together and want both partners logged in against the same workspace — retrofitting sharing after a strict 1:1 model ships would be a much more painful migration than designing for it now.

Implementation is a simple nullable FK (`User.weddingId → Wedding.id`) rather than a join table: one Wedding can have many Users, a User belongs to at most one Wedding. If a future role (e.g. a professional planner managing many weddings) needs many-to-many, that becomes a schema migration at that point — not designed for speculatively now.

### Schema (Phase 1 scope)

```prisma
enum UserRole {
  USER
  ADMIN
}

model User {
  id            String    @id @default(cuid())
  name          String?
  email         String    @unique
  emailVerified DateTime?
  image         String?
  passwordHash  String?              // null for OAuth-only users
  role          UserRole  @default(USER)
  locale        String    @default("he")

  weddingId     String?
  wedding       Wedding?  @relation(fields: [weddingId], references: [id])

  accounts      Account[]            // Auth.js OAuth links (Google, etc.)
  sessions      Session[]            // Auth.js sessions

  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

model Wedding {
  id            String    @id @default(cuid())
  members       User[]               // 1+ Users share this Wedding (couple)

  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  // Phase 2 adds: date, budget, guestCount, city, venueType,
  // ceremonyType, priorities, etc.
}

// --- Auth.js required tables (Prisma adapter) ---
model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}
```

`passwordHash` is nullable since Google-only users never set a password. No `Task`, `ChecklistTemplate`, `Concept`, or `Vendor` tables yet — those arrive in Phases 3, 4, and 6 respectively.

## Authentication & Authorization

**Flows:**
- **Registration:** Credentials provider — email + password, hashed with bcrypt/argon2 — creates a `User` row (`role: USER` by default).
- **Google login:** Standard Auth.js OAuth provider, auto-links via the `Account` table.
- **Forgot password:** Reuses the `VerificationToken` table — generate a token, email a reset link via Resend, user sets a new `passwordHash`.
- **Session claims:** `{ userId, role, weddingId }` embedded in the JWT so both `proxy.ts` and server components can authorize without extra DB queries.

**Route protection (`proxy.ts`):**
- `(app)/*` → requires a valid session; no session → redirect to `(auth)/login`.
- `admin/*` → requires a valid session **and** `role === ADMIN`; otherwise redirect/404.
- `(auth)/*` → if already authenticated, redirect away.

## Localization

- **Locale routing:** `app/[locale]/...` via next-intl, integrated into `proxy.ts`. `he` is the default (unprefixed, e.g. `/dashboard`), `en` is prefixed (`/en/dashboard`), matching the primary Israeli/Hebrew-speaking audience. `Accept-Language` detects first-time visitors; the choice is then persisted via cookie.
- **RTL:** `dir="rtl"` set on `<html>` based on active locale. Components use Tailwind logical properties (`ps-4`/`pe-4`/`text-start`, not `pl-4`/`pr-4`/`text-left`) from the first component built, so the premium/luxury layout doesn't break or mirror incorrectly when switching direction.
- **Translation storage:** Flat JSON per locale (`messages/he.json`, `messages/en.json`) for UI chrome text, type-safe via next-intl's generated types. This is distinct from admin-managed *data* (e.g. `ChecklistTemplate.title_he`/`title_en` in Phase 3, `Concept` fields in Phase 4), which lives in the database, not in these files.
- **No hard-coded strings:** enforced via an ESLint rule flagging raw string literals in JSX, active from initial setup rather than a discipline to maintain by memory.

## Testing, CI/CD, Observability

- **Testing:** Vitest for unit/integration tests (auth logic, domain helpers, Prisma queries against a test DB); Playwright for critical e2e flows — for Phase 1: register, login (credentials + Google), forgot-password, and admin-route-blocks-non-admin.
- **CI:** GitHub Actions on every PR — lint, `tsc --noEmit`, Vitest, Playwright. Vercel handles preview deployments per PR separately; CI gates merges on quality, not deployment.
- **Background jobs:** Inngest SDK installed, `/api/inngest` route handler wired up, no functions implemented yet — reserves the integration point for Phase 10.
- **Observability:** Sentry (free tier) wired up from Phase 1 for production error tracking.

## Premium Entitlement Model (decision banked for Phase 9)

Raised during Phase 1 domain modeling because it affects how `Wedding.date` (Phase 2) will be used later: premium access must **not** be a static boolean flipped by a cron job when the wedding date passes, since wedding dates get postponed and a static expiry would drift out of sync.

Instead: store only the fact of purchase — `premiumPurchasedAt: DateTime?` (permanent, needed for receipts/refunds, never cleared) — and compute access live, on every check:

```
hasPremiumAccess = premiumPurchasedAt !== null
                   && now() <= wedding.date + 30 days
```

The 30-day grace period covers post-wedding wrap-up (thank-you notes, final vendor payments, reviews). If the wedding date is postponed, the access window shifts automatically with it — correct behavior, since the couple is still actively planning. When the window closes, premium-only *features* lock; existing data remains visible (read-only/Free-tier view), it is not deleted. No Phase 1 schema change is required — this field belongs on `Wedding`/`Payment` records designed in Phase 9, once `wedding.date` exists from Phase 2.

## Open Items / Future Considerations

- Multi-wedding-per-user (e.g. a future professional planner role) is not designed for now; would require migrating `User.weddingId` to a join table if that need arises.
- Exact grace-period edge cases (e.g. a wedding date changed *after* the 30-day window already closed) are a Phase 9 design detail, not resolved here.
