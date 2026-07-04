# Phase 1: Foundation & Core Domain — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the production-grade technical foundation for the AI wedding-planning SaaS — project tooling, design tokens, database + ORM, authentication/authorization, localization, background-job/observability wiring, and CI — so every later feature phase builds on a consistent, tested base.

**Architecture:** Next.js 16 App Router full-stack monolith. PostgreSQL via Prisma (local Docker Postgres for dev/test, Neon in production — swapped by `DATABASE_URL` only). Auth.js (NextAuth v5) with the Prisma adapter and JWT sessions carrying `{ userId, role, weddingId }`. Localization via next-intl with Hebrew as the unprefixed default and English at `/en`. Route protection composed in `proxy.ts` (Next.js 16's renamed middleware). Inngest and Sentry are wired but dormant until later phases.

**Tech Stack:** Next.js 16.2.10, React 19, TypeScript, Tailwind CSS v4, Prisma + PostgreSQL, Auth.js v5 (`next-auth@beta`) + `@auth/prisma-adapter`, `bcryptjs`, next-intl, Resend, Inngest, Sentry, Vitest, Playwright, GitHub Actions, Docker Compose.

## Global Constraints

- **Next.js version:** 16.2.10, App Router only. `middleware.ts` does NOT exist in this version — route interception lives in `proxy.ts`. Before writing any version-sensitive framework code, check `node_modules/next/dist/docs/` and, for third-party libs (Auth.js v5, Prisma, next-intl), verify current API via context7 — APIs may differ from training data (per repo `AGENTS.md`).
- **Database:** PostgreSQL only, accessed exclusively through Prisma. Local dev/test uses Docker Postgres; production uses Neon. The only difference is `DATABASE_URL`.
- **Sessions:** JWT strategy (required because the Credentials provider is incompatible with database sessions). JWT must carry `{ userId, role, weddingId }`.
- **Wedding ownership:** A `Wedding` has many `User` members via nullable FK `User.weddingId`. A `User` belongs to at most one `Wedding`. No join table.
- **Roles:** `UserRole` enum = `USER | ADMIN`. New users default to `USER`.
- **Localization:** next-intl. Locales = `['he', 'en']`, `defaultLocale: 'he'`, `localePrefix: 'as-needed'` (Hebrew unprefixed at `/`, English at `/en`). No hard-coded UI strings — all UI text comes from `messages/{he,en}.json`. Admin-managed content (e.g. future `title_he`/`title_en`) lives in the DB, not these files.
- **RTL:** `<html dir>` is `rtl` for `he`, `ltr` for `en`. Components use Tailwind logical properties (`ps-*`, `pe-*`, `ms-*`, `me-*`, `text-start`, `text-end`) — never physical (`pl-*`, `pr-*`, `text-left`, `text-right`).
- **Design tokens (Tailwind v4 `@theme` in `app/globals.css`):** `background #F7F3EC`, `surface #FFFFFF`, `primary #5B7553`, `accent #C9A961`, `text #2A2A28`, `muted #8A8578`. Display font = a serif (Playfair Display), body font = a clean sans (Inter), both via `next/font/google`. Card radius = `1rem`.
- **Third-party credentials:** Google OAuth, Resend, Sentry are scaffolded with env-var placeholders and documented in `.env.example`. Code paths are complete; real keys are dropped in later. Tests that would hit these services mock them.
- **Commits:** Do NOT run `git commit` or `git push` without the user's explicit permission each time (standing user instruction). Steps below that say "Commit" mean: stage the changes and ASK the user before committing.

---

## File Structure

```
docker-compose.yml                      # local Postgres (dev + test databases)
.env.example                            # documents every required env var
.env                                    # local dev secrets (gitignored)
.env.test                               # test DB url (gitignored)
vitest.config.ts                        # Vitest config + globalSetup
vitest.setup.ts                         # per-test setup (env, mocks)
test/global-setup.ts                    # runs prisma migrate on the test DB
.github/workflows/ci.yml                # lint + typecheck + test on PR

prisma/
  schema.prisma                         # datasource, generator, Phase 1 models
  migrations/                           # generated migration SQL

app/
  globals.css                           # Tailwind v4 @theme design tokens
  layout.tsx                            # root <html> shell (locale/dir set here)
  [locale]/
    layout.tsx                          # NextIntlClientProvider wrapper
    (marketing)/
      page.tsx                          # public landing (localized)
    (auth)/
      login/page.tsx                    # login form (scaffold)
      register/page.tsx                 # register form (scaffold)
      forgot-password/page.tsx          # request reset (scaffold)
      reset-password/page.tsx           # set new password (scaffold)
    (app)/
      dashboard/page.tsx                # placeholder authed page
    admin/
      page.tsx                          # placeholder admin page
  api/
    auth/[...nextauth]/route.ts         # Auth.js route handlers
    inngest/route.ts                    # Inngest serve endpoint (no functions yet)

lib/
  db.ts                                 # Prisma client singleton
  auth/
    config.ts                           # Auth.js config (providers, callbacks)
    index.ts                            # exports handlers, auth, signIn, signOut
    password.ts                         # hash/verify helpers
    authorize.ts                        # pure route-authorization decision fn
  actions/
    register.ts                         # register server action
    reset-password.ts                   # request + perform reset server actions
  email/
    resend.ts                           # Resend client + sendPasswordResetEmail
  inngest/
    client.ts                           # Inngest client instance
  i18n/
    routing.ts                          # next-intl routing config
    request.ts                          # next-intl getRequestConfig (cookie locale)
    navigation.ts                       # locale-aware Link/redirect helpers

messages/
  he.json                              # Hebrew UI strings (default)
  en.json                              # English UI strings

proxy.ts                               # composes next-intl routing + auth protection

sentry.server.config.ts                # Sentry init (server)
sentry.edge.config.ts                  # Sentry init (edge)
instrumentation.ts                     # registers Sentry
instrumentation-client.ts              # Sentry init (client)

eslint.config.mjs                      # + no-hardcoded-JSX-strings rule
```

Design principle: `lib/` holds focused single-responsibility modules so route/page files stay thin. Pure logic (`password.ts`, `authorize.ts`) is separated from framework wiring specifically so it can be unit-tested without a running server or DB.

---

## Task 1: Tooling baseline (cleanup + Vitest)

Establishes the test runner and clears create-next-app boilerplate so later tasks have a clean, test-driven base.

**Files:**
- Modify: `package.json` (scripts + devDeps)
- Create: `vitest.config.ts`, `vitest.setup.ts`
- Create: `lib/utils.ts` (trivial first unit to prove the harness)
- Create: `lib/utils.test.ts`
- Delete: `app/page.tsx` boilerplate content (replaced later), `public/*.svg` demo assets
- Modify: `app/layout.tsx` (strip demo fonts/metadata; real fonts come in Task 2)

**Interfaces:**
- Produces: `cn(...classes)` — a `clsx`-style className joiner used by later UI; signature `cn(...inputs: Array<string | false | null | undefined>): string`.

- [ ] **Step 1: Install test + utility dependencies**

```bash
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom
npm install clsx
```

- [ ] **Step 2: Add scripts to `package.json`**

In the `"scripts"` block, add:

```json
"test": "vitest run",
"test:watch": "vitest",
"typecheck": "tsc --noEmit"
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
});
```

- [ ] **Step 4: Create `vitest.setup.ts`**

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 5: Write the failing test — `lib/utils.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { cn } from './utils';

describe('cn', () => {
  it('joins truthy class names and drops falsy ones', () => {
    expect(cn('a', false, 'b', undefined, null, 'c')).toBe('a b c');
  });

  it('returns an empty string when given nothing usable', () => {
    expect(cn(false, null, undefined)).toBe('');
  });
});
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `npm test -- lib/utils.test.ts`
Expected: FAIL — cannot resolve `./utils` (module does not exist).

- [ ] **Step 7: Implement `lib/utils.ts`**

```ts
import { clsx, type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npm test -- lib/utils.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 9: Remove boilerplate**

- Delete demo assets: `public/next.svg`, `public/vercel.svg`, `public/file.svg`, `public/window.svg`, `public/globe.svg`.
- Replace `app/page.tsx` with a temporary minimal export (the real localized landing arrives in Task 4):

```tsx
export default function Home() {
  return null;
}
```

- Simplify `app/layout.tsx` to remove demo fonts (real fonts arrive in Task 2):

```tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Wedding Planner',
  description: 'AI-powered wedding planning',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="he" dir="rtl" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
```

- [ ] **Step 10: Verify the app still builds and typechecks**

Run: `npm run typecheck` → Expected: no errors.
Run: `npm run build` → Expected: build succeeds.

- [ ] **Step 11: Commit (ask first)**

Stage, then ASK the user before committing:

```bash
git add -A
# On approval:
git commit -m "chore: add Vitest harness and clear create-next-app boilerplate"
```

---

## Task 2: Design tokens + fonts

Locks the visual language (from the Base44 reference) into Tailwind v4 tokens and `next/font`, so every later component is consistent by default.

**Files:**
- Modify: `app/globals.css` (Tailwind v4 `@theme` tokens)
- Modify: `app/layout.tsx` (Playfair Display + Inter via `next/font/google`)
- Create: `app/design-tokens.test.tsx` (renders a token-styled element and asserts classes resolve)

**Interfaces:**
- Produces: Tailwind color utilities `bg-background`, `bg-surface`, `bg-primary`, `bg-accent`, `text-text`, `text-muted`; font utilities `font-display`, `font-body`; radius utility `rounded-card`. CSS variables `--font-display`, `--font-body` set on `<html>`.

- [ ] **Step 1: Replace `app/globals.css` with design tokens**

```css
@import "tailwindcss";

@theme {
  --color-background: #F7F3EC;
  --color-surface: #FFFFFF;
  --color-primary: #5B7553;
  --color-accent: #C9A961;
  --color-text: #2A2A28;
  --color-muted: #8A8578;

  --font-display: var(--font-playfair);
  --font-body: var(--font-inter);

  --radius-card: 1rem;
}

body {
  background-color: var(--color-background);
  color: var(--color-text);
  font-family: var(--font-body), system-ui, sans-serif;
}
```

- [ ] **Step 2: Wire fonts in `app/layout.tsx`**

```tsx
import type { Metadata } from 'next';
import { Playfair_Display, Inter } from 'next/font/google';
import './globals.css';

const playfair = Playfair_Display({
  variable: '--font-playfair',
  subsets: ['latin'],
  display: 'swap',
});

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Wedding Planner',
  description: 'AI-powered wedding planning',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="he"
      dir="rtl"
      className={`${playfair.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
```

- [ ] **Step 3: Write the failing test — `app/design-tokens.test.tsx`**

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';

describe('design tokens', () => {
  it('applies token-based utility classes to elements', () => {
    const { getByTestId } = render(
      <div
        data-testid="card"
        className="bg-surface text-text rounded-card font-display"
      >
        hello
      </div>,
    );
    const el = getByTestId('card');
    expect(el).toHaveClass('bg-surface');
    expect(el).toHaveClass('rounded-card');
    expect(el).toHaveClass('font-display');
  });
});
```

- [ ] **Step 4: Run the test**

Run: `npm test -- app/design-tokens.test.tsx`
Expected: PASS. (This asserts the classes are applied in markup; Tailwind's actual CSS generation is verified visually below.)

- [ ] **Step 5: Visually verify tokens render**

Run: `npm run dev`, open `http://localhost:3000`. Temporarily place `<div className="bg-primary text-surface rounded-card p-4 font-display">Test</div>` in `app/page.tsx`, confirm sage-green card with serif text, then revert. Stop the dev server.

- [ ] **Step 6: Commit (ask first)**

```bash
git add -A
# On approval:
git commit -m "feat: add design tokens and brand fonts"
```

---

## Task 3: Database — Docker Postgres + Prisma schema

Brings up a local Postgres, defines the Phase 1 domain models, and proves the DB layer with an integration test.

**Files:**
- Create: `docker-compose.yml`, `docker/init-test-db.sql`
- Create: `prisma/schema.prisma`
- Create: `lib/db.ts`
- Create: `.env`, `.env.test` (gitignored), append to `.gitignore`
- Create: `test/global-setup.ts`, modify `vitest.config.ts` (add globalSetup)
- Create: `lib/db.test.ts`
- Modify: `package.json` (Prisma scripts + `postinstall`)

**Interfaces:**
- Produces: `prisma` — a singleton `PrismaClient` exported from `lib/db.ts`. Models `User`, `Wedding`, `Account`, `Session`, `VerificationToken`; enum `UserRole = USER | ADMIN`.

- [ ] **Step 1: Install Prisma**

```bash
npm install -D prisma
npm install @prisma/client@6.19.3
```

**Version pin (decision):** Prisma is pinned to **6.19.3** (install `prisma@6.19.3` and `@prisma/client@6.19.3` — exact, no caret). Prisma 7 moved the datasource URL into a separate `prisma.config.ts` AND requires the new `prisma-client` generator with a custom output path (client no longer generated into `node_modules`, import paths change). We stay on the mature 6.x line for the deepest docs/community support and the standard `import { PrismaClient } from '@prisma/client'` + `url` in schema. The Prisma 7 upgrade is a deliberate future task, not part of the foundation. So Step 1 is exactly: `npm install -D prisma@6.19.3` then `npm install @prisma/client@6.19.3`. If a `^7`/`7.x` version is already present in `package.json`/`node_modules` from an earlier attempt, this reinstall must downgrade it — verify `npx prisma --version` reports 6.19.3 afterward.

- [ ] **Step 2: Create `docker-compose.yml`** (host port 5433 to avoid conflicts)

Host port **5433** maps to the container's 5432, because host 5432 is commonly taken by another local Postgres. All connection URLs below use `localhost:5433`.

```yaml
services:
  postgres:
    image: postgres:16
    container_name: wedding_pg
    restart: unless-stopped
    environment:
      POSTGRES_USER: wedding
      POSTGRES_PASSWORD: wedding
      POSTGRES_DB: wedding_dev
    ports:
      - '5433:5432'
    volumes:
      - wedding_pgdata:/var/lib/postgresql/data
      - ./docker/init-test-db.sql:/docker-entrypoint-initdb.d/init-test-db.sql

volumes:
  wedding_pgdata:
```

- [ ] **Step 3: Create `docker/init-test-db.sql`** (creates the separate test DB)

```sql
CREATE DATABASE wedding_test;
```

- [ ] **Step 4: Start Postgres**

Run: `docker compose up -d`
Verify: `docker compose ps` shows `wedding_pg` running and healthy.

- [ ] **Step 5: Create env files and gitignore them**

`.env`:
```
DATABASE_URL="postgresql://wedding:wedding@localhost:5433/wedding_dev?schema=public"
AUTH_SECRET="dev-only-secret-change-me"
```

`.env.test`:
```
DATABASE_URL="postgresql://wedding:wedding@localhost:5433/wedding_test?schema=public"
AUTH_SECRET="test-secret"
```

Append to `.gitignore` (create-next-app already ignores `.env*` — verify; if not, add):
```
.env
.env.test
.env*.local
```

- [ ] **Step 6: Create `prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

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
  passwordHash  String?
  role          UserRole  @default(USER)
  locale        String    @default("he")

  weddingId     String?
  wedding       Wedding?  @relation(fields: [weddingId], references: [id])

  accounts      Account[]
  sessions      Session[]

  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

model Wedding {
  id        String   @id @default(cuid())
  members   User[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

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

- [ ] **Step 7: Add Prisma scripts to `package.json`**

```json
"db:migrate": "prisma migrate dev",
"db:generate": "prisma generate",
"db:studio": "prisma studio",
"postinstall": "prisma generate"
```

- [ ] **Step 8: Create the first migration**

Run: `npm run db:migrate -- --name init`
Expected: migration `prisma/migrations/*_init/migration.sql` created and applied to `wedding_dev`; Prisma Client generated.

- [ ] **Step 9: Create `lib/db.ts` (singleton)**

```ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
```

- [ ] **Step 10: Create `test/global-setup.ts` (migrate the test DB once)**

The test DB URL resolves from the environment: `.env.test` locally (loaded via `dotenv`, which does NOT override already-set vars), or a pre-set `process.env.DATABASE_URL` in CI. Install `dotenv` in this task: `npm install -D dotenv`. No `dotenv-cli` needed.

```ts
import { config } from 'dotenv';
import { execSync } from 'node:child_process';

// Load .env.test locally; in CI, DATABASE_URL is already set and wins
// (dotenv does not override existing process.env values).
config({ path: '.env.test' });

export default function setup() {
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: process.env,
  });
}
```

- [ ] **Step 11: Point Vitest at the test DB and global setup**

Two changes, so both the migration (main process) and the Prisma client (worker processes) see `DATABASE_URL`, while a CI-provided `process.env.DATABASE_URL` still wins (`dotenv` does not override already-set vars). Do NOT hardcode a `DATABASE_URL` anywhere — that would break CI, which runs Postgres on port 5432.

(a) In `vitest.config.ts`, add ONLY the `globalSetup` line to the existing `test: { ... }` block — preserve the existing `plugins`, `environment`, `setupFiles`, `globals`, and `resolve.alias`:
```ts
    globalSetup: ['./test/global-setup.ts'],
```

(b) In `vitest.setup.ts` (created in Task 1), load `.env.test` so each test worker has `DATABASE_URL` before `lib/db.ts` instantiates the Prisma client. The file becomes:
```ts
import { config } from 'dotenv';
config({ path: '.env.test' });

import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 12: Write the failing test — `lib/db.test.ts`**

```ts
import { describe, it, expect, afterEach } from 'vitest';
import { prisma } from './db';

afterEach(async () => {
  await prisma.user.deleteMany();
  await prisma.wedding.deleteMany();
});

describe('database layer', () => {
  it('creates a user with the default USER role and he locale', async () => {
    const user = await prisma.user.create({
      data: { email: 'a@example.com' },
    });
    expect(user.role).toBe('USER');
    expect(user.locale).toBe('he');
  });

  it('links multiple users to one wedding (couple sharing)', async () => {
    const wedding = await prisma.wedding.create({ data: {} });
    await prisma.user.create({
      data: { email: 'partner1@example.com', weddingId: wedding.id },
    });
    await prisma.user.create({
      data: { email: 'partner2@example.com', weddingId: wedding.id },
    });

    const withMembers = await prisma.wedding.findUnique({
      where: { id: wedding.id },
      include: { members: true },
    });
    expect(withMembers?.members).toHaveLength(2);
  });
});
```

- [ ] **Step 13: Run the test**

Run: `npm test -- lib/db.test.ts`
Expected: PASS (2 tests). The global setup migrates `wedding_test` first.

- [ ] **Step 14: Commit (ask first)**

```bash
git add -A
# On approval:
git commit -m "feat: add Docker Postgres, Prisma schema, and DB integration tests"
```

---

## Task 4: Localization foundation (next-intl)

Adds locale routing, message loading, the `[locale]` layout, RTL direction, and the first localized page. Auth composition into `proxy.ts` comes in Task 8; here `proxy.ts` handles only i18n routing.

**Files:**
- Create: `lib/i18n/routing.ts`, `lib/i18n/request.ts`, `lib/i18n/navigation.ts`
- Create: `messages/he.json`, `messages/en.json`
- Create: `proxy.ts`
- Modify: `next.config.ts` (next-intl plugin)
- Create: `app/[locale]/layout.tsx`, `app/[locale]/(marketing)/page.tsx`
- Modify: `app/layout.tsx` (make root a pass-through; `<html>` moves to `[locale]/layout.tsx`)
- Delete: `app/page.tsx` (replaced by `[locale]/(marketing)/page.tsx`)
- Create: `lib/i18n/routing.test.ts`

**Interfaces:**
- Consumes: nothing from prior tasks.
- Produces: `routing` (next-intl routing config, `locales`, `defaultLocale`, `localePrefix`); locale-aware `Link`, `redirect`, `usePathname`, `useRouter` from `lib/i18n/navigation.ts`. Message key namespace `Landing` with key `title`.

- [ ] **Step 1: Install next-intl**

```bash
npm install next-intl
```

- [ ] **Step 2: Create `lib/i18n/routing.ts`**

```ts
import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['he', 'en'],
  defaultLocale: 'he',
  localePrefix: 'as-needed',
});

export type Locale = (typeof routing.locales)[number];
```

- [ ] **Step 3: Create `lib/i18n/navigation.ts`**

```ts
import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
```

- [ ] **Step 4: Create `lib/i18n/request.ts`**

```ts
import { getRequestConfig } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
```

- [ ] **Step 5: Create message files**

`messages/he.json`:
```json
{
  "Landing": {
    "title": "מהיום שהתארסתם ועד החתונה"
  }
}
```

`messages/en.json`:
```json
{
  "Landing": {
    "title": "From engaged to married"
  }
}
```

- [ ] **Step 6: Wire the next-intl plugin in `next.config.ts`**

```ts
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./lib/i18n/request.ts');

const nextConfig: NextConfig = {};

export default withNextIntl(nextConfig);
```

- [ ] **Step 7: Create `proxy.ts` (i18n only for now)**

```ts
import createMiddleware from 'next-intl/middleware';
import { routing } from './lib/i18n/routing';

export default createMiddleware(routing);

export const config = {
  matcher: '/((?!api|_next|_vercel|.*\\..*).*)',
};
```

- [ ] **Step 8: Make root `app/layout.tsx` a pass-through**

The `<html>`/`<body>` shell moves into the locale layout so `dir` and `lang` can depend on locale.

```tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Wedding Planner',
  description: 'AI-powered wedding planning',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
```

- [ ] **Step 9: Create `app/[locale]/layout.tsx`** (per-locale fonts)

**Per-locale fonts (design decision):** Playfair Display and Inter have no Hebrew glyphs, so Hebrew (the default/primary locale) uses Hebrew-capable typefaces while English keeps the Latin pair. Load all four fonts (each with its own CSS variable), then set the token variables `--font-display`/`--font-body` per locale via an inline `style` on `<html>` — the same tokens the Tailwind `font-display`/`font-body` utilities (from Task 2) resolve against. Result: `font-display`/`font-body` classes work everywhere and automatically render the right typeface for the active locale.

- Hebrew (`he`): display = **Frank Ruhl Libre**, body = **Assistant**.
- English (`en`): display = **Playfair Display**, body = **Inter**.

```tsx
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import {
  Playfair_Display,
  Inter,
  Frank_Ruhl_Libre,
  Assistant,
} from 'next/font/google';
import { routing } from '@/lib/i18n/routing';

const playfair = Playfair_Display({
  variable: '--font-playfair',
  subsets: ['latin'],
  display: 'swap',
});
const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
});
const frankRuhl = Frank_Ruhl_Libre({
  variable: '--font-frank-ruhl',
  subsets: ['hebrew', 'latin'],
  display: 'swap',
});
const assistant = Assistant({
  variable: '--font-assistant',
  subsets: ['hebrew', 'latin'],
  display: 'swap',
});

const fontVars = [
  playfair.variable,
  inter.variable,
  frankRuhl.variable,
  assistant.variable,
].join(' ');

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const dir = locale === 'he' ? 'rtl' : 'ltr';

  // Point the design tokens at the locale's typefaces.
  const localeFontVars =
    locale === 'he'
      ? {
          '--font-display': 'var(--font-frank-ruhl)',
          '--font-body': 'var(--font-assistant)',
        }
      : {
          '--font-display': 'var(--font-playfair)',
          '--font-body': 'var(--font-inter)',
        };

  return (
    <html
      lang={locale}
      dir={dir}
      className={`${fontVars} h-full antialiased`}
      style={localeFontVars as React.CSSProperties}
    >
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
```

Note: the inline `style` on `<html>` overrides the default `--font-display`/`--font-body` values set in `app/globals.css` (Task 2), so no change to `globals.css` is needed — those remain the sensible fallback.

- [ ] **Step 10: Create the localized landing page `app/[locale]/(marketing)/page.tsx`**

```tsx
import { setRequestLocale, getTranslations } from 'next-intl/server';

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Landing');

  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <h1 className="font-display text-4xl text-primary text-center">
        {t('title')}
      </h1>
    </main>
  );
}
```

- [ ] **Step 11: Delete the old root page**

Delete `app/page.tsx` (its role is now served by the localized route).

- [ ] **Step 12: Write the failing test — `lib/i18n/routing.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { routing } from './routing';

describe('i18n routing config', () => {
  it('supports he and en with he as the default', () => {
    expect(routing.locales).toEqual(['he', 'en']);
    expect(routing.defaultLocale).toBe('he');
  });

  it('keeps the default locale unprefixed', () => {
    expect(routing.localePrefix).toBe('as-needed');
  });
});
```

- [ ] **Step 13: Run the test**

Run: `npm test -- lib/i18n/routing.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 14: Verify routing end-to-end**

Run: `npm run dev`.
- `http://localhost:3000/` → Hebrew title, `<html dir="rtl" lang="he">`.
- `http://localhost:3000/en` → English title, `<html dir="ltr" lang="en">`.
Stop the dev server.

- [ ] **Step 15: Verify build + typecheck**

Run: `npm run typecheck` and `npm run build`. Expected: both succeed.

- [ ] **Step 16: Commit (ask first)**

```bash
git add -A
# On approval:
git commit -m "feat: add next-intl localization with Hebrew default and RTL"
```

---

## Task 5: Authentication — password hashing, Auth.js credentials, register

Adds password hashing, the Auth.js v5 configuration with the Prisma adapter and JWT claims, and the registration flow.

> **Version check before coding:** verify Auth.js v5 API via context7 (`/nextauthjs/next-auth` or current docs). The code below targets `next-auth@5` (beta) with `@auth/prisma-adapter`. Confirm `NextAuth()` returns `{ handlers, auth, signIn, signOut }` and callback signatures before finalizing.

**Files:**
- Create: `lib/auth/password.ts`, `lib/auth/password.test.ts`
- Create: `lib/auth/config.ts`, `lib/auth/index.ts`
- Create: `app/api/auth/[...nextauth]/route.ts`
- Create: `lib/actions/register.ts`, `lib/actions/register.test.ts`
- Create: `types/next-auth.d.ts` (augment session/JWT types)
- Modify: `.env` and `.env.test` (`AUTH_SECRET` already present from Task 3)

**Interfaces:**
- Consumes: `prisma` from `lib/db.ts`.
- Produces:
  - `hashPassword(plain: string): Promise<string>`, `verifyPassword(plain: string, hash: string): Promise<boolean>`.
  - `handlers`, `auth`, `signIn`, `signOut` from `lib/auth/index.ts`.
  - `registerUser(input: { email: string; password: string; name?: string }): Promise<{ ok: true } | { ok: false; error: 'EMAIL_TAKEN' | 'INVALID' }>` from `lib/actions/register.ts`.
  - JWT/session shape: `session.user.id: string`, `session.user.role: 'USER' | 'ADMIN'`, `session.user.weddingId: string | null`.

- [ ] **Step 1: Install auth dependencies**

```bash
npm install next-auth@beta @auth/prisma-adapter bcryptjs zod
npm install -D @types/bcryptjs
```

- [ ] **Step 2: Write the failing test — `lib/auth/password.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from './password';

describe('password hashing', () => {
  it('produces a hash different from the plaintext', async () => {
    const hash = await hashPassword('correct horse battery');
    expect(hash).not.toBe('correct horse battery');
    expect(hash.length).toBeGreaterThan(20);
  });

  it('verifies a correct password', async () => {
    const hash = await hashPassword('s3cret!');
    expect(await verifyPassword('s3cret!', hash)).toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('s3cret!');
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test -- lib/auth/password.test.ts`
Expected: FAIL — cannot resolve `./password`.

- [ ] **Step 4: Implement `lib/auth/password.ts`**

```ts
import bcrypt from 'bcryptjs';

const ROUNDS = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- lib/auth/password.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Augment Auth.js types — `types/next-auth.d.ts`**

```ts
import type { UserRole } from '@prisma/client';
import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      weddingId: string | null;
      email: string;
      name?: string | null;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: UserRole;
    weddingId: string | null;
  }
}
```

- [ ] **Step 7: Create `lib/auth/config.ts`**

```ts
import type { NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { verifyPassword } from './password';

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const authConfig: NextAuthConfig = {
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      // No allowDangerousEmailAccountLinking: we do not auto-link a Google
      // sign-in to an existing credentials account with the same email,
      // because credentials emails are not verified yet — auto-linking would
      // be an account-takeover vector. Verified account linking is a later task.
    }),
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
        });
        if (!user?.passwordHash) return null;

        const ok = await verifyPassword(parsed.data.password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          weddingId: user.weddingId,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = (user as { role: 'USER' | 'ADMIN' }).role;
        token.weddingId = (user as { weddingId: string | null }).weddingId;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      session.user.weddingId = token.weddingId;
      return session;
    },
  },
};
```

- [ ] **Step 8: Create `lib/auth/index.ts`**

```ts
import NextAuth from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '@/lib/db';
import { authConfig } from './config';

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  ...authConfig,
});
```

- [ ] **Step 9: Create the route handler `app/api/auth/[...nextauth]/route.ts`**

```ts
import { handlers } from '@/lib/auth';

export const { GET, POST } = handlers;
```

- [ ] **Step 10: Write the failing test — `lib/actions/register.test.ts`**

```ts
import { describe, it, expect, afterEach } from 'vitest';
import { prisma } from '@/lib/db';
import { verifyPassword } from '@/lib/auth/password';
import { registerUser } from './register';

afterEach(async () => {
  await prisma.user.deleteMany();
});

describe('registerUser', () => {
  it('creates a USER with a hashed password', async () => {
    const result = await registerUser({
      email: 'new@example.com',
      password: 'pw12345678',
      name: 'New Person',
    });
    expect(result.ok).toBe(true);

    const user = await prisma.user.findUnique({
      where: { email: 'new@example.com' },
    });
    expect(user?.role).toBe('USER');
    expect(user?.passwordHash).toBeTruthy();
    expect(await verifyPassword('pw12345678', user!.passwordHash!)).toBe(true);
  });

  it('rejects a duplicate email', async () => {
    await registerUser({ email: 'dupe@example.com', password: 'pw12345678' });
    const result = await registerUser({
      email: 'dupe@example.com',
      password: 'pw12345678',
    });
    expect(result).toEqual({ ok: false, error: 'EMAIL_TAKEN' });
  });

  it('rejects an invalid input', async () => {
    const result = await registerUser({ email: 'not-an-email', password: 'x' });
    expect(result).toEqual({ ok: false, error: 'INVALID' });
  });
});
```

- [ ] **Step 11: Run the test to verify it fails**

Run: `npm test -- lib/actions/register.test.ts`
Expected: FAIL — cannot resolve `./register`.

- [ ] **Step 12: Implement `lib/actions/register.ts`**

```ts
'use server';

import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/auth/password';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).optional(),
});

type RegisterResult =
  | { ok: true }
  | { ok: false; error: 'EMAIL_TAKEN' | 'INVALID' };

export async function registerUser(input: {
  email: string;
  password: string;
  name?: string;
}): Promise<RegisterResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'INVALID' };

  const existing = await prisma.user.findUnique({
    where: { email: parsed.data.email },
  });
  if (existing) return { ok: false, error: 'EMAIL_TAKEN' };

  try {
    await prisma.user.create({
      data: {
        email: parsed.data.email,
        name: parsed.data.name,
        passwordHash: await hashPassword(parsed.data.password),
      },
    });
  } catch (err) {
    // Race-safe backstop: a concurrent registration with the same email can
    // slip past the pre-check above and hit the unique constraint (P2002).
    // Map it to the same contract value instead of throwing.
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      return { ok: false, error: 'EMAIL_TAKEN' };
    }
    throw err;
  }

  return { ok: true };
}
```

- [ ] **Step 13: Run the test to verify it passes**

Run: `npm test -- lib/actions/register.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 14: Run full typecheck**

Run: `npm run typecheck`
Expected: no errors (confirms the type augmentation resolves).

- [ ] **Step 15: Commit (ask first)**

```bash
git add -A
# On approval:
git commit -m "feat: add Auth.js credentials auth, password hashing, and registration"
```

---

## Task 6: Google OAuth provider (scaffold)

The Google provider is already added in `lib/auth/config.ts` (Task 5). This task documents the env contract and adds the placeholder variables so the provider initializes without crashing when keys are absent.

**Files:**
- Modify: `.env`, `.env.test` (placeholders)
- Create: `lib/auth/config.google.test.ts`

**Interfaces:**
- Consumes: `authConfig` from `lib/auth/config.ts`.
- Produces: documented env vars `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.

- [ ] **Step 1: Add placeholder env vars**

Append to `.env` and `.env.test`:
```
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
```

- [ ] **Step 2: Write the test — `lib/auth/config.google.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { authConfig } from './config';

describe('auth providers', () => {
  it('registers both Google and Credentials providers', () => {
    const ids = authConfig.providers.map((p) =>
      typeof p === 'function' ? p().id : p.id,
    );
    expect(ids).toContain('google');
    expect(ids).toContain('credentials');
  });
});
```

- [ ] **Step 3: Run the test**

Run: `npm test -- lib/auth/config.google.test.ts`
Expected: PASS. If a provider entry is a function, the `p()` call resolves its id; adjust the accessor if the installed version exposes `.id` directly (verify via context7).

- [ ] **Step 4: Document the setup steps for later**

Add a note to `.env.example` (created in Task 10) — captured here so it isn't forgotten: Google credentials come from Google Cloud Console → APIs & Services → Credentials → OAuth client ID (Web), with authorized redirect URI `http://localhost:3000/api/auth/callback/google` for dev.

- [ ] **Step 5: Commit (ask first)**

```bash
git add -A
# On approval:
git commit -m "feat: scaffold Google OAuth provider with placeholder credentials"
```

---

## Task 7: Password reset via Resend

Adds forgot/reset-password server actions using the `VerificationToken` table, with email delivery through Resend (mocked in tests).

**Files:**
- Create: `lib/email/resend.ts`
- Create: `lib/actions/reset-password.ts`, `lib/actions/reset-password.test.ts`
- Modify: `.env`, `.env.test` (`RESEND_API_KEY`, `EMAIL_FROM`, `APP_URL`)

**Interfaces:**
- Consumes: `prisma`, `hashPassword`.
- Produces:
  - `sendPasswordResetEmail(to: string, resetUrl: string): Promise<void>` from `lib/email/resend.ts`.
  - `requestPasswordReset(email: string): Promise<{ ok: true }>` (always returns ok — no user enumeration).
  - `performPasswordReset(input: { token: string; password: string }): Promise<{ ok: true } | { ok: false; error: 'INVALID_TOKEN' | 'EXPIRED' | 'INVALID' }>`.

- [ ] **Step 1: Install Resend**

```bash
npm install resend
```

- [ ] **Step 2: Add env vars**

Append to `.env` and `.env.test`:
```
RESEND_API_KEY=""
EMAIL_FROM="Wedding Planner <noreply@example.com>"
APP_URL="http://localhost:3000"
```

- [ ] **Step 3: Create `lib/email/resend.ts`**

```ts
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string,
): Promise<void> {
  // Resend returns API-level failures in `error` rather than throwing.
  // Surface them so the caller can log/handle rather than silently no-op.
  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to,
    subject: 'Reset your password',
    html: `<p>Reset your password by clicking <a href="${resetUrl}">here</a>. This link expires in 1 hour.</p>`,
  });
  if (error) {
    throw new Error(`Resend failed to send reset email: ${error.message}`);
  }
}
```

- [ ] **Step 4: Write the failing test — `lib/actions/reset-password.test.ts`**

Resend is mocked so no network call happens.

```ts
import { describe, it, expect, afterEach, vi } from 'vitest';
import { prisma } from '@/lib/db';
import { verifyPassword } from '@/lib/auth/password';

vi.mock('@/lib/email/resend', () => ({
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));

import { sendPasswordResetEmail } from '@/lib/email/resend';
import {
  requestPasswordReset,
  performPasswordReset,
} from './reset-password';

afterEach(async () => {
  await prisma.verificationToken.deleteMany();
  await prisma.user.deleteMany();
  vi.clearAllMocks();
});

describe('password reset', () => {
  it('sends a reset email and stores a token for an existing user', async () => {
    await prisma.user.create({
      data: { email: 'reset@example.com', passwordHash: 'x' },
    });

    const result = await requestPasswordReset('reset@example.com');
    expect(result).toEqual({ ok: true });
    expect(sendPasswordResetEmail).toHaveBeenCalledOnce();

    const tokens = await prisma.verificationToken.findMany({
      where: { identifier: 'reset@example.com' },
    });
    expect(tokens).toHaveLength(1);
  });

  it('returns ok but sends nothing for an unknown email (no enumeration)', async () => {
    const result = await requestPasswordReset('ghost@example.com');
    expect(result).toEqual({ ok: true });
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('resets the password with a valid token and consumes it', async () => {
    const user = await prisma.user.create({
      data: { email: 'reset2@example.com', passwordHash: 'old' },
    });
    await requestPasswordReset('reset2@example.com');
    const token = (
      await prisma.verificationToken.findFirst({
        where: { identifier: 'reset2@example.com' },
      })
    )!.token;

    const result = await performPasswordReset({
      token,
      password: 'brandNewPw123',
    });
    expect(result).toEqual({ ok: true });

    const updated = await prisma.user.findUnique({ where: { id: user.id } });
    expect(await verifyPassword('brandNewPw123', updated!.passwordHash!)).toBe(
      true,
    );

    const remaining = await prisma.verificationToken.findMany({
      where: { identifier: 'reset2@example.com' },
    });
    expect(remaining).toHaveLength(0);
  });

  it('rejects an unknown token', async () => {
    const result = await performPasswordReset({
      token: 'does-not-exist',
      password: 'brandNewPw123',
    });
    expect(result).toEqual({ ok: false, error: 'INVALID_TOKEN' });
  });
});
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `npm test -- lib/actions/reset-password.test.ts`
Expected: FAIL — cannot resolve `./reset-password`.

- [ ] **Step 6: Implement `lib/actions/reset-password.ts`**

```ts
'use server';

import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/auth/password';
import { sendPasswordResetEmail } from '@/lib/email/resend';

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function requestPasswordReset(
  email: string,
): Promise<{ ok: true }> {
  const user = await prisma.user.findUnique({ where: { email } });

  // Always return ok to avoid leaking which emails are registered.
  if (!user) return { ok: true };

  const token = randomBytes(32).toString('hex');
  await prisma.verificationToken.create({
    data: {
      identifier: email,
      token,
      expires: new Date(Date.now() + TOKEN_TTL_MS),
    },
  });

  const resetUrl = `${process.env.APP_URL}/reset-password?token=${token}`;

  // Never let an email failure change the caller-visible outcome: the action
  // must always return { ok: true } (both for the no-enumeration guarantee and
  // so a transient send failure doesn't surface as a thrown error). Log for
  // observability. NOTE (follow-up): the awaited send still makes the
  // user-exists path measurably slower than the user-missing path — a residual
  // timing side-channel on enumeration. The proper fix is to move email
  // delivery onto the Inngest background queue (wired in Task 9, functions in a
  // later phase) so the action just enqueues and returns immediately on both
  // paths, also gaining retries. Deferred deliberately, not overlooked.
  try {
    await sendPasswordResetEmail(email, resetUrl);
  } catch (err) {
    console.error('[password-reset] email send failed', err);
  }

  return { ok: true };
}

const resetSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});

type ResetResult =
  | { ok: true }
  | { ok: false; error: 'INVALID_TOKEN' | 'EXPIRED' | 'INVALID' };

export async function performPasswordReset(input: {
  token: string;
  password: string;
}): Promise<ResetResult> {
  const parsed = resetSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'INVALID' };

  const record = await prisma.verificationToken.findUnique({
    where: { token: parsed.data.token },
  });
  if (!record) return { ok: false, error: 'INVALID_TOKEN' };

  if (record.expires < new Date()) {
    await prisma.verificationToken.delete({
      where: { token: parsed.data.token },
    });
    return { ok: false, error: 'EXPIRED' };
  }

  await prisma.user.update({
    where: { email: record.identifier },
    data: { passwordHash: await hashPassword(parsed.data.password) },
  });

  // Consume all outstanding tokens for this identifier.
  await prisma.verificationToken.deleteMany({
    where: { identifier: record.identifier },
  });

  return { ok: true };
}
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `npm test -- lib/actions/reset-password.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 8: Commit (ask first)**

```bash
git add -A
# On approval:
git commit -m "feat: add password reset flow with Resend email"
```

---

## Task 8: Route protection (compose auth into proxy.ts)

Extends `proxy.ts` to run auth checks alongside next-intl routing. The authorization *decision* is a pure function (unit-tested); `proxy.ts` is the thin adapter that reads the session and applies it.

> **Version check before coding:** confirm how to read the Auth.js v5 session/token inside a proxy/middleware for `next-auth@beta` (the `auth((req) => …)` wrapper vs. `getToken`). The pure decision function below is framework-independent; wire it to whichever session-read the installed version supports.

**Files:**
- Create: `lib/auth/authorize.ts`, `lib/auth/authorize.test.ts`
- Modify: `proxy.ts` (compose i18n + auth)
- Create: `app/[locale]/(app)/dashboard/page.tsx`, `app/[locale]/admin/page.tsx` (placeholders to protect)

**Interfaces:**
- Consumes: `routing` from `lib/i18n/routing.ts`.
- Produces: `authorizeRoute(input: { pathname: string; isLoggedIn: boolean; role: 'USER' | 'ADMIN' | null }): { type: 'next' } | { type: 'redirect'; to: string }` from `lib/auth/authorize.ts`.

- [ ] **Step 1: Write the failing test — `lib/auth/authorize.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { authorizeRoute } from './authorize';

describe('authorizeRoute', () => {
  it('allows a logged-out user to view marketing pages', () => {
    expect(
      authorizeRoute({ pathname: '/', isLoggedIn: false, role: null }),
    ).toEqual({ type: 'next' });
  });

  it('redirects a logged-out user away from the app area to login', () => {
    expect(
      authorizeRoute({
        pathname: '/dashboard',
        isLoggedIn: false,
        role: null,
      }),
    ).toEqual({ type: 'redirect', to: '/login' });
  });

  it('handles the en-prefixed app area too', () => {
    expect(
      authorizeRoute({
        pathname: '/en/dashboard',
        isLoggedIn: false,
        role: null,
      }),
    ).toEqual({ type: 'redirect', to: '/en/login' });
  });

  it('allows a logged-in USER into the app area', () => {
    expect(
      authorizeRoute({
        pathname: '/dashboard',
        isLoggedIn: true,
        role: 'USER',
      }),
    ).toEqual({ type: 'next' });
  });

  it('blocks a non-admin from the admin area', () => {
    expect(
      authorizeRoute({ pathname: '/admin', isLoggedIn: true, role: 'USER' }),
    ).toEqual({ type: 'redirect', to: '/dashboard' });
  });

  it('allows an ADMIN into the admin area', () => {
    expect(
      authorizeRoute({ pathname: '/admin', isLoggedIn: true, role: 'ADMIN' }),
    ).toEqual({ type: 'next' });
  });

  it('redirects an already-logged-in user away from auth pages', () => {
    expect(
      authorizeRoute({ pathname: '/login', isLoggedIn: true, role: 'USER' }),
    ).toEqual({ type: 'redirect', to: '/dashboard' });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- lib/auth/authorize.test.ts`
Expected: FAIL — cannot resolve `./authorize`.

- [ ] **Step 3: Implement `lib/auth/authorize.ts`**

```ts
type Role = 'USER' | 'ADMIN' | null;

type Decision =
  | { type: 'next' }
  | { type: 'redirect'; to: string };

const APP_PREFIXES = ['/dashboard'];
const ADMIN_PREFIXES = ['/admin'];
const AUTH_PREFIXES = ['/login', '/register', '/forgot-password', '/reset-password'];

/**
 * Strips a leading `/en` locale prefix (Hebrew is unprefixed).
 * Returns the locale segment (or '' for default) and the remaining path.
 */
function splitLocale(pathname: string): { localePrefix: string; rest: string } {
  const match = pathname.match(/^\/(en)(?=\/|$)/);
  if (match) {
    const rest = pathname.slice(match[0].length) || '/';
    return { localePrefix: `/${match[1]}`, rest };
  }
  return { localePrefix: '', rest: pathname || '/' };
}

function startsWithAny(path: string, prefixes: string[]): boolean {
  return prefixes.some((p) => path === p || path.startsWith(`${p}/`));
}

export function authorizeRoute(input: {
  pathname: string;
  isLoggedIn: boolean;
  role: Role;
}): Decision {
  const { localePrefix, rest } = splitLocale(input.pathname);
  const to = (path: string) => `${localePrefix}${path}`;

  if (startsWithAny(rest, ADMIN_PREFIXES)) {
    if (!input.isLoggedIn) return { type: 'redirect', to: to('/login') };
    if (input.role !== 'ADMIN') return { type: 'redirect', to: to('/dashboard') };
    return { type: 'next' };
  }

  if (startsWithAny(rest, APP_PREFIXES)) {
    if (!input.isLoggedIn) return { type: 'redirect', to: to('/login') };
    return { type: 'next' };
  }

  if (startsWithAny(rest, AUTH_PREFIXES)) {
    if (input.isLoggedIn) return { type: 'redirect', to: to('/dashboard') };
    return { type: 'next' };
  }

  return { type: 'next' };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- lib/auth/authorize.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Compose auth into `proxy.ts`**

```ts
import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { routing } from './lib/i18n/routing';
import { authorizeRoute } from './lib/auth/authorize';

const handleI18n = createMiddleware(routing);

export default async function proxy(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
  });

  const decision = authorizeRoute({
    pathname: request.nextUrl.pathname,
    isLoggedIn: Boolean(token),
    role: (token?.role as 'USER' | 'ADMIN' | undefined) ?? null,
  });

  if (decision.type === 'redirect') {
    return NextResponse.redirect(new URL(decision.to, request.url));
  }

  return handleI18n(request);
}

export const config = {
  matcher: '/((?!api|_next|_vercel|.*\\..*).*)',
};
```

- [ ] **Step 6: Create placeholder protected pages**

`app/[locale]/(app)/dashboard/page.tsx`:
```tsx
import { setRequestLocale } from 'next-intl/server';

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <main className="p-8">Dashboard (protected)</main>;
}
```

`app/[locale]/admin/page.tsx`:
```tsx
import { setRequestLocale } from 'next-intl/server';

export default async function AdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <main className="p-8">Admin (ADMIN only)</main>;
}
```

- [ ] **Step 7: Manual verification of protection**

Run: `npm run dev`.
- Visit `/dashboard` while logged out → redirected to `/login`.
- Visit `/admin` while logged out → redirected to `/login`.
- (Full logged-in/admin checks are exercised by the e2e task below once a user can be seeded.)
Stop the dev server.

- [ ] **Step 8: Commit (ask first)**

```bash
git add -A
# On approval:
git commit -m "feat: add route authorization and compose it into proxy.ts"
```

---

## Task 9: Inngest + Sentry wiring (dormant)

Reserves the background-jobs and error-tracking integration points so later phases don't retrofit them. No functions, no live DSN required.

> **Version check before coding:** confirm the current Next.js 16 Sentry setup (it uses `instrumentation.ts` + `instrumentation-client.ts` and `withSentryConfig`) and the Inngest `serve` signature via context7 (`/getsentry/sentry-docs`, `/inngest/inngest-js`).

**Files:**
- Create: `lib/inngest/client.ts`, `app/api/inngest/route.ts`
- Create: `sentry.server.config.ts`, `sentry.edge.config.ts`, `instrumentation.ts`, `instrumentation-client.ts`
- Modify: `next.config.ts` (wrap with `withSentryConfig`)
- Modify: `.env`, `.env.test` (`SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`)
- Create: `app/api/inngest/route.test.ts`

**Interfaces:**
- Produces: `inngest` client (`lib/inngest/client.ts`); `GET/POST/PUT` handlers at `/api/inngest`.

- [ ] **Step 1: Install SDKs**

```bash
npm install inngest @sentry/nextjs
```

- [ ] **Step 2: Create `lib/inngest/client.ts`**

```ts
import { Inngest } from 'inngest';

export const inngest = new Inngest({ id: 'wedding-planner' });
```

- [ ] **Step 3: Create `app/api/inngest/route.ts` (no functions yet)**

```ts
import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest/client';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [], // populated in Phase 10
});
```

- [ ] **Step 4: Write the test — `app/api/inngest/route.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { GET } from './route';

describe('inngest endpoint', () => {
  it('exposes a GET handler', () => {
    expect(typeof GET).toBe('function');
  });
});
```

Run: `npm test -- app/api/inngest/route.test.ts` → Expected: PASS.

- [ ] **Step 5: Add Sentry env vars**

Append to `.env` and `.env.test`:
```
SENTRY_DSN=""
NEXT_PUBLIC_SENTRY_DSN=""
```

- [ ] **Step 6: Create Sentry config files**

`sentry.server.config.ts`:
```ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 1.0,
  enabled: Boolean(process.env.SENTRY_DSN),
});
```

`sentry.edge.config.ts`:
```ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 1.0,
  enabled: Boolean(process.env.SENTRY_DSN),
});
```

`instrumentation.ts`:
```ts
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}
```

`instrumentation-client.ts`:
```ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1.0,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
});
```

- [ ] **Step 7: Wrap `next.config.ts` with Sentry**

Keep the next-intl wrapping from Task 4 and nest Sentry around it:

```ts
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import { withSentryConfig } from '@sentry/nextjs';

const withNextIntl = createNextIntlPlugin('./lib/i18n/request.ts');

const nextConfig: NextConfig = {};

export default withSentryConfig(withNextIntl(nextConfig), {
  silent: true,
  // org/project are only needed for source-map upload at deploy time.
});
```

- [ ] **Step 8: Verify build succeeds with empty DSN**

Run: `npm run build`
Expected: build succeeds; Sentry is disabled (no DSN) without error.

- [ ] **Step 9: Commit (ask first)**

```bash
git add -A
# On approval:
git commit -m "chore: wire Inngest and Sentry integration points (dormant)"
```

---

## Task 10: CI, no-hardcoded-strings lint rule, and .env.example

Closes out the foundation with the merge-gating CI pipeline, the i18n lint guardrail, and complete env documentation.

**Files:**
- Create: `.github/workflows/ci.yml`
- Modify: `eslint.config.mjs` (no literal JSX strings)
- Create: `.env.example`
- Create: `playwright.config.ts`, `e2e/auth.spec.ts` (critical-flow smoke)
- Modify: `package.json` (Playwright script)

**Interfaces:**
- Consumes: all prior tasks (CI runs their tests).
- Produces: CI workflow; `.env.example` contract; `npm run test:e2e` script.

- [ ] **Step 1: Add the no-hardcoded-strings rule to `eslint.config.mjs`**

Add the `react/jsx-no-literals` rule (ships with `eslint-plugin-react`, already a transitive dep of `eslint-config-next`; if not resolvable, `npm install -D eslint-plugin-react`):

```js
import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ['app/**/*.tsx'],
    rules: {
      'react/jsx-no-literals': [
        'warn',
        { noStrings: true, ignoreProps: true, allowedStrings: ['·', '—', '/'] },
      ],
    },
  },
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts']),
]);

export default eslintConfig;
```

- [ ] **Step 2: Verify the rule flags a raw string**

Temporarily add `<p>Raw untranslated text</p>` to `app/[locale]/(marketing)/page.tsx`.
Run: `npm run lint`
Expected: a `react/jsx-no-literals` warning on that line. Remove the temporary text and re-run to confirm it clears.

- [ ] **Step 3: Create `.env.example`**

```
# Database (local dev: Docker Postgres; production: Neon connection string)
DATABASE_URL="postgresql://wedding:wedding@localhost:5432/wedding_dev?schema=public"

# Auth.js — generate with: openssl rand -base64 32
AUTH_SECRET=""

# Google OAuth (Google Cloud Console → Credentials → OAuth client ID, Web)
# Dev redirect URI: http://localhost:3000/api/auth/callback/google
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

# Resend (transactional email)
RESEND_API_KEY=""
EMAIL_FROM="Wedding Planner <noreply@example.com>"

# App base URL (used to build password-reset links)
APP_URL="http://localhost:3000"

# Sentry (error tracking)
SENTRY_DSN=""
NEXT_PUBLIC_SENTRY_DSN=""
```

- [ ] **Step 4: Install and configure Playwright**

```bash
npm install -D @playwright/test
npx playwright install --with-deps chromium
```

Add to `package.json` scripts:
```json
"test:e2e": "playwright test"
```

Create `playwright.config.ts`:
```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://localhost:3000' },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

- [ ] **Step 5: Write the e2e smoke test — `e2e/auth.spec.ts`**

```ts
import { test, expect } from '@playwright/test';

test('landing page renders in Hebrew by default (RTL)', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'he');
});

test('english route renders LTR', async ({ page }) => {
  await page.goto('/en');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
});

test('protected dashboard redirects logged-out users to login', async ({
  page,
}) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login/);
});
```

- [ ] **Step 6: Run the e2e suite locally**

Run: `npm run test:e2e`
Expected: 3 passing tests (Playwright boots the dev server against local Docker Postgres).

- [ ] **Step 7: Create `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

jobs:
  verify:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: wedding
          POSTGRES_PASSWORD: wedding
          POSTGRES_DB: wedding_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    env:
      DATABASE_URL: postgresql://wedding:wedding@localhost:5432/wedding_test?schema=public
      AUTH_SECRET: ci-secret
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npx prisma migrate deploy
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test
```

Note: `.env.test` is gitignored, so CI provides `DATABASE_URL` via the `env:` block above. The Vitest `env.DATABASE_URL` in `vitest.config.ts` points at localhost:5432/wedding_test, which matches the CI service — consistent for both local and CI.

- [ ] **Step 8: Validate the workflow file**

Confirm YAML is well-formed (e.g. `npx yaml-lint .github/workflows/ci.yml` or visual review). The true test is CI running on the first pushed PR.

- [ ] **Step 9: Final full-suite verification**

Run all gates locally as CI would:
```bash
npm run lint && npm run typecheck && npm test
```
Expected: all pass.

- [ ] **Step 10: Commit (ask first)**

```bash
git add -A
# On approval:
git commit -m "ci: add GitHub Actions pipeline, i18n lint rule, env docs, and e2e smoke tests"
```

---

## Task 11: Auth UI pages + enforce the no-hard-coded-strings gate

Added after the final whole-branch review: Tasks 5–8 built the auth *logic* (register/login/reset server-side + route protection) but no UI pages, so `proxy.ts` redirects and `pages.signIn: '/login'` currently point at non-existent routes (404). This task adds minimal, on-brand, localized auth pages wired to the existing server actions, and makes the `no-hard-coded-strings` lint rule actually gate CI (it was `warn` and unenforced).

**Files:**
- Create: `app/[locale]/(auth)/login/page.tsx`, `app/[locale]/(auth)/login/login-form.tsx`
- Create: `app/[locale]/(auth)/register/page.tsx`, `app/[locale]/(auth)/register/register-form.tsx`
- Create: `app/[locale]/(auth)/forgot-password/page.tsx`, `app/[locale]/(auth)/forgot-password/forgot-form.tsx`
- Create: `app/[locale]/(auth)/reset-password/page.tsx`, `app/[locale]/(auth)/reset-password/reset-form.tsx`
- Modify: `messages/he.json`, `messages/en.json` (add `Auth`, `Dashboard`, `Admin` namespaces)
- Modify: `app/[locale]/(app)/dashboard/page.tsx`, `app/[locale]/admin/page.tsx` (localize the placeholder strings)
- Modify: `eslint.config.mjs` (rule → `error`; exclude test files), `package.json` (lint script `--max-warnings 0`)
- Modify: `e2e/auth.spec.ts` (assert `/login` renders a form, not just that the URL matches)

**Interfaces:**
- Consumes: `registerUser` (`lib/actions/register.ts`), `requestPasswordReset` / `performPasswordReset` (`lib/actions/reset-password.ts`), and Auth.js `signIn` — server pages are Server Components; the interactive forms are Client Components (`'use client'`).

**Design:** Use the established design tokens and Tailwind logical properties (`ps-*`/`pe-*`/`text-start`, never `pl-*`/`text-left`). Centered card (`bg-surface rounded-card`) on the `bg-background` page, serif `font-display` heading, `font-body` inputs. Keep it simple and elegant — this is a foundation, not the final polished design. All visible text via `next-intl` (`useTranslations('Auth')` in client components, `getTranslations` in server components). No raw string literals in JSX.

> **Version check before coding:** verify the Auth.js v5 client sign-in API via context7 (`/nextauthjs/next-auth`). For `next-auth@5.0.0-beta.31`, client components import `signIn`/`signOut` from `next-auth/react`; `signIn('credentials', { email, password, redirectTo })` and `signIn('google', { redirectTo })`. Confirm the import path and the `redirectTo` option name against the installed version before finalizing.

- [ ] **Step 1: Add message keys** to `messages/he.json` and `messages/en.json`

Add these namespaces (Hebrew values should be natural Hebrew; English as shown). Keep keys identical across both files:

```
"Auth": {
  "loginTitle": "Welcome back",
  "registerTitle": "Create your account",
  "forgotTitle": "Reset your password",
  "resetTitle": "Choose a new password",
  "nameLabel": "Name",
  "emailLabel": "Email",
  "passwordLabel": "Password",
  "signInButton": "Sign in",
  "signUpButton": "Create account",
  "googleButton": "Continue with Google",
  "sendResetButton": "Send reset link",
  "setPasswordButton": "Update password",
  "toRegister": "Don't have an account? Sign up",
  "toLogin": "Already have an account? Sign in",
  "forgotLink": "Forgot your password?",
  "invalidCredentials": "Incorrect email or password",
  "emailTaken": "That email is already registered",
  "invalidInput": "Please check the details and try again",
  "resetEmailSent": "If that email is registered, a reset link is on its way.",
  "resetSuccess": "Your password has been updated. You can sign in now.",
  "invalidToken": "This reset link is invalid or has already been used.",
  "expiredToken": "This reset link has expired. Request a new one."
},
"Dashboard": { "placeholder": "Dashboard (protected)" },
"Admin": { "placeholder": "Admin area (admins only)" }
```

Provide natural Hebrew translations for every value above in `he.json` (e.g. `emailLabel` → `"אימייל"`, `passwordLabel` → `"סיסמה"`, `signInButton` → `"התחברות"`, etc.).

- [ ] **Step 2: Localize the placeholder pages**

`app/[locale]/(app)/dashboard/page.tsx` — replace the hard-coded `Dashboard (protected)` with a translated string:
```tsx
import { setRequestLocale, getTranslations } from 'next-intl/server';

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Dashboard');
  return <main className="p-8">{t('placeholder')}</main>;
}
```

`app/[locale]/admin/page.tsx` — same pattern with `getTranslations('Admin')` and `t('placeholder')`.

- [ ] **Step 3: Login page + form**

`app/[locale]/(auth)/login/page.tsx` (Server Component):
```tsx
import { setRequestLocale } from 'next-intl/server';
import { LoginForm } from './login-form';

