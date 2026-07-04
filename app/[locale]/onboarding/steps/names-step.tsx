'use client';

import { useTranslations, useLocale } from 'next-intl';

export interface NamesStepValues {
  partner1Name: string;
  partner2Name: string;
}

interface NamesStepProps extends NamesStepValues {
  onChange: (patch: Partial<NamesStepValues>) => void;
}

export function NamesStep({ partner1Name, partner2Name, onChange }: NamesStepProps) {
  const t = useTranslations('WeddingProfile');
  const locale = useLocale();
  const dir = locale === 'he' ? 'rtl' : 'ltr';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-1">
        <label htmlFor="partner1Name" className="text-sm text-muted">
          {t('partner1Name')}
        </label>
        <input
          id="partner1Name"
          type="text"
          dir={dir}
          value={partner1Name}
          onChange={(e) => onChange({ partner1Name: e.target.value })}
          className="w-full rounded-card border border-muted/30 bg-background px-3 py-2 text-center text-text"
        />
      </div>
      <div className="flex flex-col items-center gap-1">
        <label htmlFor="partner2Name" className="text-sm text-muted">
          {t('partner2Name')}
        </label>
        <input
          id="partner2Name"
          type="text"
          dir={dir}
          value={partner2Name}
          onChange={(e) => onChange({ partner2Name: e.target.value })}
          className="w-full rounded-card border border-muted/30 bg-background px-3 py-2 text-center text-text"
        />
      </div>
    </div>
  );
}
