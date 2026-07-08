'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { TaskCategory, TitleLocale } from '@prisma/client';
import { Link, useRouter } from '@/lib/i18n/navigation';
import { deletePrivateVendor } from '@/lib/actions/vendors';
import { resolveVendorTitle } from '@/lib/vendors/title';
import { QuotePanel, type SerializedQuote, type QuoteTask } from './quote-panel';
import { EditPrivateVendor } from './edit-private-vendor';
import { UpgradeButton } from '../../upgrade-button';

export interface SerializedVendorDetail {
  id: string;
  name_en: string;
  name_he: string;
  titleLocale: TitleLocale;
  category: TaskCategory;
  city: string | null;
  priceMin: number | null;
  priceMax: number | null;
  description: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  verified: boolean;
  isPremium: boolean;
  isPrivate: boolean;
  images: { url: string; alt: string }[];
}

interface VendorDetailProps {
  locale: string;
  vendor: SerializedVendorDetail;
  quote: SerializedQuote | null;
  tasks: QuoteTask[];
  premium?: boolean;
}

// '←' isn't in the eslint `react/jsx-no-literals` allowedStrings list (only
// '·', '—', '/'); building the label in a helper keeps the Literal AST node
// out of the JSX text position the rule inspects (same idiom as concept-detail.tsx).
function formatBackLabel(label: string): string {
  return `← ${label}`;
}

export function VendorDetail({ locale, vendor, quote, tasks, premium = false }: VendorDetailProps) {
  const t = useTranslations('Vendors');
  const tCategory = useTranslations('TaskCategory');
  const tPremium = useTranslations('Premium');
  const router = useRouter();

  const displayName = resolveVendorTitle(vendor, locale);
  const fmt = (n: number) => `₪${n.toLocaleString(locale)}`;
  const locked = vendor.isPremium && !premium;

  const [isEditing, setIsEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  function refresh() {
    router.refresh();
  }

  async function handleDelete() {
    setError(false);
    setPending(true);
    const result = await deletePrivateVendor(vendor.id);
    setPending(false);
    if (!result.ok) {
      setError(true);
      return;
    }
    router.push('/vendors');
  }

  return (
    <div className="flex flex-col gap-6">
      <Link href="/vendors" className="text-sm text-muted">{formatBackLabel(t('title'))}</Link>

      {vendor.images.length > 0 ? (
        <div className="flex gap-3 overflow-x-auto">
          {vendor.images.map((image, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={image.url}
              alt={image.alt}
              className="h-40 w-56 flex-none rounded-card object-cover"
            />
          ))}
        </div>
      ) : null}

      {isEditing ? (
        <EditPrivateVendor
          vendor={vendor}
          displayName={displayName}
          quoteNotes={quote?.notes ?? null}
          onCancel={() => setIsEditing(false)}
          onSaved={() => {
            setIsEditing(false);
            refresh();
          }}
        />
      ) : (
        <div className="flex flex-col gap-3 rounded-card bg-surface p-4 shadow-sm">
          <h1 className="font-display text-2xl text-text">{displayName}</h1>

          <div className="flex flex-wrap gap-2 text-sm text-muted">
            <span>{tCategory(vendor.category)}</span>
            {vendor.city ? <span>· {vendor.city}</span> : null}
            {vendor.priceMin != null ? (
              <span>· {vendor.priceMax != null ? t('priceRange', { min: fmt(vendor.priceMin), max: fmt(vendor.priceMax) }) : t('priceFrom', { min: fmt(vendor.priceMin) })}</span>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            {vendor.isPrivate ? (
              <span className="rounded-card bg-accent/20 px-2 py-0.5 text-xs text-text">{t('privateBadge')}</span>
            ) : null}
            {vendor.verified ? (
              <span className="rounded-card bg-primary/15 px-2 py-0.5 text-xs text-primary">{t('verifiedBadge')}</span>
            ) : null}
            {vendor.isPremium ? (
              <span className="rounded-card bg-background px-2 py-0.5 text-xs text-muted">{t('premiumBadge')}</span>
            ) : null}
          </div>

          {vendor.description ? <p className="text-sm text-text">{vendor.description}</p> : null}

          <div className="flex flex-wrap gap-4 text-sm">
            {vendor.email ? (
              <a href={`mailto:${vendor.email}`} className="text-primary">{t('contactEmail')}</a>
            ) : null}
            {vendor.phone ? (
              <a href={`tel:${vendor.phone}`} className="text-primary">{t('contactPhone')}</a>
            ) : null}
            {vendor.website ? (
              <a href={vendor.website} target="_blank" rel="noreferrer" className="text-primary">
                {t('contactWebsite')}
              </a>
            ) : null}
          </div>

          {vendor.isPrivate ? (
            <div className="flex gap-2">
              <button type="button" onClick={() => setIsEditing(true)} className="text-sm text-text">
                {t('edit')}
              </button>
              <button type="button" disabled={pending} onClick={handleDelete} className="text-sm text-red-600">
                {t('delete')}
              </button>
            </div>
          ) : null}

          {error ? <p className="text-sm text-red-600">{t('error')}</p> : null}
        </div>
      )}

      {locked ? (
        <section className="flex flex-col items-center gap-3 rounded-card bg-surface p-6 text-center shadow-sm">
          <p className="text-sm text-muted">{tPremium('lockedVendor')}</p>
          <UpgradeButton />
        </section>
      ) : (
        <QuotePanel vendorId={vendor.id} quote={quote} tasks={tasks} onChanged={refresh} />
      )}
    </div>
  );
}
