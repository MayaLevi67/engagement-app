'use client';

import { useTranslations, useLocale } from 'next-intl';
import { VENUE_OPTIONS, CEREMONY_OPTIONS } from '@/lib/wedding/profile-fields';
import type { VenueSetting, CeremonyType } from '@prisma/client';

export interface StyleStepValues {
  city: string;
  venueSetting?: VenueSetting;
  ceremonyType?: CeremonyType;
}

interface StyleStepProps extends StyleStepValues {
  onChange: (patch: Partial<StyleStepValues>) => void;
}

export function StyleStep({ city, venueSetting, ceremonyType, onChange }: StyleStepProps) {
  const t = useTranslations('WeddingProfile');
  const locale = useLocale();
  const dir = locale === 'he' ? 'rtl' : 'ltr';

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-1">
        <label htmlFor="city" className="text-sm text-muted">
          {t('city')}
        </label>
        <input
          id="city"
          type="text"
          dir={dir}
          value={city}
          onChange={(e) => onChange({ city: e.target.value })}
          className="w-full rounded-card border border-muted/30 bg-background px-3 py-2 text-center text-text"
        />
      </div>

      <div className="flex flex-col items-center gap-2">
        <span className="text-sm text-muted">{t('venueSetting')}</span>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {VENUE_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onChange({ venueSetting: option })}
              aria-pressed={venueSetting === option}
              className={
                venueSetting === option
                  ? 'rounded-card border border-primary bg-primary px-4 py-2 text-sm text-background'
                  : 'rounded-card border border-muted/30 px-4 py-2 text-sm text-text'
              }
            >
              {t(`venue.${option}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col items-center gap-2">
        <span className="text-sm text-muted">{t('ceremonyType')}</span>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {CEREMONY_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onChange({ ceremonyType: option })}
              aria-pressed={ceremonyType === option}
              className={
                ceremonyType === option
                  ? 'rounded-card border border-primary bg-primary px-4 py-2 text-sm text-background'
                  : 'rounded-card border border-muted/30 px-4 py-2 text-sm text-text'
              }
            >
              {t(`ceremony.${option}`)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
