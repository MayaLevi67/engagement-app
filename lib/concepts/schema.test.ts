import { describe, it, expect } from 'vitest';
import { conceptSchema, conceptElementSchema, conceptImageSchema } from './schema';

describe('conceptSchema', () => {
  const base = { title_en: 'Old Money', title_he: 'אלגנטיות', palette: ['#7A1F2B', '#C9A227'] };

  it('accepts valid input and defaults flags', () => {
    const r = conceptSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.isPremium).toBe(false);
      expect(r.data.active).toBe(true);
      expect(r.data.titleLocale).toBe('AUTO');
    }
  });

  it('rejects a missing title', () => {
    expect(conceptSchema.safeParse({ ...base, title_he: '' }).success).toBe(false);
  });

  it('rejects a non-hex palette entry', () => {
    expect(conceptSchema.safeParse({ ...base, palette: ['red'] }).success).toBe(false);
  });
});

describe('conceptElementSchema', () => {
  const base = { title_en: 'Two DJs', title_he: 'שני תקליטנים', category: 'MUSIC' };

  it('accepts a valid element with a cost range', () => {
    expect(conceptElementSchema.safeParse({ ...base, estCostMin: 6000, estCostMax: 14000 }).success).toBe(true);
  });

  it('rejects an inverted cost range', () => {
    expect(conceptElementSchema.safeParse({ ...base, estCostMin: 14000, estCostMax: 6000 }).success).toBe(false);
  });

  it('rejects an unknown category', () => {
    expect(conceptElementSchema.safeParse({ ...base, category: 'NOPE' }).success).toBe(false);
  });
});

describe('conceptImageSchema', () => {
  it('requires a URL', () => {
    expect(conceptImageSchema.safeParse({ url: '' }).success).toBe(false);
    expect(conceptImageSchema.safeParse({ url: 'https://x.test/a.jpg' }).success).toBe(true);
  });
});
