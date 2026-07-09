'use client';

import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/lib/i18n/navigation';
import { APP_NAV_SECTIONS, activeAppNavKey } from '@/lib/app-nav/sections';
import { LogoutButton } from '../logout-button';

export function SideNav() {
  const t = useTranslations();
  const pathname = usePathname();
  const active = activeAppNavKey(pathname);

  return (
    <nav
      aria-label={t('Nav.title')}
      className="flex shrink-0 flex-row gap-1 overflow-x-auto border-b border-muted/20 bg-surface p-2 sm:min-h-screen sm:w-48 sm:flex-col sm:overflow-visible sm:border-b-0 sm:border-e sm:p-3"
    >
      {APP_NAV_SECTIONS.map((section) => (
        <Link
          key={section.key}
          href={section.href}
          aria-current={active === section.key ? 'page' : undefined}
          className={
            active === section.key
              ? 'rounded-card bg-primary px-3 py-2 text-sm font-medium text-background'
              : 'rounded-card px-3 py-2 text-sm text-text hover:bg-background'
          }
        >
          {t(section.labelKey)}
        </Link>
      ))}
      <div className="sm:mt-auto">
        <LogoutButton className="rounded-card px-3 py-2 text-start text-sm text-text hover:bg-background disabled:opacity-60" />
      </div>
    </nav>
  );
}
