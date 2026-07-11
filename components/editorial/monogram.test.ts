import { describe, it, expect } from 'vitest';
import { monogram } from './monogram';
describe('monogram', () => {
  it('joins first initials', () => { expect(monogram('Maya', 'Asaf')).toBe('M & A'); });
  it('handles Hebrew initials', () => { expect(monogram('מיה', 'אסף')).toBe('מ & א'); });
  it('one name', () => { expect(monogram('Maya', null)).toBe('M'); });
  it('no names', () => { expect(monogram(null, null)).toBe(''); });
});
