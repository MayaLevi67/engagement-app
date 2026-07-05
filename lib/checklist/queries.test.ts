import { describe, it, expect, afterEach } from 'vitest';
import { prisma } from '@/lib/db';

afterEach(async () => {
  await prisma.task.deleteMany();
  await prisma.wedding.deleteMany();
  await prisma.checklistTemplate.deleteMany();
});

describe('checklist schema', () => {
  it('creates a template and a snapshot task linked to a wedding', async () => {
    const t = await prisma.checklistTemplate.create({
      data: { title_en: 'Book venue', title_he: 'להזמין אולם', category: 'VENUE', priority: 'HIGH', dueOffsetDays: 365, sortOrder: 1 },
    });
    const w = await prisma.wedding.create({ data: {} });
    const task = await prisma.task.create({
      data: {
        weddingId: w.id, title_en: t.title_en, title_he: t.title_he,
        category: t.category, priority: t.priority, dueOffsetDays: t.dueOffsetDays,
        sourceTemplateId: t.id,
      },
    });
    expect(task.status).toBe('OPEN');
    expect(task.deletedAt).toBeNull();
    const withTasks = await prisma.wedding.findUnique({ where: { id: w.id }, include: { tasks: true } });
    expect(withTasks?.tasks).toHaveLength(1);
  });
});
