import { describe, it, expect } from 'vitest';
import { cn } from './utils';

describe('cn', () => {
  it('joins truthy class names and drops falsy ones', () => {
    expect(cn('a', false, 'b', undefined, null, 'c')).toBe('a b c');
  });

  it('returns an empty string when given nothing usable', () => {
    expect(cn(false, null, undefined)).toBe('');
  });
});
