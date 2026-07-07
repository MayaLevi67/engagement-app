'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { resolveVendorTitle } from '@/lib/vendors/title';
import { VendorForm, type SerializedAdminVendor, type AdminVendorImage } from './vendor-form';

export type { SerializedAdminVendor, AdminVendorImage };

type BoolField = 'active' | 'verified' | 'isPremium';

// See the comment on adminVendorsActions() in vendor-form.tsx: the admin
// actions module transitively imports NextAuth, which this test environment
// can't statically resolve, so it's imported dynamically inside handlers
// rather than at module scope.
async function adminVendorsActions() {
  return import('@/lib/actions/admin-vendors');
}

export function VendorsAdmin({ vendors }: { vendors: SerializedAdminVendor[] }) {
  const t = useTranslations('AdminVendors');
  const tCategory = useTranslations('TaskCategory');
  const locale = useLocale();
  const [list, setList] = useState(vendors);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const editing = list.find((v) => v.id === editingId) ?? null;

  function upsert(v: SerializedAdminVendor) {
    setList((l) => (l.some((x) => x.id === v.id) ? l.map((x) => (x.id === v.id ? v : x)) : [...l, v]));
    setCreating(false);
    setEditingId(null);
  }

  function patchImages(vendorId: string, images: AdminVendorImage[]) {
    setList((l) => l.map((x) => (x.id === vendorId ? { ...x, images } : x)));
  }

  async function onToggle(id: string, field: BoolField, next: boolean) {
    setPendingId(id);
    const { setVendorActive, setVendorVerified, setVendorPremium } = await adminVendorsActions();
    const setter = field === 'active' ? setVendorActive : field === 'verified' ? setVendorVerified : setVendorPremium;
    const r = await setter(id, next);
    setPendingId(null);
    if (!r.ok) return;
    setList((l) => l.map((x) => (x.id === id ? { ...x, [field]: next } : x)));
  }

  async function onDelete(id: string) {
    setPendingId(id);
    const { deleteVendor } = await adminVendorsActions();
    const r = await deleteVendor(id);
    setPendingId(null);
    if (!r.ok) return;
    setList((l) => l.filter((x) => x.id !== id));
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl text-text">{t('title')}</h1>
          <button
            type="button"
            onClick={() => {
              setCreating(true);
              setEditingId(null);
            }}
            className="rounded-card bg-primary px-4 py-2 text-sm font-medium text-background"
          >
            {t('addVendor')}
          </button>
        </div>
        <p className="text-sm text-muted">{t('subtitle')}</p>
      </header>

      {creating ? (
        <VendorForm vendor={null} onSaved={upsert} onImagesChanged={patchImages} onCancel={() => setCreating(false)} />
      ) : null}

      <ul className="flex flex-col gap-2">
        {list.map((v) => (
          <li key={v.id} className="rounded-card bg-surface p-3">
            {editing?.id === v.id ? (
              <VendorForm
                vendor={editing}
                onSaved={upsert}
                onImagesChanged={patchImages}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(v.id);
                    setCreating(false);
                  }}
                  className="flex flex-col items-start gap-0.5 text-start"
                >
                  <span className="text-sm font-medium text-text">{resolveVendorTitle(v, locale)}</span>
                  <span className="text-xs text-muted">
                    {tCategory(v.category)}
                    {v.city ? ` · ${v.city}` : ''}
                  </span>
                </button>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-1 text-xs text-muted">
                    <input
                      type="checkbox"
                      checked={v.verified}
                      disabled={pendingId === v.id}
                      onChange={(e) => onToggle(v.id, 'verified', e.target.checked)}
                    />
                    {t('verifiedLabel')}
                  </label>
                  <label className="flex items-center gap-1 text-xs text-muted">
                    <input
                      type="checkbox"
                      checked={v.isPremium}
                      disabled={pendingId === v.id}
                      onChange={(e) => onToggle(v.id, 'isPremium', e.target.checked)}
                    />
                    {t('premiumLabel')}
                  </label>
                  <label className="flex items-center gap-1 text-xs text-muted">
                    <input
                      type="checkbox"
                      checked={v.active}
                      disabled={pendingId === v.id}
                      onChange={(e) => onToggle(v.id, 'active', e.target.checked)}
                    />
                    {t('activeLabel')}
                  </label>
                  <button
                    type="button"
                    disabled={pendingId === v.id}
                    onClick={() => onDelete(v.id)}
                    className="text-sm text-red-600"
                  >
                    {t('delete')}
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
