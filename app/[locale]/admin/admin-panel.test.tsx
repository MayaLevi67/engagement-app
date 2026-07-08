import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';

vi.mock('@/lib/i18n/navigation', () => ({
  Link: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>{children}</a>
  ),
  usePathname: () => '/admin/concepts',
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('next-auth/react', () => ({ signOut: vi.fn(async () => undefined) }));

import { AdminNav } from './admin-nav';

describe('AdminNav', () => {
  it('renders all sections and marks the active one', () => {
    render(<NextIntlClientProvider locale="en" messages={en}><AdminNav /></NextIntlClientProvider>);
    expect(screen.getByText('Overview')).toBeTruthy();
    expect(screen.getByText('Concepts')).toBeTruthy();
    const active = screen.getByText('Concepts').closest('a');
    expect(active?.getAttribute('aria-current')).toBe('page');
  });
});
