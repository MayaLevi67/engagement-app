'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { fullProfileSchema } from '@/lib/wedding/profile-fields';
import { updateWeddingProfile } from '@/lib/actions/onboarding';
import type { OnboardingInitialData } from '@/app/[locale]/onboarding/onboarding-wizard';
import { NamesStep } from '@/app/[locale]/onboarding/steps/names-step';
import { DateStep } from '@/app/[locale]/onboarding/steps/date-step';
import { SizeBudgetStep } from '@/app/[locale]/onboarding/steps/size-budget-step';
import { StyleStep } from '@/app/[locale]/onboarding/steps/style-step';
import { PrioritiesStep } from '@/app/[locale]/onboarding/steps/priorities-step';

interface EditWeddingFormProps {
  initial: OnboardingInitialData;
}

export function EditWeddingForm({ initial }: EditWeddingFormProps) {
  const t = useTranslations('WeddingSettings');

  const [data, setData] = useState<OnboardingInitialData>({
    partner1Name: initial.partner1Name,
    partner2Name: initial.partner2Name,
    weddingDate: initial.weddingDate ? initial.weddingDate.slice(0, 10) : null,
    dateIsApproximate: initial.dateIsApproximate,
    guestCount: initial.guestCount,
    budgetTotal: initial.budgetTotal,
    city: initial.city,
    venueSetting: initial.venueSetting,
    ceremonyType: initial.ceremonyType,
    priorities: initial.priorities,
  });
  const [status, setStatus] = useState<'idle' | 'pending' | 'saved' | 'error'>('idle');

  function patch(update: Partial<typeof data>) {
    setStatus('idle');
    setData((d) => ({ ...d, ...update }));
  }

  const partner1Valid = data.partner1Name.trim().length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const payload = {
      partner1Name: data.partner1Name,
      partner2Name: data.partner2Name || undefined,
      weddingDate: data.weddingDate ? new Date(data.weddingDate) : undefined,
      dateIsApproximate: data.dateIsApproximate,
      guestCount: data.guestCount,
      budgetTotal: data.budgetTotal,
      city: data.city || undefined,
      venueSetting: data.venueSetting,
      ceremonyType: data.ceremonyType,
      priorities: data.priorities,
    };

    const parsed = fullProfileSchema.safeParse(payload);
    if (!parsed.success) {
      setStatus('error');
      return;
    }

    setStatus('pending');
    const result = await updateWeddingProfile(parsed.data);
    setStatus(result.ok ? 'saved' : 'error');
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-lg rounded-card bg-surface p-8 shadow-sm"
    >
      <h1 className="mb-6 font-display text-2xl text-text">{t('title')}</h1>

      <div className="flex flex-col gap-8 font-body">
        <NamesStep
          partner1Name={data.partner1Name}
          partner2Name={data.partner2Name}
          onChange={patch}
        />
        <hr className="border-muted/20" />
        <DateStep
          weddingDate={data.weddingDate}
          dateIsApproximate={data.dateIsApproximate}
          onChange={patch}
        />
        <hr className="border-muted/20" />
        <SizeBudgetStep guestCount={data.guestCount} budgetTotal={data.budgetTotal} onChange={patch} />
        <hr className="border-muted/20" />
        <StyleStep
          city={data.city}
          venueSetting={data.venueSetting}
          ceremonyType={data.ceremonyType}
          onChange={patch}
        />
        <hr className="border-muted/20" />
        <PrioritiesStep priorities={data.priorities} onChange={patch} />
      </div>

      {status === 'saved' ? <p className="mt-6 text-sm text-primary">{t('saved')}</p> : null}
      {status === 'error' ? <p className="mt-6 text-sm text-red-600">{t('error')}</p> : null}

      <button
        type="submit"
        disabled={status === 'pending' || !partner1Valid}
        className="mt-8 w-full rounded-card bg-primary px-4 py-2 font-medium text-background disabled:opacity-60"
      >
        {t('save')}
      </button>
    </form>
  );
}
