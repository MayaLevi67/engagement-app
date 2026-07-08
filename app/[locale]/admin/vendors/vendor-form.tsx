'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { TaskCategory, type TitleLocale } from '@prisma/client';
import { createVendor, updateVendor, addVendorImage, deleteVendorImage } from '@/lib/actions/admin-vendors';

const CATEGORY_OPTIONS = Object.values(TaskCategory);

export interface AdminVendorImage {
  id: string;
  url: string;
  alt_en: string | null;
  alt_he: string | null;
  sortOrder: number;
}

export interface SerializedAdminVendor {
  id: string;
  name_en: string;
  name_he: string;
  titleLocale: TitleLocale;
  category: TaskCategory;
  city: string | null;
  priceMin: number | null;
  priceMax: number | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  description_en: string | null;
  description_he: string | null;
  verified: boolean;
  isPremium: boolean;
  active: boolean;
  sortOrder: number;
  images: AdminVendorImage[];
}

/**
 * Content-only payload: verified/isPremium/active/sortOrder are intentionally
 * excluded — those are owned by the dedicated setVendorActive/setVendorVerified/
 * setVendorPremium actions (wired from the row toggles in vendors-admin.tsx),
 * NOT by this form's create/update calls. See lib/actions/admin-vendors.ts.
 */
interface ContentPayload {
  name_en: string;
  name_he: string;
  titleLocale: TitleLocale;
  description_en: string | null;
  description_he: string | null;
  category: TaskCategory;
  city: string | null;
  priceMin: number | null;
  priceMax: number | null;
  email: string | null;
  phone: string | null;
  website: string | null;
}

