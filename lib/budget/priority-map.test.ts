import { describe, it, expect } from 'vitest';
import { priorityBoostFor, PRIORITY_BOOST } from './priority-map';

describe('priorityBoostFor', () => {
  it('returns 1 when the category is not a priority', () => {
    expect(priorityBoostFor('VENUE', ['FOOD'])).toBe(1);
  });

  it('boosts the mapped category (FOOD → CATERING)', () => {
    expect(priorityBoostFor('CATERING', ['FOOD'])).toBe(PRIORITY_BOOST);
  });

  it('maps DESIGN to both DESIGN and FLOWERS', () => {
    expect(priorityBoostFor('DESIGN', ['DESIGN'])).toBe(PRIORITY_BOOST);
    expect(priorityBoostFor('FLOWERS', ['DESIGN'])).toBe(PRIORITY_BOOST);
  });

  it('compounds when two priorities hit the same category', () => {
    expect(priorityBoostFor('CATERING', ['FOOD', 'FOOD'])).toBe(PRIORITY_BOOST * PRIORITY_BOOST);
  });
});
