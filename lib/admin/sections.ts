export interface AdminSection {
  key: string;
  href: string;
  labelKey: string; // i18n key, resolved by the nav component
}

export const ADMIN_SECTIONS: AdminSection[] = [
  { key: 'overview', href: '/admin', labelKey: 'Admin.overviewNav' },
  { key: 'checklist-templates', href: '/admin/checklist-templates', labelKey: 'AdminTemplates.title' },
  { key: 'concepts', href: '/admin/concepts', labelKey: 'AdminConcepts.title' },
  { key: 'budget-templates', href: '/admin/budget-templates', labelKey: 'AdminBudget.title' },
  { key: 'vendors', href: '/admin/vendors', labelKey: 'AdminVendors.title' },
];

/** Strip an optional /en locale prefix, then match the most specific section. */
export function activeSectionKey(pathname: string): string | null {
  const rest = pathname.replace(/^\/en(?=\/|$)/, '') || '/';
  if (rest === '/admin') return 'overview';
  // Non-overview sections: match /admin/<seg> and any sub-path.
  const match = ADMIN_SECTIONS.find(
    (s) => s.key !== 'overview' && (rest === s.href || rest.startsWith(`${s.href}/`)),
  );
  return match?.key ?? null;
}
