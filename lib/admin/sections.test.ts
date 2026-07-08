import { describe, it, expect } from 'vitest';
import { ADMIN_SECTIONS, activeSectionKey } from './sections';

describe('ADMIN_SECTIONS', () => {
  it('lists the overview + four CMSes', () => {
    expect(ADMIN_SECTIONS.map((s) => s.key)).toEqual([
      'overview', 'checklist-templates', 'concepts', 'budget-templates', 'vendors',
    ]);
  });
});

describe('activeSectionKey', () => {
  it('matches the overview exactly (with and without /en)', () => {
    expect(activeSectionKey('/admin')).toBe('overview');
    expect(activeSectionKey('/en/admin')).toBe('overview');
  });
  it('matches a CMS section and its sub-paths', () => {
    expect(activeSectionKey('/admin/concepts')).toBe('concepts');
    expect(activeSectionKey('/en/admin/vendors/abc')).toBe('vendors');
  });
  it('returns null for an unknown path', () => {
    expect(activeSectionKey('/dashboard')).toBeNull();
  });
});
