import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';

const { signOut } = vi.hoisted(() => ({ signOut: vi.fn(async () => undefined) }));
vi.mock('next-auth/react', () => ({ signOut }));

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('@/lib/i18n/navigation', () => ({
  useRouter: () => ({ push }),
}));

import { LogoutButton } from './logout-button';

function withIntl(ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      {ui}
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('LogoutButton', () => {
  it('renders the logout label', () => {
    withIntl(<LogoutButton />);
    expect(screen.getByRole('button', { name: en.Auth.logout })).toBeInTheDocument();
  });

  it('signs out and routes to /login on click', async () => {
    withIntl(<LogoutButton />);
    fireEvent.click(screen.getByRole('button', { name: en.Auth.logout }));
    await waitFor(() => expect(signOut).toHaveBeenCalledWith({ redirect: false }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/login'));
  });
});
