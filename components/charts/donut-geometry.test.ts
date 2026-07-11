import { describe, it, expect } from 'vitest';
import { donutSegments, arcPath } from './donut-geometry';

describe('donutSegments', () => {
  it('two equal values → two 50% halves from -90', () => {
    const s = donutSegments([50, 50]);
    expect(s).toHaveLength(2);
    expect(s[0].percent).toBeCloseTo(0.5);
    expect(s[0].start).toBeCloseTo(-90);
    expect(s[0].end).toBeCloseTo(90);
    expect(s[1].end).toBeCloseTo(270);
  });

  it('single value → one full ring', () => {
    expect(donutSegments([10])[0].percent).toBe(1);
  });

  it('zero total → empty', () => {
    expect(donutSegments([0, 0])).toEqual([]);
  });
});

describe('arcPath', () => {
  it('returns a well-formed ring-segment path', () => {
    const d = arcPath(50, 50, 45, 28, -90, 0);
    expect(d.startsWith('M')).toBe(true);
    expect(d).toContain('A'); // arc commands
    expect(d.trim().endsWith('Z')).toBe(true);
  });
});
