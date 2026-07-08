'use client';

import { useState } from 'react';
import { signOut } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/lib/i18n/navigation';

export function LogoutButton({ className }: { className?: string }) {
  const t = useTranslations('Auth');
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleLogout() {
    setPending(true);
    try {
      await signOut({ redirect: false });
      router.push('/login');
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={pending}
      className={
        className ??
        'rounded-card px-3 py-2 text-sm text-text hover:bg-surface disabled:opacity-60'
      }
    >
      {t('logout')}
    </button>
  );
}
