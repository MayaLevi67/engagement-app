'use client';

import { useTranslations } from 'next-intl';
import { ConceptCard, type SerializedConcept } from './concept-card';

export type { SerializedConcept };

export function ConceptsGallery({ concepts }: { locale: string; concepts: SerializedConcept[] }) {
  const t = useTranslations('Concepts');
  return (
    <div className="flex flex-col gap-6">
      <header className="text-center">
        <h1 className="font-display text-3xl text-text">{t('title')}</h1>
        <p className="mt-2 text-sm text-muted">{t('subtitle')}</p>
      </header>
      {concepts.length === 0 ? (
        <p className="text-center text-sm text-muted">{t('empty')}</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {concepts.map((c) => (
            <ConceptCard key={c.id} concept={c} />
          ))}
        </div>
      )}
    </div>
  );
}
