'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { resolveVendorTitle } from '@/lib/vendors/title';
import { deleteVendor, setVendorActive, setVendorVerified, setVendorPremium } from '@/lib/actions/admin-vendors';
import { VendorForm, type SerializedAdminVendor } from './vendor-form';

export type { SerializedAdminVendor };

type BoolField = 'active' | 'verified' | 'isPremium';

export function VendorsAdmin({ vendors }: { vendors: SerializedAdminVendor[] }) {
  const t = useTranslations('AdminVendors');
  const tCategory = useTranslations('TaskCategory');
  const locale = useLocale();
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const editing = vendors.find((v) => v.id === editingId) ?? null;

  function refresh() {
    setEditingId(null);
    setCreating(false);
    router.refresh();
  }

  async function onToggle(id: string, field: BoolField, next: boolean) {
    setPendingId(id);
    const setter = field === 'active' ? setVendorActive : field === 'verified' ? setVendorVerified : setVendorPremium;
    const r = await setter(id, next);
    setPendingId(null);
    if (r.ok) router.refresh();
  }

  async function onDelete(id: string) {
    setPendingId(id);
    const r = await deleteVendor(id);
    setPendingId(null);
    if (r.ok) router.refresh();
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
        <VendorForm
          vendor={null}
          onSaved={refresh}
          onNestedChange={() => router.refresh()}
          onCancel={() => setCreating(false)}
        />
      ) : null}

      <ul className="flex flex-col gap-2">
        {vendors.map((v) => (
          <li key={v.id} className="rounded-card bg-surface p-3">
            {editing?.id === v.id ? (
              <VendorForm
                vendor={editing}
                onSaved={refresh}
                onNestedChange={() => router.refresh()}
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
