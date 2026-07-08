'use client';

import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/lib/i18n/navigation';
import { ADMIN_SECTIONS, activeSectionKey } from '@/lib/admin/sections';
import { LogoutButton } from '../logout-button';

export function AdminNav() {
  const t = useTranslations();
  const pathname = usePathname();
  const active = activeSectionKey(pathname);

  return (
    <nav className="flex flex-row gap-2 overflow-x-auto sm:flex-col sm:overflow-visible">
      {ADMIN_SECTIONS.map((section) => (
        <Link
          key={section.key}
          href={section.href}
          aria-current={active === section.key ? 'page' : undefined}
          className={
            active === section.key
              ? 'rounded-card bg-primary px-3 py-2 text-sm font-medium text-background'
              : 'rounded-card px-3 py-2 text-sm text-text hover:bg-surface'
          }
        >
          {t(section.labelKey)}
        </Link>
      ))}
      <LogoutButton className="rounded-card px-3 py-2 text-start text-sm text-text hover:bg-surface disabled:opacity-60 sm:mt-2" />
    </nav>
  );
}
