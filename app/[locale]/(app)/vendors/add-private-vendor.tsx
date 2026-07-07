'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { TaskCategory } from '@prisma/client';
import { addPrivateVendor } from '@/lib/actions/vendors';
import { CATEGORY_OPTIONS } from '@/lib/checklist/schema';

interface AddPrivateVendorProps {
  onAdded: (id: string) => void;
  onCancel: () => void;
}

export function AddPrivateVendor({ onAdded, onCancel }: AddPrivateVendorProps) {
  const t = useTranslations('Vendors');
  const tCategory = useTranslations('TaskCategory');

  const [name, setName] = useState('');
  const [category, setCategory] = useState<TaskCategory>('OTHER');
  const [city, setCity] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [notes, setNotes] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    setError(false);
    setPending(true);
    const result = await addPrivateVendor({
      name_en: trimmed,
      name_he: trimmed,
      category,
      city: city.trim() || null,
      email: email.trim() || null,
      phone: phone.trim() || null,
      website: website.trim() || null,
      notes: notes.trim() || null,
    });
    setPending(false);
    if (!result.ok || !result.id) {
      setError(true);
      return;
    }
    onAdded(result.id);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-card bg-surface p-4 shadow-sm">
      <h2 className="font-display text-lg text-text">{t('addYourOwn')}</h2>

      <label className="flex flex-col gap-1 text-xs text-muted" htmlFor="add-vendor-name">
        {t('nameLabel')}
        <input
          id="add-vendor-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-card border border-muted/30 bg-background px-3 py-2 text-sm text-text"
        />
      </label>

      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-xs text-muted" htmlFor="add-vendor-category">
          {t('filterCategory')}
          <select
            id="add-vendor-category"
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

        <label className="flex flex-col gap-1 text-xs text-muted" htmlFor="add-vendor-city">
          {t('cityLabel')}
          <input
            id="add-vendor-city"
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="rounded-card border border-muted/30 bg-background px-2 py-1.5 text-sm text-text"
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-xs text-muted" htmlFor="add-vendor-email">
          {t('contactEmail')}
          <input
            id="add-vendor-email"
            type="email"
            dir="ltr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-card border border-muted/30 bg-background px-2 py-1.5 text-sm text-text"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs text-muted" htmlFor="add-vendor-phone">
          {t('contactPhone')}
          <input
            id="add-vendor-phone"
            type="tel"
            dir="ltr"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="rounded-card border border-muted/30 bg-background px-2 py-1.5 text-sm text-text"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs text-muted" htmlFor="add-vendor-website">
          {t('contactWebsite')}
          <input
            id="add-vendor-website"
            type="url"
            dir="ltr"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            className="rounded-card border border-muted/30 bg-background px-2 py-1.5 text-sm text-text"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-xs text-muted" htmlFor="add-vendor-notes">
        {t('notesLabel')}
        <textarea
          id="add-vendor-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="rounded-card border border-muted/30 bg-background px-3 py-2 text-sm text-text"
        />
      </label>

      {error ? <p className="text-sm text-red-600">{t('error')}</p> : null}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending || !name.trim()}
          className="rounded-card bg-primary px-4 py-2 text-sm font-medium text-background disabled:opacity-60"
        >
          {t('save')}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onCancel}
          className="rounded-card border border-muted/30 px-4 py-2 text-sm text-text"
        >
          {t('cancel')}
        </button>
      </div>
    </form>
  );
}
