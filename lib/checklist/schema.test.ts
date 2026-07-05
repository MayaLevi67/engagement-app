import { describe, it, expect } from 'vitest';
import { customTaskSchema, taskEditSchema, templateSchema } from './schema';

describe('customTaskSchema', () => {
  it('rejects when both titles are empty', () => {
    const result = customTaskSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('accepts when at least one title is present', () => {
    const result = customTaskSchema.safeParse({ title_en: 'Book venue' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.category).toBe('OTHER');
      expect(result.data.priority).toBe('MEDIUM');
    }
  });
});

describe('templateSchema', () => {
  it('requires both title_en and title_he', () => {
    const missingHe = templateSchema.safeParse({ title_en: 'Book venue', category: 'VENUE' });
    expect(missingHe.success).toBe(false);

    const missingEn = templateSchema.safeParse({ title_he: 'להזמין אולם', category: 'VENUE' });
    expect(missingEn.success).toBe(false);

    const both = templateSchema.safeParse({
      title_en: 'Book venue',
      title_he: 'להזמין אולם',
      category: 'VENUE',
    });
    expect(both.success).toBe(true);
    if (both.success) {
      expect(both.data.titleLocale).toBe('AUTO');
      expect(both.data.priority).toBe('MEDIUM');
      expect(both.data.active).toBe(true);
      expect(both.data.sortOrder).toBe(0);
    }
  });
});

describe('taskEditSchema', () => {
  it('accepts a null dueDate to clear it', () => {
    const result = taskEditSchema.safeParse({ dueDate: null });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dueDate).toBeNull();
    }
  });

  it('accepts an empty object (all fields optional)', () => {
    const result = taskEditSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});
