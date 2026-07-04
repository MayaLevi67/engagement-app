'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/lib/i18n/navigation';
import { requestPasswordReset } from '@/lib/actions/reset-password';

export function ForgotForm() {
  const t = useTranslations('Auth');
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    try {
      // Always show the neutral message regardless of the outcome, to avoid
      // revealing whether the email is registered.
      await requestPasswordReset(email);
    } catch {
      // Swallow unexpected errors — the neutral message is shown either way.
    } finally {
      setSent(true);
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-sm bg-surface rounded-card p-8 shadow-sm">
      <h1 className="font-display text-2xl text-text text-center mb-6">
        {t('forgotTitle')}
      </h1>
      {sent ? (
        <p className="text-sm text-text font-body">{t('resetEmailSent')}</p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 font-body">
          <div className="flex flex-col gap-1">
            <label htmlFor="email" className="text-sm text-muted">
              {t('emailLabel')}
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-card border border-muted/30 bg-background px-3 py-2 text-text"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-card bg-primary px-4 py-2 text-background font-medium disabled:opacity-60"
          >
            {t('sendResetButton')}
          </button>
        </form>
      )}
      <div className="mt-6 flex flex-col items-center gap-2 text-sm">
        <Link href="/login" className="text-primary">
          {t('toLogin')}
        </Link>
      </div>
    </div>
  );
}
