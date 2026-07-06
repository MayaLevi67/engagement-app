'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { GiftEstimate } from '@/lib/budget/gifts';
import { setAvgGiftPerGuest } from '@/lib/actions/budget';

export function GiftEstimatorCard({
  locale, avgGiftPerGuest, guestCount, gift, onChanged,
}: {
  locale: string; avgGiftPerGuest: number | null; guestCount: number | null;
  gift: GiftEstimate; onChanged: () => void;
}) {
  const t = useTranslations('Budget');
  const [value, setValue] = useState(avgGiftPerGuest != null ? String(avgGiftPerGuest) : '');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const fmt = (n: number) => `₪${n.toLocaleString(locale)}`;
  const guestsLine = guestCount != null
    ? `${t('giftGuestsLabel')}: ${guestCount} · ${t('giftTotalLabel')}: ${fmt(gift.estimatedGifts)}`
    : '';

  async function save() {
    setError(false);
    setPending(true);
    const amount = value === '' ? null : Math.trunc(Number(value));
    const result = await setAvgGiftPerGuest(amount);
    setPending(false);
    if (!result.ok) { setError(true); return; }
    onChanged();
  }

  return (
    <section className="rounded-card bg-surface p-5 shadow-sm">
      <h2 className="font-display text-lg text-text">{t('giftTitle')}</h2>
      {guestCount == null ? (
        <p className="mt-1 text-sm text-muted">{t('giftNeedsGuests')}</p>
      ) : (
        <div className="mt-2 flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm text-muted" htmlFor="gift-avg">{t('giftAvgLabel')}</label>
            <input
              id="gift-avg" type="number" min="0" dir="ltr" value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-32 rounded-card border border-muted/30 bg-background px-3 py-2 text-sm text-text"
            />
            <button type="button" disabled={pending} onClick={save}
              className="rounded-card bg-primary px-3 py-1.5 text-sm text-background disabled:opacity-60">
              {t('save')}
            </button>
          </div>
          <p className="text-sm text-muted">
            {guestsLine}
          </p>
          {gift.delta != null ? (
            <p className="text-sm text-text">
              {gift.delta >= 0
                ? `${t('giftSurplus')}: ${fmt(gift.delta)}`
                : `${t('giftShortfall')}: ${fmt(Math.abs(gift.delta))}`}
            </p>
          ) : null}
          {error ? <span className="text-sm text-red-600">{t('error')}</span> : null}
        </div>
      )}
    </section>
  );
}
