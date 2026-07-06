'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ConceptForm, type SerializedAdminConcept } from './concept-form';
import { deleteConcept } from '@/lib/actions/admin-concepts';

export type { SerializedAdminConcept };

function conceptLabel(c: SerializedAdminConcept): string {
  const premiumSuffix = c.isPremium ? ' · ★' : '';
  const inactiveSuffix = c.active ? '' : ' · (inactive)';
  return `${c.title_en} / ${c.title_he}${premiumSuffix}${inactiveSuffix}`;
}

export function ConceptsAdmin({ concepts }: { concepts: SerializedAdminConcept[] }) {
  const t = useTranslations('AdminConcepts');
  const router = useRouter();
  const [editing, setEditing] = useState<SerializedAdminConcept | null>(null);
  const [creating, setCreating] = useState(false);

  function refresh() {
    setEditing(null);
    setCreating(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center justify-between">
        <h1 className="font-display text-2xl text-text">{t('title')}</h1>
        <button
          type="button"
          onClick={() => {
            setCreating(true);
            setEditing(null);
          }}
          className="rounded-card bg-primary px-4 py-2 text-sm font-medium text-background"
        >
          {t('new')}
        </button>
      </header>

      {creating ? <ConceptForm concept={null} onSaved={refresh} onCancel={() => setCreating(false)} /> : null}

      <ul className="flex flex-col gap-2">
        {concepts.map((c) => (
          <li key={c.id} className="rounded-card bg-surface p-3">
            {editing?.id === c.id ? (
              <ConceptForm concept={c} onSaved={refresh} onCancel={() => setEditing(null)} />
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-sm text-text">{conceptLabel(c)}</span>
                <span className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(c);
                      setCreating(false);
                    }}
                    className="text-sm text-muted"
                  >
                    {t('edit')}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await deleteConcept(c.id);
                      refresh();
                    }}
                    className="text-sm text-red-600"
                  >
                    {t('delete')}
                  </button>
                </span>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
