import { describe, it, expect } from 'vitest';
import { authConfig } from './config';

describe('auth providers', () => {
  it('registers both Google and Credentials providers', () => {
    const ids = authConfig.providers.map((p) =>
      typeof p === 'function' ? p().id : p.id,
    );
    expect(ids).toContain('google');
    expect(ids).toContain('credentials');
  });
});
