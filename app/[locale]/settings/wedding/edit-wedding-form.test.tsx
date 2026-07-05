import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';
import type { ActionResult } from '@/lib/actions/onboarding';

const { updateWeddingProfile } = vi.hoisted(() => ({
  updateWeddingProfile: vi.fn<(input: unknown) => Promise<ActionResult>>(async () => ({ ok: true })),
}));

vi.mock('@/lib/actions/onboarding', () => ({
  updateWeddingProfile,
}));

import { EditWeddingForm } from './edit-wedding-form';
import type { OnboardingInitialData } from '@/app/[locale]/onboarding/onboarding-wizard';

const initial: OnboardingInitialData = {
  partner1Name: 'Maya',
  partner2Name: 'Asaf',
  weddingDate: null,
  dateIsApproximate: false,
  guestCount: undefined,
  budgetTotal: undefined,
  city: '',
  venueSetting: undefined,
  ceremonyType: undefined,
  priorities: [],
};

function renderForm(overrides: Partial<OnboardingInitialData> = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <EditWeddingForm initial={{ ...initial, ...overrides }} />
    </NextIntlClientProvider>,
  );
}

describe('EditWeddingForm', () => {
  beforeEach(() => {
    updateWeddingProfile.mockClear();
  });

  it('saves an edited field via updateWeddingProfile and shows a confirmation', async () => {
    renderForm();

    const input = screen.getByLabelText(en.WeddingProfile.partner1Name);
    fireEvent.change(input, { target: { value: 'Maya Cohen' } });

    const saveButton = screen.getByRole('button', { name: en.WeddingSettings.save });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(updateWeddingProfile).toHaveBeenCalledWith(
        expect.objectContaining({ partner1Name: 'Maya Cohen' }),
      );
    });

    await screen.findByText(en.WeddingSettings.saved);
  });

  it('blocks submit and shows an error when partner1Name is cleared', async () => {
    renderForm();

    const input = screen.getByLabelText(en.WeddingProfile.partner1Name);
    fireEvent.change(input, { target: { value: '' } });

    const saveButton = screen.getByRole('button', { name: en.WeddingSettings.save });
    expect(saveButton).toBeDisabled();

    fireEvent.click(saveButton);

    expect(updateWeddingProfile).not.toHaveBeenCalled();
  });

  it('shows an error message when the action reports failure', async () => {
    updateWeddingProfile.mockResolvedValueOnce({ ok: false, error: 'INVALID' });
    renderForm();

    const saveButton = screen.getByRole('button', { name: en.WeddingSettings.save });
    fireEvent.click(saveButton);

    await screen.findByText(en.WeddingSettings.error);
  });
});
