'use client';

import { useTranslations } from 'next-intl';

interface DoneStepProps {
  partner1Name: string;
}

export function DoneStep({ partner1Name }: DoneStepProps) {
  const t = useTranslations('Onboarding');

  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-text">
        {partner1Name ? t('doneSummaryNamed', { name: partner1Name }) : t('doneSummary')}
      </p>
    </div>
  );
}
