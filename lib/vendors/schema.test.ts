import { describe, it, expect } from 'vitest';
import { vendorSchema, privateVendorSchema, vendorImageSchema, quoteInput } from './schema';

describe('vendorSchema', () => {
  const base = { name_en: 'Lumière', name_he: 'לומייר', category: 'PHOTOGRAPHY' };
  it('accepts valid input and defaults flags', () => {
    const r = vendorSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) { expect(r.data.active).toBe(true); expect(r.data.verified).toBe(false); }
  });
  it('rejects an inverted price range', () => {
    expect(vendorSchema.safeParse({ ...base, priceMin: 9000, priceMax: 1000 }).success).toBe(false);
  });
  it('rejects an unknown category and empty name', () => {
    expect(vendorSchema.safeParse({ ...base, category: 'NOPE' }).success).toBe(false);
    expect(vendorSchema.safeParse({ ...base, name_he: '' }).success).toBe(false);
  });
  it('rejects a malformed website but accepts a bare phone', () => {
    expect(vendorSchema.safeParse({ ...base, website: 'not-a-url' }).success).toBe(false);
    expect(vendorSchema.safeParse({ ...base, phone: '+972500000000' }).success).toBe(true);
  });
});

describe('privateVendorSchema', () => {
  it('accepts a lightweight couple vendor', () => {
    expect(privateVendorSchema.safeParse({ name_en: 'Cousin Dan DJ', name_he: 'דן', category: 'MUSIC' }).success).toBe(true);
  });
});

describe('quoteInput', () => {
  it('validates status + non-negative integer amount', () => {
    expect(quoteInput.safeParse({ status: 'BOOKED', amount: 8000 }).success).toBe(true);
    expect(quoteInput.safeParse({ status: 'NOPE' }).success).toBe(false);
    expect(quoteInput.safeParse({ status: 'QUOTED', amount: -5 }).success).toBe(false);
    expect(quoteInput.safeParse({ status: 'QUOTED', amount: 10.5 }).success).toBe(false);
  });
});

describe('vendorImageSchema', () => {
  it('requires a URL', () => {
    expect(vendorImageSchema.safeParse({ url: '' }).success).toBe(false);
    expect(vendorImageSchema.safeParse({ url: 'https://x.test/a.jpg' }).success).toBe(true);
  });
});
