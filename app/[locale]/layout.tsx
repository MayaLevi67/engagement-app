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
