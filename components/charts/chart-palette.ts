import type { TaskCategory, PayerRole } from '@prisma/client';

const CATEGORY_ORDER: TaskCategory[] = [
  'VENUE',
  'CATERING',
  'PHOTOGRAPHY',
  'MUSIC',
  'ATTIRE',
  'DESIGN',
  'FLOWERS',
  'GUESTS',
  'CEREMONY',
  'PLANNING',
  'BUDGET',
  'OTHER',
];
const N = 12;
const token = (i: number) => `chart-${(((i % N) + N) % N) + 1}`;

export function categoryToken(category: TaskCategory): string {
  const idx = CATEGORY_ORDER.indexOf(category);
  return token(idx < 0 ? N - 1 : idx);
}

const PAYER_ORDER: PayerRole[] = [
  'PARTNER_1',
  'PARTNER_2',
  'BOTH',
  'PARTNER_1_FAMILY',
  'PARTNER_2_FAMILY',
  'OTHER',
];

export function payerToken(payer: PayerRole, payerLabel: string | null): string {
  const base = PAYER_ORDER.indexOf(payer);
  if (payer !== 'OTHER' || !payerLabel) return token(base < 0 ? 5 : base);
  // Distinct OTHER labels: deterministic offset into the remaining tokens (6..11 → chart-7..12).
  let h = 0;
  for (const ch of payerLabel) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return token(6 + (h % (N - 6)));
}
