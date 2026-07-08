'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { startCheckout } from '@/lib/actions/premium';

export function UpgradeButton({ className }: { className?: string }) {
  const t = useTranslations('Premium');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  async function go() {
    setError(false);
    setPending(true);
    const r = await startCheckout();
    if (r.ok) {
      window.location.href = r.url; // redirect to Stripe hosted Checkout
      return;
    }
    setPending(false);
    setError(true);
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={go}
        className={className ?? 'rounded-card bg-primary px-4 py-2 text-sm font-medium text-background disabled:opacity-60'}
      >
        {t('unlockCta')}
      </button>
      {error ? <span className="text-sm text-red-600">{t('checkoutError')}</span> : null}
    </div>
  );
}
