import type { PayerRole } from '@prisma/client';

export interface PayerNames {
  partner1Name: string | null;
  partner2Name: string | null;
}
export interface PayerLabels {
  both: string;
  other: string;
  partner1: string;
  partner2: string;
  partner1Family: string;
  partner2Family: string;
  family: (name: string) => string;
}

export function payerDisplayName(
  role: PayerRole,
  payerLabel: string | null,
  names: PayerNames,
  labels: PayerLabels,
): string {
  switch (role) {
    case 'PARTNER_1':
      return names.partner1Name?.trim() || labels.partner1;
    case 'PARTNER_2':
      return names.partner2Name?.trim() || labels.partner2;
    case 'PARTNER_1_FAMILY':
      return names.partner1Name?.trim() ? labels.family(names.partner1Name.trim()) : labels.partner1Family;
    case 'PARTNER_2_FAMILY':
      return names.partner2Name?.trim() ? labels.family(names.partner2Name.trim()) : labels.partner2Family;
    case 'BOTH':
      return labels.both;
    case 'OTHER':
      return payerLabel?.trim() || labels.other;
  }
}

const ROLE_ORDER: PayerRole[] = ['PARTNER_1', 'PARTNER_2', 'BOTH', 'PARTNER_1_FAMILY', 'PARTNER_2_FAMILY', 'OTHER'];

export function payerOptions(names: PayerNames, labels: PayerLabels): { role: PayerRole; label: string }[] {
  return ROLE_ORDER.map((role) => ({ role, label: payerDisplayName(role, null, names, labels) }));
}
