import { describe, it, expect } from 'vitest';
import { resolveTaskTitle } from './title';

const base = { title_en: 'Book venue', title_he: 'להזמין אולם' };
describe('resolveTaskTitle', () => {
  it('AUTO uses he for he locale, en for en locale', () => {
    expect(resolveTaskTitle({ ...base, titleLocale: 'AUTO' }, 'he')).toBe('להזמין אולם');
    expect(resolveTaskTitle({ ...base, titleLocale: 'AUTO' }, 'en')).toBe('Book venue');
  });
  it('EN/HE pin regardless of locale', () => {
    expect(resolveTaskTitle({ ...base, titleLocale: 'EN' }, 'he')).toBe('Book venue');
    expect(resolveTaskTitle({ ...base, titleLocale: 'HE' }, 'en')).toBe('להזמין אולם');
  });
  it('falls back to the other side when the chosen one is empty', () => {
    expect(resolveTaskTitle({ title_en: '', title_he: 'רק עברית', titleLocale: 'AUTO' }, 'en')).toBe('רק עברית');
  });
});
