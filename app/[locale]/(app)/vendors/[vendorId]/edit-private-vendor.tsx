'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { TaskCategory } from '@prisma/client';
import { CATEGORY_OPTIONS } from '@/lib/checklist/schema';
import { editPrivateVendor } from '@/lib/actions/vendors';
import type { SerializedVendorDetail } from './vendor-detail';

interface EditPrivateVendorProps {
  vendor: SerializedVendorDetail;
  displayName: string;
  /** The couple's current quote notes, passed through unchanged so this form
   * (which doesn't expose a notes field of its own — that's the quote
   * panel's job) doesn't clobber them: `editPrivateVendor` always writes
   * whatever `notes` it's given onto the shared VendorQuote row. */
  quoteNotes: string | null;
  onSaved: () => void;
  onCancel: () => void;
}

export function EditPrivateVendor({ vendor, displayName, quoteNotes, onSaved, onCancel }: EditPrivateVendorProps) {
  const t = useTranslations('Vendors');
  const tCategory = useTranslations('TaskCategory');

  const [name, setName] = useState(displayName);
  const [category, setCategory] = useState<TaskCategory>(vendor.category);
  const [city, setCity] = useState(vendor.city ?? '');
  const [email, setEmail] = useState(vendor.email ?? '');
  const [phone, setPhone] = useState(vendor.phone ?? '');
  const [website, setWebsite] = useState(vendor.website ?? '');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setError(false);
    setPending(true);
    const result = await editPrivateVendor(vendor.id, {
      name_en: trimmed,
      name_he: trimmed,
      category,
      city: city.trim() || null,
      email: email.trim() || null,
      phone: phone.trim() || null,
      website: website.trim() || null,
      notes: quoteNotes,
    });
    setPending(false);
    if (!result.ok) {
      setError(true);
      return;
    }
    onSaved();
  }

  return (
    <div className="flex flex-col gap-3 rounded-card bg-surface p-4 shadow-sm">
      <label className="flex flex-col gap-1 text-xs text-muted" htmlFor="edit-vendor-name">
        {t('nameLabel')}
        <input
          id="edit-vendor-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-card border border-muted/30 bg-background px-3 py-2 text-sm text-text"
        />
      </label>

      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-xs text-muted" htmlFor="edit-vendor-category">
          {t('filterCategory')}
          <select
            id="edit-vendor-category"
            value={category}
            onChange={(e) => setCategory(e.target.value as TaskCategory)}
            className="rounded-card border border-muted/30 bg-background px-2 py-1.5 text-sm text-text"
          >
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {tCategory(option)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-muted" htmlFor="edit-vendor-city">
          {t('cityLabel')}
          <input
            id="edit-vendor-city"
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="rounded-card border border-muted/30 bg-background px-2 py-1.5 text-sm text-text"
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-xs text-muted" htmlFor="edit-vendor-email">
          {t('contactEmail')}
          <input
            id="edit-vendor-email"
            type="email"
            dir="ltr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-card border border-muted/30 bg-background px-2 py-1.5 text-sm text-text"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs text-muted" htmlFor="edit-vendor-phone">
          {t('contactPhone')}
          <input
            id="edit-vendor-phone"
            type="tel"
            dir="ltr"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="rounded-card border border-muted/30 bg-background px-2 py-1.5 text-sm text-text"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs text-muted" htmlFor="edit-vendor-website">
          {t('contactWebsite')}
          <input
            id="edit-vendor-website"
            type="url"
            dir="ltr"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            className="rounded-card border border-muted/30 bg-background px-2 py-1.5 text-sm text-text"
          />
        </label>
      </div>

      {error ? <p className="text-sm text-red-600">{t('error')}</p> : null}

      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={handleSave}
          className="rounded-card bg-primary px-3 py-1.5 text-sm font-medium text-background disabled:opacity-60"
        >
          {t('save')}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onCancel}
          className="rounded-card border border-muted/30 px-3 py-1.5 text-sm text-text"
        >
          {t('cancel')}
        </button>
      </div>
    </div>
  );
}
