import { describe, it, expect } from 'vitest';
import { GET } from './route';

describe('inngest endpoint', () => {
  it('exposes a GET handler', () => {
    expect(typeof GET).toBe('function');
  });
});
