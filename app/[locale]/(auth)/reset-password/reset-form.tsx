'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/lib/i18n/navigation';
import { performPasswordReset } from '@/lib/actions/reset-password';

export function ResetForm({ token }: { token: string }) {
  const t = useTranslations('Auth');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await performPasswordReset({ token, password });
      if (!result.ok) {
        const messages = {
          INVALID_TOKEN: t('invalidToken'),
          EXPIRED: t('expiredToken'),
          INVALID: t('invalidInput'),
        } as const;
        setError(messages[result.error]);
        return;
      }
      setSuccess(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-sm bg-surface rounded-card p-8 shadow-sm">
      <h1 className="font-display text-2xl text-text text-center mb-6">
        {t('resetTitle')}
      </h1>
      {success ? (
        <div className="flex flex-col items-center gap-3 font-body">
          <p className="text-sm text-text">{t('resetSuccess')}</p>
          <Link href="/login" className="text-primary text-sm">
            {t('toLogin')}
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 font-body">
          <div className="flex flex-col gap-1">
            <label htmlFor="password" className="text-sm text-muted">
              {t('passwordLabel')}
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-card border border-muted/30 bg-background px-3 py-2 text-text"
            />
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button
            type="submit"
            disabled={submitting}
            className="rounded-card bg-primary px-4 py-2 text-background font-medium disabled:opacity-60"
          >
            {t('setPasswordButton')}
          </button>
        </form>
      )}
    </div>
  );
}
