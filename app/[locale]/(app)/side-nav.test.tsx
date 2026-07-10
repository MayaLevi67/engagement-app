import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';

vi.mock('@/lib/i18n/navigation', () => ({
  Link: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  usePathname: () => '/checklist',
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('next-auth/react', () => ({ signOut: vi.fn(async () => undefined) }));

import { SideNav } from './side-nav';

function withIntl(ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe('SideNav', () => {
  it('renders every page link plus logout', () => {
    withIntl(<SideNav />);
    expect(screen.getByText(en.Nav.dashboard)).toBeInTheDocument();
    expect(screen.getByText(en.Nav.checklist)).toBeInTheDocument();
    expect(screen.getByText(en.Nav.budget)).toBeInTheDocument();
    expect(screen.getByText(en.Nav.payments)).toBeInTheDocument();
    expect(screen.getByText(en.Nav.concepts)).toBeInTheDocument();
    expect(screen.getByText(en.Nav.vendors)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: en.Auth.logout })).toBeInTheDocument();
  });

  it('marks the current page active and leaves others inactive', () => {
    withIntl(<SideNav />);
    expect(screen.getByText(en.Nav.checklist).closest('a')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText(en.Nav.budget).closest('a')).not.toHaveAttribute('aria-current');
  });
});
