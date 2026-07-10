'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { TaskCategory, TitleLocale } from '@prisma/client';
import { Link } from '@/lib/i18n/navigation';
import { toggleShortlist } from '@/lib/actions/vendors';
import { resolveVendorTitle } from '@/lib/vendors/title';
import { UpgradeButton } from '../upgrade-button';

export interface SerializedVendor {
  id: string;
  name_en: string; name_he: string; titleLocale: TitleLocale;
  category: TaskCategory; city: string | null;
  priceMin: number | null; priceMax: number | null;
  verified: boolean; isPremium: boolean; isPrivate: boolean;
  coverUrl: string | null;
}

export function VendorCard({
  locale, vendor, shortlisted, onChanged, premium = false,
}: { locale: string; vendor: SerializedVendor; shortlisted: boolean; onChanged: () => void; premium?: boolean }) {
  const t = useTranslations('Vendors');
  const tCategory = useTranslations('TaskCategory');
  const tPremium = useTranslations('Premium');
  const [pending, setPending] = useState(false);
  const name = resolveVendorTitle(vendor, locale);
  const fmt = (n: number) => `₪${n.toLocaleString(locale)}`;
  const locked = vendor.isPremium && !premium;

  async function toggle() {
    setPending(true);
    const r = await toggleShortlist(vendor.id);
    setPending(false);
    if (r.ok) onChanged();
  }

  return (
    <div className="flex flex-col gap-2 rounded-card bg-surface p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <Link href={`/vendors/${vendor.id}`} className="font-display text-lg text-text">{name}</Link>
        {locked ? (
          <UpgradeButton className="text-sm text-primary" />
        ) : (
          <button type="button" disabled={pending} onClick={toggle} className="text-sm text-primary">
            {shortlisted ? t('shortlisted') : t('shortlist')}
          </button>
        )}
      </div>
      {locked ? <p className="text-xs text-muted">{tPremium('lockedVendor')}</p> : null}
      <div className="flex flex-wrap gap-2 text-xs text-muted">
        <span>{tCategory(vendor.category)}</span>
        {vendor.city ? <span>· {vendor.city}</span> : null}
        {vendor.priceMin != null ? (
          <span>· {vendor.priceMax != null ? t('priceRange', { min: fmt(vendor.priceMin), max: fmt(vendor.priceMax) }) : t('priceFrom', { min: fmt(vendor.priceMin) })}</span>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {vendor.isPrivate ? <span className="rounded-card bg-muted/20 px-2 py-0.5 text-xs text-text">{t('privateBadge')}</span> : null}
        {vendor.verified ? <span className="rounded-card bg-primary/15 px-2 py-0.5 text-xs text-primary">{t('verifiedBadge')}</span> : null}
        {vendor.isPremium ? <span className="rounded-card bg-background px-2 py-0.5 text-xs text-muted">{t('premiumBadge')}</span> : null}
      </div>
    </div>
  );
}