export function VendorForm({
  vendor,
  onSaved,
  onNestedChange,
  onCancel,
}: {
  vendor: SerializedAdminVendor | null;
  onSaved: () => void;
  onNestedChange: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations('AdminVendors');
  const tCategory = useTranslations('TaskCategory');
  const [nameEn, setNameEn] = useState(vendor?.name_en ?? '');
  const [nameHe, setNameHe] = useState(vendor?.name_he ?? '');
  const [category, setCategory] = useState<TaskCategory>(vendor?.category ?? 'OTHER');
  const [city, setCity] = useState(vendor?.city ?? '');
  const [priceMin, setPriceMin] = useState(vendor?.priceMin?.toString() ?? '');
  const [priceMax, setPriceMax] = useState(vendor?.priceMax?.toString() ?? '');
  const [email, setEmail] = useState(vendor?.email ?? '');
  const [phone, setPhone] = useState(vendor?.phone ?? '');
  const [website, setWebsite] = useState(vendor?.website ?? '');
  const [error, setError] = useState(false);
  const [pending, setPending] = useState(false);

  // Not exposed as form fields (no AdminVendors label exists for either), but
  // carried through unchanged so saving an edit can't silently wipe them.
  const titleLocale = vendor?.titleLocale ?? 'AUTO';
  const descriptionEn = vendor?.description_en ?? null;
  const descriptionHe = vendor?.description_he ?? null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(false);
    setPending(true);
    const payload: ContentPayload = {
      name_en: nameEn.trim(),
      name_he: nameHe.trim(),
      titleLocale,
      description_en: descriptionEn,
      description_he: descriptionHe,
      category,
      city: city.trim() || null,
      priceMin: priceMin.trim() === '' ? null : Math.trunc(Number(priceMin)),
      priceMax: priceMax.trim() === '' ? null : Math.trunc(Number(priceMax)),
      email: email.trim() || null,
      phone: phone.trim() || null,
      website: website.trim() || null,
    };
    const r = vendor ? await updateVendor(vendor.id, payload) : await createVendor(payload);
    setPending(false);
    if (!r.ok) {
      setError(true);
      return;
    }
    onSaved();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 rounded-card bg-surface p-4">
      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-xs text-muted">
          {t('nameEnLabel')}
          <input
            value={nameEn}
            onChange={(e) => setNameEn(e.target.value)}
            className="rounded-card border border-muted/30 bg-background px-3 py-2 text-sm text-text"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          {t('nameHeLabel')}
          <input
            value={nameHe}
            onChange={(e) => setNameHe(e.target.value)}
            className="rounded-card border border-muted/30 bg-background px-3 py-2 text-sm text-text"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          {t('categoryLabel')}
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as TaskCategory)}
            className="rounded-card border border-muted/30 bg-background px-2 py-2 text-sm text-text"
          >
            {CATEGORY_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {tCategory(o)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          {t('cityLabel')}
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="rounded-card border border-muted/30 bg-background px-3 py-2 text-sm text-text"
          />
        </label>
      </div>
      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-xs text-muted">
          {t('priceMinLabel')}
          <input
            type="number"
            dir="ltr"
            value={priceMin}
            onChange={(e) => setPriceMin(e.target.value)}
            className="w-32 rounded-card border border-muted/30 bg-background px-2 py-1 text-sm text-text"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          {t('priceMaxLabel')}
          <input
            type="number"
            dir="ltr"
            value={priceMax}
            onChange={(e) => setPriceMax(e.target.value)}
            className="w-32 rounded-card border border-muted/30 bg-background px-2 py-1 text-sm text-text"
          />
        </label>
      </div>
      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-xs text-muted">
          {t('emailLabel')}
          <input
            type="email"
            dir="ltr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-card border border-muted/30 bg-background px-3 py-2 text-sm text-text"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          {t('phoneLabel')}
          <input
            type="tel"
            dir="ltr"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="rounded-card border border-muted/30 bg-background px-3 py-2 text-sm text-text"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          {t('websiteLabel')}
          <input
            type="url"
            dir="ltr"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            className="rounded-card border border-muted/30 bg-background px-3 py-2 text-sm text-text"
          />
        </label>
      </div>

      {error ? <p className="text-sm text-red-600">{t('error')}</p> : null}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-card bg-primary px-4 py-2 text-sm font-medium text-background disabled:opacity-60"
        >
          {t('save')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-card border border-muted/30 px-4 py-2 text-sm text-text"
        >
          {t('cancel')}
        </button>
      </div>

      {vendor ? <VendorImageEditor vendor={vendor} onChanged={onNestedChange} t={t} /> : null}
    </form>
  );
}

function VendorImageEditor({
  vendor,
  onChanged,
  t,
}: {
  vendor: SerializedAdminVendor;
  onChanged: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState(false);

  async function onAddImage() {
    if (!url.trim()) return;
    setError(false);
    const r = await addVendorImage(vendor.id, { url: url.trim(), sortOrder: vendor.images.length });
    if (!r.ok) {
      setError(true);
      return;
    }
    setUrl('');
    onChanged();
  }

  async function onDeleteImage(imageId: string) {
    setError(false);
    const r = await deleteVendorImage(imageId);
    if (!r.ok) {
      setError(true);
      return;
    }
    onChanged();
  }

  return (
    <div className="mt-3 flex flex-col gap-2 border-t border-muted/20 pt-3">
      <h3 className="text-sm font-medium text-text">{t('imagesTitle')}</h3>
      {vendor.images.map((im) => (
        <div key={im.id} className="flex items-center gap-2 text-xs text-muted">
          <span dir="ltr" className="truncate">
            {im.url}
          </span>
          <button type="button" onClick={() => onDeleteImage(im.id)} className="text-red-600">
            {t('delete')}
          </button>
        </div>
      ))}
      <div className="flex gap-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          dir="ltr"
          placeholder={t('imageUrlLabel')}
          className="flex-1 rounded-card border border-muted/30 bg-background px-2 py-1 text-sm text-text"
        />
        <button
          type="button"
          onClick={onAddImage}
          className="rounded-card border border-muted/30 px-3 py-1 text-sm text-text"
        >
          {t('addImage')}
        </button>
      </div>
      {error ? <p className="text-sm text-red-600">{t('error')}</p> : null}
    </div>
  );
}
