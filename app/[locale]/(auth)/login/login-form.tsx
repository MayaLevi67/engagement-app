'use client';

import { useState, type FormEvent } from 'react';
import { signIn } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/lib/i18n/navigation';

export function LoginForm() {
  const t = useTranslations('Auth');
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });
      if (result?.error) {
        setError(t('invalidCredentials'));
        return;
      }
      router.push('/dashboard');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-sm bg-surface rounded-card p-8 shadow-sm">
      <h1 className="font-display text-2xl text-text text-center mb-6">
        {t('loginTitle')}
      </h1>
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
        <div className="flex flex-col gap-1">
          <label htmlFor="password" className="text-sm text-muted">
            {t('passwordLabel')}
          </label>
          <input
            id="password"
            type="password"
            required
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
          {t('signInButton')}
        </button>
      </form>
      <button
        type="button"
        onClick={() => signIn('google', { redirectTo: '/dashboard' })}
        className="mt-3 w-full rounded-card border border-muted/30 px-4 py-2 text-text font-body"
      >
        {t('googleButton')}
      </button>
      <div className="mt-6 flex flex-col items-center gap-2 text-sm">
        <Link href="/forgot-password" className="text-primary">
          {t('forgotLink')}
        </Link>
        <Link href="/register" className="text-primary">
          {t('toRegister')}
        </Link>
      </div>
    </div>
  );
}
