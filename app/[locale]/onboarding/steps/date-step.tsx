'use client';

import { useTranslations } from 'next-intl';

export interface DateStepValues {
  weddingDate: string | null;
  dateIsApproximate: boolean;
}

interface DateStepProps extends DateStepValues {
  onChange: (patch: Partial<DateStepValues>) => void;
}

export function DateStep({ weddingDate, dateIsApproximate, onChange }: DateStepProps) {
  const t = useTranslations('WeddingProfile');
  const dontKnowYet = weddingDate === null;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex flex-col items-center gap-1">
        <label htmlFor="weddingDate" className="text-sm text-muted">
          {t('weddingDate')}
        </label>
        <input
          id="weddingDate"
          type="date"
          dir="ltr"
          disabled={dontKnowYet}
          value={weddingDate ?? ''}
          onChange={(e) => onChange({ weddingDate: e.target.value || null })}
          className="rounded-card border border-muted/30 bg-background px-3 py-2 text-center text-text disabled:opacity-50"
        />
      </div>
      <label htmlFor="dontKnowYet" className="flex items-center gap-2 text-sm text-muted">
        <input
          id="dontKnowYet"
          type="checkbox"
          checked={dontKnowYet}
          onChange={(e) => onChange({ weddingDate: e.target.checked ? null : '' })}
        />
        {t('dontKnowYet')}
      </label>
      <label htmlFor="dateIsApproximate" className="flex items-center gap-2 text-sm text-muted">
        <input
          id="dateIsApproximate"
          type="checkbox"
          disabled={dontKnowYet}
          checked={dateIsApproximate}
          onChange={(e) => onChange({ dateIsApproximate: e.target.checked })}
        />
        {t('approximate')}
      </label>
    </div>
  );
}
