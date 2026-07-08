'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { TaskCategory, TitleLocale } from '@prisma/client';
import { Link } from '@/lib/i18n/navigation';
import { chooseConcept, clearSelectedConcept, addElementToChecklist } from '@/lib/actions/concepts';
import { resolveVendorTitle } from '@/lib/vendors/title';
import { UpgradeButton } from '../../upgrade-button';

export interface SerializedElement {
  id: string;
  title: string;
  description: string;
  category: TaskCategory;
  estCostMin: number | null;
  estCostMax: number | null;
  isAdded: boolean;
}

export interface SerializedConceptDetail {
  id: string;
  title: string;
  tagline: string;
  description: string;
  palette: string[];
  isPremium: boolean;
  isSelected: boolean;
  images: { url: string; alt: string }[];
  elements: SerializedElement[];
}

export interface SerializedConceptVendor {
  id: string;
  name_en: string;
  name_he: string;
  titleLocale: TitleLocale;
}

function formatBackLabel(label: string): string {
  return `← ${label}`;
}

function formatCostRange(label: string, min: number | null, max: number | null): string {
  return `${label}: ${min ?? '—'}–${max ?? '—'} ₪`;
}

interface ConceptDetailProps {
  concept: SerializedConceptDetail;
  locale?: string;
  vendorsByCategory?: Record<string, SerializedConceptVendor[]>;
  premium?: boolean;
}

export function ConceptDetail({ concept, locale = 'en', vendorsByCategory = {}, premium = false }: ConceptDetailProps) {
  const t = useTranslations('Concepts');
  const tCategory = useTranslations('TaskCategory');
  const tPremium = useTranslations('Premium');
  const [selected, setSelected] = useState(concept.isSelected);
  const [added, setAdded] = useState<Record<string, boolean>>(
    Object.fromEntries(concept.elements.map((e) => [e.id, e.isAdded])),
  );
  const locked = concept.isPremium && !premium;

  async function onToggleSelect() {
    const prev = selected;
    setSelected(!prev);
    const r = prev ? await clearSelectedConcept() : await chooseConcept(concept.id);
    if (!r.ok) setSelected(prev);
  }

  async function onAdd(elementId: string) {
    setAdded((m) => ({ ...m, [elementId]: true }));
    const r = await addElementToChecklist(elementId);
    if (!r.ok) setAdded((m) => ({ ...m, [elementId]: false }));
  }

  const cover = concept.images[0];

  return (
    <div className="flex flex-col gap-6">
      <Link href="/concepts" className="text-sm text-muted">{formatBackLabel(t('back'))}</Link>

      <div className="relative overflow-hidden rounded-card bg-muted/10">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover.url} alt={cover.alt} className="h-56 w-full object-cover sm:h-72" />
        ) : null}
        <div className="absolute inset-0 flex flex-col items-end justify-end bg-gradient-to-t from-black/50 to-transparent p-6 text-end">
          <h1 className="font-display text-3xl text-white">{concept.title}</h1>
          {concept.tagline ? <p className="text-sm text-white/90">{concept.tagline}</p> : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-[minmax(0,16rem)_1fr]">
        <aside className="flex flex-col items-center gap-3 rounded-card bg-surface p-5 text-center">
          <h2 className="font-display text-lg text-text">{t('makeItYours')}</h2>
          {locked ? (
            <>
              <p className="text-xs text-muted">{tPremium('lockedConcept')}</p>
              <UpgradeButton />
            </>
          ) : (
            <>
              <p className="text-xs text-muted">{t('makeItYoursBody')}</p>
              <button
                type="button"
                onClick={onToggleSelect}
                className="rounded-card bg-primary px-4 py-2 text-sm font-medium text-background"
              >
                {selected ? t('clearSelection') : t('select')}
              </button>
            </>
          )}
        </aside>

        <section className="flex flex-col gap-4">
          {concept.description ? <p className="text-text">{concept.description}</p> : null}
          {concept.palette.length > 0 ? (
            <div>
              <h3 className="mb-2 font-display text-lg text-text">{t('colorPalette')}</h3>
              <div className="flex flex-wrap gap-3">
                {concept.palette.map((hex, i) => (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <span className="h-10 w-10 rounded-card border border-muted/20" style={{ backgroundColor: hex }} />
                    <span dir="ltr" className="text-xs text-muted">{hex}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      </div>

      <section className="flex flex-col gap-3">
        <h3 className="font-display text-lg text-text">{t('ideas')}</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {concept.elements.map((el) => (
            <article key={el.id} className="flex flex-col gap-2 rounded-card bg-surface p-4">
              <span className="text-xs uppercase tracking-wide text-muted">{tCategory(el.category)}</span>
              <h4 className="font-display text-base text-text">{el.title}</h4>
              {el.description ? <p className="text-sm text-muted">{el.description}</p> : null}
              {el.estCostMin != null || el.estCostMax != null ? (
                <p className="text-xs text-muted">
                  {formatCostRange(t('estCost'), el.estCostMin, el.estCostMax)}
                </p>
              ) : null}
              {locked ? (
                <UpgradeButton className="mt-1 self-start rounded-card border border-muted/30 px-3 py-1.5 text-sm text-text" />
              ) : (
                <button
                  type="button"
                  onClick={() => onAdd(el.id)}
                  disabled={added[el.id]}
                  className="mt-1 self-start rounded-card border border-muted/30 px-3 py-1.5 text-sm text-text disabled:opacity-60"
                >
                  {added[el.id] ? `✓ ${t('added')}` : t('addToChecklist')}
                </button>
              )}
              {vendorsByCategory[el.category]?.length ? (
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted">{t('vendorsForThis')}</span>
                  {vendorsByCategory[el.category].map((vendor) => (
                    <Link
                      key={vendor.id}
                      href={`/vendors/${vendor.id}`}
                      className="rounded-card bg-background px-2 py-1 text-xs text-primary"
                    >
                      {resolveVendorTitle(vendor, locale)}
                    </Link>
                  ))}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