export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <LoginForm />
    </main>
  );
}
```

`app/[locale]/(auth)/login/login-form.tsx` (Client Component) — a card with email/password inputs and a Google button. On submit, call `signIn('credentials', { email, password, redirect: false })` (verify the exact option name/return for beta.31); on `result?.error`, show `t('invalidCredentials')`; on success, navigate to `/dashboard` via the locale-aware router (`useRouter` from `@/lib/i18n/navigation`). The Google button calls `signIn('google', { callbackUrl: '/dashboard' })` (verify option name). All labels via `useTranslations('Auth')`. Use design tokens + logical properties. Include the `forgotLink` (to `/forgot-password`) and `toRegister` (to `/register`) links using the locale-aware `Link` from `@/lib/i18n/navigation`.

- [ ] **Step 4: Register page + form**

`app/[locale]/(auth)/register/page.tsx` mirrors the login page (renders `<RegisterForm />`). `register-form.tsx` (Client Component): name/email/password inputs; on submit call the `registerUser` server action; on `{ok:false, error:'EMAIL_TAKEN'}` show `t('emailTaken')`, on `'INVALID'` show `t('invalidInput')`; on `{ok:true}` immediately `signIn('credentials', { email, password, redirect: false })` then navigate to `/dashboard`. Include `toLogin` link. Same styling rules.

- [ ] **Step 5: Forgot-password page + form**

`forgot-password/page.tsx` renders `<ForgotForm />`. `forgot-form.tsx` (Client Component): a single email input; on submit call `requestPasswordReset(email)`; always show the neutral `t('resetEmailSent')` message afterward (preserve the no-enumeration guarantee — do not reveal whether the email exists). Include `toLogin` link.

- [ ] **Step 6: Reset-password page + form**

`reset-password/page.tsx` reads the token from `searchParams` and passes it to `<ResetForm token={...} />`:
```tsx
import { setRequestLocale } from 'next-intl/server';
import { ResetForm } from './reset-form';

