import { describe, it, expect } from 'vitest';
import { categoryToken, payerToken } from './chart-palette';

describe('categoryToken', () => {
  it('is stable per category (same category → same token) and green/burgundy tokens', () => {
    const a = categoryToken('VENUE');
    const b = categoryToken('VENUE');
    expect(a).toBe(b);
    expect(a).toMatch(/^chart-([1-9]|1[0-2])$/);
    expect(categoryToken('CATERING')).not.toBe(categoryToken('VENUE'));
  });
});

describe('payerToken', () => {
  it('maps the six base roles to fixed tokens', () => {
    expect(payerToken('PARTNER_1', null)).toBe('chart-1');
    expect(payerToken('OTHER', null)).toBe('chart-6');
  });

  it('distinct OTHER labels get distinct deterministic tokens', () => {
    const g = payerToken('OTHER', 'Grandma');
    const u = payerToken('OTHER', 'Uncle');
    expect(g).not.toBe(u);
    expect(payerToken('OTHER', 'Grandma')).toBe(g); // stable
  });
});
