'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/lib/i18n/navigation';
import {
  ONBOARDING_STEPS,
  namesSchema,
  type OnboardingStepId,
} from '@/lib/wedding/profile-fields';
import { saveNames, saveStep, completeOnboarding, type ActionResult } from '@/lib/actions/onboarding';
import type { VenueSetting, CeremonyType, Priority } from '@prisma/client';
import { NamesStep } from './steps/names-step';
import { DateStep } from './steps/date-step';
import { SizeBudgetStep } from './steps/size-budget-step';
import { StyleStep } from './steps/style-step';
import { PrioritiesStep } from './steps/priorities-step';
import { DoneStep } from './steps/done-step';

export interface OnboardingInitialData {
  partner1Name: string;
  partner2Name: string;
  weddingDate: string | null;
  dateIsApproximate: boolean;
  guestCount?: number;
  budgetTotal?: number;
  city: string;
  venueSetting?: VenueSetting;
  ceremonyType?: CeremonyType;
  priorities: Priority[];
}

interface WizardData {
  partner1Name: string;
  partner2Name: string;
  weddingDate: string | null; // yyyy-mm-dd, suitable for <input type="date">
  dateIsApproximate: boolean;
  guestCount?: number;
  budgetTotal?: number;
  city: string;
  venueSetting?: VenueSetting;
  ceremonyType?: CeremonyType;
  priorities: Priority[];
}

interface OnboardingWizardProps {
  initial: OnboardingInitialData;
  defaultPartner1: string;
}

type OptionalStepId = Exclude<OnboardingStepId, 'names' | 'done'>;

function pickOptionalPayload(step: OptionalStepId, data: WizardData): unknown {
  switch (step) {
    case 'date':
      return {
        weddingDate: data.weddingDate ? new Date(data.weddingDate) : null,
        dateIsApproximate: data.dateIsApproximate,
      };
    case 'sizeBudget':
      return { guestCount: data.guestCount ?? null, budgetTotal: data.budgetTotal ?? null };
    case 'style':
      return {
        city: data.city.trim() || null,
        venueSetting: data.venueSetting ?? null,
        ceremonyType: data.ceremonyType ?? null,
      };
    case 'priorities':
      return { priorities: data.priorities };
    default:
      return {};
  }
}

export function OnboardingWizard({ initial, defaultPartner1 }: OnboardingWizardProps) {
  const t = useTranslations('Onboarding');
  const router = useRouter();

  const [stepIndex, setStepIndex] = useState(0);
  const [data, setData] = useState<WizardData>({
    partner1Name: initial.partner1Name || defaultPartner1,
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
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const step = ONBOARDING_STEPS[stepIndex];
  const isFirst = stepIndex === 0;
  const isDone = step.id === 'done';
  const isOptional = !isFirst && !isDone;
  const totalSubstantiveSteps = ONBOARDING_STEPS.length - 1;

  function patch(update: Partial<WizardData>) {
    setData((d) => ({ ...d, ...update }));
  }

  function handleActionResult(result: ActionResult): boolean {
    if (result.ok) return true;
    if (result.error === 'UNAUTHENTICATED') {
      router.push('/login');
      return false;
    }
    setError(t('invalid'));
    return false;
  }

  const namesValid = namesSchema.safeParse({
    partner1Name: data.partner1Name,
    partner2Name: data.partner2Name || undefined,
  }).success;

  async function handleContinue() {
    setError(null);

    if (step.id === 'names') {
      setPending(true);
      const result = await saveNames({
        partner1Name: data.partner1Name,
        partner2Name: data.partner2Name.trim() || null,
      });
      setPending(false);
      if (handleActionResult(result)) {
        setStepIndex((i) => i + 1);
      }
      return;
    }

    const optionalStep = step.id as OptionalStepId;
    const payload = pickOptionalPayload(optionalStep, data);
    setPending(true);
    const result = await saveStep(optionalStep, payload);
    setPending(false);
    if (handleActionResult(result)) {
      setStepIndex((i) => i + 1);
    }
  }

  function handleSkip() {
    setError(null);
    setStepIndex((i) => i + 1);
  }

  function handleBack() {
    setError(null);
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  async function handleFinish() {
    setError(null);
    setPending(true);
    const result = await completeOnboarding();
    setPending(false);
    if (handleActionResult(result)) {
      router.push('/dashboard');
    }
  }

  function renderStep() {
    switch (step.id) {
      case 'names':
        return (
          <NamesStep
            partner1Name={data.partner1Name}
            partner2Name={data.partner2Name}
            onChange={patch}
          />
        );
      case 'date':
        return (
          <DateStep
            weddingDate={data.weddingDate}
            dateIsApproximate={data.dateIsApproximate}
            onChange={patch}
          />
        );
      case 'sizeBudget':
        return (
          <SizeBudgetStep guestCount={data.guestCount} budgetTotal={data.budgetTotal} onChange={patch} />
        );
      case 'style':
        return (
          <StyleStep
            city={data.city}
            venueSetting={data.venueSetting}
            ceremonyType={data.ceremonyType}
            onChange={patch}
          />
        );
      case 'priorities':
        return <PrioritiesStep priorities={data.priorities} onChange={patch} />;
      case 'done':
        return <DoneStep partner1Name={data.partner1Name} />;
      default:
        return null;
    }
  }

  return (
    <div className="flex w-full flex-col items-center justify-center">
      <div className="w-full max-w-md rounded-card bg-surface p-8 text-center shadow-sm">
        {!isDone ? (
          <p className="mb-2 text-xs uppercase tracking-wide text-muted">
            {t('progress', { current: stepIndex + 1, total: totalSubstantiveSteps })}
          </p>
        ) : null}

        <h1 className="mb-2 font-display text-2xl text-text">{t(step.titleKey)}</h1>
        <p className="mb-6 font-body text-sm text-muted">{t(`${step.titleKey}Subtitle`)}</p>

        <div className="font-body">{renderStep()}</div>

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

        <div className="mt-8 flex flex-col items-center gap-3">
          {isDone ? (
            <button
              type="button"
              disabled={pending}
              onClick={handleFinish}
              className="w-full rounded-card bg-primary px-4 py-2 font-medium text-background disabled:opacity-60"
            >
              {t('finish')}
            </button>
          ) : (
            <>
              <button
                type="button"
                disabled={pending || (step.id === 'names' && !namesValid)}
                onClick={handleContinue}
                className="w-full rounded-card bg-primary px-4 py-2 font-medium text-background disabled:opacity-60"
              >
                {t('continue')}
              </button>
              <div className="flex items-center gap-4 text-sm">
                {!isFirst ? (
                  <button type="button" disabled={pending} onClick={handleBack} className="text-muted">
                    {t('back')}
                  </button>
                ) : null}
                {isOptional ? (
                  <button type="button" disabled={pending} onClick={handleSkip} className="text-muted">
                    {t('skip')}
                  </button>
                ) : null}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
