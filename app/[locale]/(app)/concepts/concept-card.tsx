'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/lib/i18n/navigation';
import { toggleFavorite } from '@/lib/actions/concepts';

export interface SerializedConcept {
  id: string;
  title: string;
  tagline: string;
  palette: string[];
  isPremium: boolean;
  coverUrl: string | null;
  coverAlt: string;
  isFavorite: boolean;
  isSelected: boolean;
}

export function ConceptCard({ concept }: { concept: SerializedConcept }) {
  const t = useTranslations('Concepts');
  const [favorite, setFavorite] = useState(concept.isFavorite);
  const [pending, setPending] = useState(false);

  async function onToggleFavorite(e: React.MouseEvent) {
    e.preventDefault();
    setPending(true);
    const prev = favorite;
    setFavorite(!prev);
    const r = await toggleFavorite(concept.id);
    if (!r.ok) setFavorite(prev);
    setPending(false);
  }

  return (
    <Link
      href={`/concepts/${concept.id}`}
      className="group flex flex-col overflow-hidden rounded-card bg-surface shadow-sm"
    >
      <div className="relative aspect-[4/3] w-full bg-muted/10">
        {concept.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={concept.coverUrl} alt={concept.coverAlt} className="h-full w-full object-cover" />
        ) : null}
        {concept.isPremium ? (
          <span className="absolute end-3 top-3 rounded-full bg-text/80 px-3 py-1 text-xs font-medium text-background">
            {t('premium')}
          </span>
        ) : null}
        {concept.isSelected ? (
          <span className="absolute start-3 top-3 rounded-full bg-primary px-3 py-1 text-xs font-medium text-background">
            {t('selected')}
          </span>
        ) : null}
        <button
          type="button"
          onClick={onToggleFavorite}
          disabled={pending}
          aria-pressed={favorite}
          aria-label={favorite ? t('favorited') : t('favorite')}
          className="absolute bottom-3 end-3 rounded-full bg-background/90 px-3 py-1 text-xs text-text"
        >
          {favorite ? `♥ ${t('favorited')}` : `♡ ${t('favorite')}`}
        </button>
      </div>
      <div className="flex flex-col gap-2 p-4 text-center">
        <h2 className="font-display text-xl text-text">{concept.title}</h2>
        {concept.tagline ? <p className="text-sm text-muted">{concept.tagline}</p> : null}
        <div className="mt-1 flex justify-center gap-1.5">
          {concept.palette.map((hex, i) => (
            <span key={i} className="h-4 w-4 rounded-full border border-muted/20" style={{ backgroundColor: hex }} />
          ))}
        </div>
      </div>
    </Link>
  );
}
