'use client';
/* eslint-disable react/jsx-no-literals -- dev-only testing tool, deliberately not translated */

import { useState } from 'react';
import { useRouter } from '@/lib/i18n/navigation';
import { devSetPremium } from '@/lib/actions/dev-premium';

export function DevPremiumToggle({ premium }: { premium: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function toggle() {
    setPending(true);
    try {
      await devSetPremium(!premium);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex items-center gap-2 rounded-card border border-dashed border-muted/40 bg-background px-3 py-2 text-xs text-muted">
      <span className="font-mono uppercase tracking-wide">dev</span>
      <span>premium: {premium ? 'on' : 'off'}</span>
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        className="rounded-card bg-muted/20 px-2 py-1 font-medium text-text hover:bg-muted/30 disabled:opacity-60"
      >
        {premium ? 'Revoke (dev)' : 'Grant (dev)'}
      </button>
    </div>
  );
}
