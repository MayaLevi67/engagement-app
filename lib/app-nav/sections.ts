export interface AppNavSection {
  key: string;
  href: string;
  labelKey: string; // i18n key, resolved by the nav component
}

export const APP_NAV_SECTIONS: AppNavSection[] = [
  { key: 'dashboard', href: '/dashboard', labelKey: 'Nav.dashboard' },
  { key: 'checklist', href: '/checklist', labelKey: 'Nav.checklist' },
  { key: 'budget', href: '/budget', labelKey: 'Nav.budget' },
  { key: 'concepts', href: '/concepts', labelKey: 'Nav.concepts' },
  { key: 'vendors', href: '/vendors', labelKey: 'Nav.vendors' },
];

/** Strip an optional /en locale prefix, then match the most specific section
 *  (a page and any of its sub-paths, e.g. /vendors and /vendors/abc). */
export function activeAppNavKey(pathname: string): string | null {
  const rest = pathname.replace(/^\/en(?=\/|$)/, '') || '/';
  const match = APP_NAV_SECTIONS.find(
    (s) => rest === s.href || rest.startsWith(`${s.href}/`),
  );
  return match?.key ?? null;
}