export default async function ResetPasswordPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { token } = await searchParams;
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <ResetForm token={token ?? ''} />
    </main>
  );
}
```

`reset-form.tsx` (Client Component): a new-password input; on submit call `performPasswordReset({ token, password })`; map results to messages — `INVALID_TOKEN`→`t('invalidToken')`, `EXPIRED`→`t('expiredToken')`, `INVALID`→`t('invalidInput')`, `{ok:true}`→show `t('resetSuccess')` and a link to `/login`.

- [ ] **Step 7: Enforce the lint gate**

In `eslint.config.mjs`, change the `react/jsx-no-literals` rule from `'warn'` to `'error'`, and scope its `files` to exclude tests, e.g. `files: ['app/**/*.tsx'], ignores: ['**/*.test.tsx']` (or add a separate override turning the rule off for `**/*.test.tsx`). In `package.json`, change the lint script to `"lint": "eslint --max-warnings 0"`. After this, every `app/` page must be free of raw JSX string literals — the pages built in this task and the now-localized placeholders must all pass.

- [ ] **Step 8: Verify the rule now gates**

Temporarily add `<p>raw</p>` to `login-form.tsx`, run `npm run lint`, confirm it now FAILS (exit non-zero, `error` not `warn`). Remove it and confirm clean.

- [ ] **Step 9: Strengthen the e2e for the redirect target**

In `e2e/auth.spec.ts`, update the dashboard-redirect test (or add one) to assert `/login` actually renders — e.g. after redirect, assert a visible email input / sign-in control exists, so the test can no longer pass against a 404:
```ts
test('protected dashboard redirects logged-out users to a real login page', async ({
  page,
}) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByLabel(/email|אימייל/i)).toBeVisible();
});
```

- [ ] **Step 10: Full verification**

- `npm run typecheck` clean.
- `npm run lint` passes (now `--max-warnings 0`, rule at `error`) — proves no hard-coded strings remain in `app/`.
- `npm test` — full unit suite still passes.
- `npm run test:e2e` — all e2e pass, including the strengthened login-renders assertion (Docker Postgres up on 5433, port 3000 free).
- Manually (dev server): register a new user → auto sign-in → lands on `/dashboard`; sign out; sign in again; visit `/forgot-password` (neutral message shows). Confirm Hebrew (`/`) and English (`/en`) both render the forms correctly with RTL/LTR.

- [ ] **Step 11: Commit**

```bash
git add -A
# On approval:
git commit -m "feat: add localized auth UI pages and enforce no-hard-coded-strings lint gate"
```

---

## Self-Review

**Spec coverage check (each spec section → task):**
- Architecture (Next.js monolith) → Tasks 1–10 collectively; monolith structure in File Structure + Task 4/8.
- Tech stack table (Postgres/Prisma, Auth.js, next-intl, Resend, Inngest, Sentry, Vercel, Vitest/Playwright, GitHub Actions) → Tasks 3, 5, 4, 7, 9, 9, (Vercel = deploy-time, no code), 1/10, 10.
- Project structure (route groups, lib/, proxy.ts) → File Structure + Tasks 4, 8.
- Design tokens → Task 2.
- Wedding ownership model (many users per wedding, nullable FK) → Task 3 (schema + test asserting couple sharing).
- Schema (User/Wedding/Account/Session/VerificationToken, UserRole) → Task 3.
- Auth flows (register, Google, forgot password, JWT claims) → Tasks 5, 6, 7.
- Route protection (proxy.ts rules for app/admin/auth) → Task 8.
- Localization (he default unprefixed, en prefixed, RTL logical props, JSON messages, no-hardcoded-strings) → Tasks 2 (fonts), 4 (routing/messages/RTL), 10 (lint rule).
- Testing/CI/observability → Tasks 1 (Vitest), 10 (Playwright + CI), 9 (Sentry), 9 (Inngest).
- Premium entitlement model → correctly deferred to Phase 9 (spec marks it as banked, no Phase 1 schema change); no task needed. ✓

**Placeholder scan:** No "TBD"/"implement later"/vague-error steps — every code step contains complete code. Version-sensitive tasks (5, 8, 9) carry an explicit "verify current API via context7" note rather than a placeholder, because the exact beta API is the one thing that can drift; the logic and structure are fully specified.

**Type consistency:** `authorizeRoute` signature, `registerUser` return union, `performPasswordReset` error codes, and the JWT `{ id, role, weddingId }` claims are consistent across their definitions and usages. Session type augmentation (Task 5) matches the `session.user.*` reads in `lib/auth/config.ts`.

**Scope check:** All tasks serve the Phase 1 foundation; no feature-phase work (checklist, concepts, budget, vendors, AI) leaked in. Placeholder protected pages exist only to exercise route protection, not to build those features.
