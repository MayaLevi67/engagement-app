import { describe, it, expect } from 'vitest';
import { routing } from './routing';

describe('i18n routing config', () => {
  it('supports he and en with he as the default', () => {
    expect(routing.locales).toEqual(['he', 'en']);
    expect(routing.defaultLocale).toBe('he');
  });

  it('keeps the default locale unprefixed', () => {
    expect(routing.localePrefix).toBe('as-needed');
  });
});
