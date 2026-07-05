'use client';

import { useTranslations } from 'next-intl';

export interface SizeBudgetStepValues {
  guestCount?: number;
  budgetTotal?: number;
}

interface SizeBudgetStepProps extends SizeBudgetStepValues {
  onChange: (patch: Partial<SizeBudgetStepValues>) => void;
}

export function SizeBudgetStep({ guestCount, budgetTotal, onChange }: SizeBudgetStepProps) {
  const t = useTranslations('WeddingProfile');

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-1">
        <label htmlFor="guestCount" className="text-sm text-muted">
          {t('guestCount')}
        </label>
        <input
          id="guestCount"
          type="number"
          dir="ltr"
          min={0}
          value={guestCount ?? ''}
          onChange={(e) =>
            onChange({ guestCount: e.target.value === '' ? undefined : Number(e.target.value) })
          }
          className="w-full rounded-card border border-muted/30 bg-background px-3 py-2 text-center text-text"
        />
      </div>
      <div className="flex flex-col items-center gap-1">
        <label htmlFor="budgetTotal" className="text-sm text-muted">
          {t('budgetTotal')}
        </label>
        <input
          id="budgetTotal"
          type="number"
          dir="ltr"
          min={0}
          value={budgetTotal ?? ''}
          onChange={(e) =>
            onChange({ budgetTotal: e.target.value === '' ? undefined : Number(e.target.value) })
          }
          className="w-full rounded-card border border-muted/30 bg-background px-3 py-2 text-center text-text"
        />
      </div>
    </div>
  );
}
