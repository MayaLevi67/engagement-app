import { describe, it, expect } from 'vitest';
import { elementToTaskPayload } from './queries';

describe('elementToTaskPayload', () => {
  it('maps an element into a self-contained Task snapshot payload', () => {
    const el = {
      id: 'el1', conceptId: 'c1',
      title_en: 'Two DJs', title_he: 'שני תקליטנים', titleLocale: 'AUTO' as const,
      description_en: null, description_he: null,
      category: 'MUSIC' as const, estCostMin: 6000, estCostMax: 14000,
      active: true, sortOrder: 10,
    };
    const payload = elementToTaskPayload('wed1', el, 42);
    expect(payload).toMatchObject({
      weddingId: 'wed1',
      title_en: 'Two DJs',
      title_he: 'שני תקליטנים',
      titleLocale: 'AUTO',
      category: 'MUSIC',
      dueOffsetDays: null,
      isCustom: true,
      sourceConceptElementId: 'el1',
      sortOrder: 42,
    });
  });
});
