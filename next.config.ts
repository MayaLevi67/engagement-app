import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import { withSentryConfig } from '@sentry/nextjs';

const withNextIntl = createNextIntlPlugin('./lib/i18n/request.ts');

const nextConfig: NextConfig = {};

export default withSentryConfig(withNextIntl(nextConfig), {
  silent: true,
  // org/project are only needed for source-map upload at deploy time.
});
