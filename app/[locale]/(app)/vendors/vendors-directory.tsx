'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { TaskCategory } from '@prisma/client';
import { useRouter } from '@/lib/i18n/navigation';
import { CATEGORY_OPTIONS } from '@/lib/checklist/schema';
import { VendorCard, type SerializedVendor } from './vendor-card';
import { AddPrivateVendor } from './add-private-vendor';

export type { SerializedVendor };

const ALL = '' as const;

export interface DirectoryFiltersValue {
  category: TaskCategory | typeof ALL;
  city: string;
  maxPrice: string;
}

interface VendorsDirectoryProps {
  locale: string;
  matches: SerializedVendor[];
  vendors: SerializedVendor[];
  shortlistedIds: string[];
  filters: DirectoryFiltersValue;
}

export function VendorsDirectory({ locale, matches, vendors, shortlistedIds, filters }: VendorsDirectoryProps) {
  const t = useTranslations('Vendors');
  const tCategory = useTranslations('TaskCategory');
  const router = useRouter();

  const [category, setCategory] = useState(filters.category);
  const [city, setCity] = useState(filters.city);
  const [maxPrice, setMaxPrice] = useState(filters.maxPrice);
  const [showAddPrivate, setShowAddPrivate] = useState(false);

  const shortlisted = new Set(shortlistedIds);

  function refresh() {
    router.refresh();
  }

  function pushFilters(next: DirectoryFiltersValue) {
    router.push({
      pathname: '/vendors',
      query: {
        ...(next.category ? { category: next.category } : {}),
        ...(next.city.trim() ? { city: next.city.trim() } : {}),
        ...(next.maxPrice.trim() ? { maxPrice: next.maxPrice.trim() } : {}),
      },
    });
  }

  function handleCategoryChange(next: TaskCategory | typeof ALL) {
    setCategory(next);
    pushFilters({ category: next, city, maxPrice });
  }

  function handleCityBlur() {
    pushFilters({ category, city, maxPrice });
  }

  function handleMaxPriceBlur() {
    pushFilters({ category, city, maxPrice });
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-2xl text-text">{t('title')}</h1>
        <p className="font-body text-sm text-muted">{t('subtitle')}</p>
      </header>

      <p className="rounded-card border border-muted/30 bg-surface p-4 text-xs text-muted">
        {t('disclaimer')}
      </p>

      {matches.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-lg text-text">{t('forYourWedding')}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {matches.map((vendor) => (
              <VendorCard
                key={vendor.id}
                locale={locale}
                vendor={vendor}
                shortlisted={shortlisted.has(vendor.id)}
                onChanged={refresh}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-3 rounded-card bg-surface p-4 shadow-sm">
          <label className="flex flex-col gap-1 text-xs text-muted" htmlFor="vendor-filter-category">
            {t('filterCategory')}
            <select
              id="vendor-filter-category"
              value={category}
              onChange={(e) => handleCategoryChange(e.target.value as TaskCategory | typeof ALL)}
              className="rounded-card border border-muted/30 bg-background px-2 py-1.5 text-sm text-text"
            >
              <option value={ALL}>{t('filterAll')}</option>
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {tCategory(option)}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs text-muted" htmlFor="vendor-filter-city">
            {t('filterCity')}
            <input
              id="vendor-filter-city"
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              onBlur={handleCityBlur}
              className="rounded-card border border-muted/30 bg-background px-2 py-1.5 text-sm text-text"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs text-muted" htmlFor="vendor-filter-max-price">
            {t('filterMaxPrice')}
            <input
              id="vendor-filter-max-price"
              type="number"
              min="0"
              dir="ltr"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              onBlur={handleMaxPriceBlur}
              className="rounded-card border border-muted/30 bg-background px-2 py-1.5 text-sm text-text"
            />
          </label>

          <button
            type="button"
            onClick={() => setShowAddPrivate((v) => !v)}
            className="ms-auto rounded-card bg-primary px-4 py-2 text-sm font-medium text-background"
          >
            {t('addYourOwn')}
          </button>
        </div>

        {showAddPrivate ? (
          <AddPrivateVendor
            onCancel={() => setShowAddPrivate(false)}
            onAdded={() => {
              setShowAddPrivate(false);
              refresh();
            }}
          />
        ) : null}

        {vendors.length === 0 ? (
          <p className="rounded-card bg-surface p-6 text-center text-sm text-muted shadow-sm">
            {t('empty')}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {vendors.map((vendor) => (
              <VendorCard
                key={vendor.id}
                locale={locale}
                vendor={vendor}
                shortlisted={shortlisted.has(vendor.id)}
                onChanged={refresh}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
