import { describe, it, expect } from 'vitest';
import { resolveConceptTitle } from './title';

describe('resolveConceptTitle', () => {
  const item = { title_en: 'Old Money', title_he: 'אלגנטיות קלאסית', titleLocale: 'AUTO' as const };

  it('defaults to the couple locale under AUTO', () => {
    expect(resolveConceptTitle(item, 'he')).toBe('אלגנטיות קלאסית');
    expect(resolveConceptTitle(item, 'en')).toBe('Old Money');
  });

  it('honors a pinned locale regardless of UI language', () => {
    expect(resolveConceptTitle({ ...item, titleLocale: 'EN' }, 'he')).toBe('Old Money');
    expect(resolveConceptTitle({ ...item, titleLocale: 'HE' }, 'en')).toBe('אלגנטיות קלאסית');
  });

  it('falls back to the other language when the primary is empty', () => {
    expect(resolveConceptTitle({ title_en: '', title_he: 'רק עברית', titleLocale: 'AUTO' }, 'en')).toBe('רק עברית');
  });
});
