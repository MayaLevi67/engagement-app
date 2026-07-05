import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';

const { push, saveNames, saveStep, completeOnboarding } = vi.hoisted(() => ({
  push: vi.fn(),
  saveNames: vi.fn(async () => ({ ok: true })),
  saveStep: vi.fn(async () => ({ ok: true })),
  completeOnboarding: vi.fn(async () => ({ ok: true })),
}));

vi.mock('@/lib/i18n/navigation', () => ({
  useRouter: () => ({ push }),
}));

vi.mock('@/lib/actions/onboarding', () => ({
  saveNames,
  saveStep,
  completeOnboarding,
}));

import { OnboardingWizard } from './onboarding-wizard';
import type { OnboardingInitialData } from './onboarding-wizard';

const initial: OnboardingInitialData = {
  partner1Name: '',
  partner2Name: '',
  weddingDate: null,
  dateIsApproximate: false,
  guestCount: undefined,
  budgetTotal: undefined,
  city: '',
  venueSetting: undefined,
  ceremonyType: undefined,
  priorities: [],
};

function renderWizard(overrides: Partial<OnboardingInitialData> = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <OnboardingWizard initial={{ ...initial, ...overrides }} defaultPartner1="" />
    </NextIntlClientProvider>,
  );
}

describe('OnboardingWizard', () => {
  beforeEach(() => {
    push.mockClear();
    saveNames.mockClear();
    saveStep.mockClear();
    completeOnboarding.mockClear();
  });

  it('blocks Continue on the names step when partner1Name is empty', () => {
    renderWizard();
    const continueButton = screen.getByRole('button', { name: en.Onboarding.continue });
    expect(continueButton).toBeDisabled();
  });

  it('enables Continue once a name is entered, and advances after saveNames', async () => {
    renderWizard();
    const input = screen.getByLabelText(en.WeddingProfile.partner1Name);
    fireEvent.change(input, { target: { value: 'Maya' } });

    const continueButton = screen.getByRole('button', { name: en.Onboarding.continue });
    expect(continueButton).not.toBeDisabled();

    fireEvent.click(continueButton);

    await waitFor(() => {
      expect(saveNames).toHaveBeenCalledWith(
        expect.objectContaining({ partner1Name: 'Maya' }),
      );
    });

    // Advanced to the date step.
    await screen.findByText(en.Onboarding.stepDate);
  });

  it('Skip on the date step advances without persisting the entered input', async () => {
    renderWizard({ partner1Name: 'Maya' });

    // Names step is prefilled/valid; continue to the date step.
    const continueButton = screen.getByRole('button', { name: en.Onboarding.continue });
    fireEvent.click(continueButton);
    await waitFor(() => expect(saveNames).toHaveBeenCalled());
    await screen.findByText(en.Onboarding.stepDate);

    const dateInput = screen.getByLabelText(en.WeddingProfile.weddingDate);
    fireEvent.change(dateInput, { target: { value: '2027-06-01' } });

    const skipButton = screen.getByRole('button', { name: en.Onboarding.skip });
    fireEvent.click(skipButton);

    await screen.findByText(en.Onboarding.stepSizeBudget);
    expect(saveStep).not.toHaveBeenCalled();
  });
});
