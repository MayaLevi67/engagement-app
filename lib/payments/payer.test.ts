import { describe, it, expect } from 'vitest';
import { payerDisplayName, payerOptions, type PayerLabels } from './payer';

const labels: PayerLabels = {
  both: 'Both', other: 'Other', partner1: 'Partner 1', partner2: 'Partner 2',
  partner1Family: "Partner 1's family", partner2Family: "Partner 2's family",
  family: (name) => `${name}'s family`,
};

describe('payerDisplayName', () => {
  const names = { partner1Name: 'Maya', partner2Name: 'Asaf' };
  it('resolves partner names', () => {
    expect(payerDisplayName('PARTNER_1', null, names, labels)).toBe('Maya');
    expect(payerDisplayName('PARTNER_2', null, names, labels)).toBe('Asaf');
  });
  it('resolves families via the name template', () => {
    expect(payerDisplayName('PARTNER_1_FAMILY', null, names, labels)).toBe("Maya's family");
  });
  it('falls back when a name is blank', () => {
    expect(payerDisplayName('PARTNER_1', null, { partner1Name: null, partner2Name: null }, labels)).toBe('Partner 1');
    expect(payerDisplayName('PARTNER_1_FAMILY', null, { partner1Name: null, partner2Name: null }, labels)).toBe("Partner 1's family");
  });
  it('BOTH and OTHER', () => {
    expect(payerDisplayName('BOTH', null, names, labels)).toBe('Both');
    expect(payerDisplayName('OTHER', 'Grandma', names, labels)).toBe('Grandma');
    expect(payerDisplayName('OTHER', null, names, labels)).toBe('Other');
  });
});

describe('payerOptions', () => {
  it('returns all six roles with resolved labels', () => {
    const opts = payerOptions({ partner1Name: 'Maya', partner2Name: 'Asaf' }, labels);
    expect(opts.map((o) => o.role)).toEqual(['PARTNER_1', 'PARTNER_2', 'BOTH', 'PARTNER_1_FAMILY', 'PARTNER_2_FAMILY', 'OTHER']);
    expect(opts[0].label).toBe('Maya');
  });
});
