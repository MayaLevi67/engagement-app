import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: 'http://localhost:3000',
    // The app negotiates the first-time-visitor locale from Accept-Language
    // (see docs/superpowers/specs/2026-07-04-foundation-design.md). Chromium's
    // default context sends `en-US`, which would make '/' negotiate to the
    // English locale instead of exercising the Hebrew default. Pin the
    // context locale so the RTL/he smoke test is deterministic in local and
    // CI runs regardless of the host machine's own locale.
    locale: 'he-IL',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
