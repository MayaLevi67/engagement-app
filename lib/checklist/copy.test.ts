import { describe, it, expect, afterEach } from 'vitest';
import { prisma } from '@/lib/db';
import { seedTasksForWedding, recomputeDueDates, computeDueDate } from './copy';

afterEach(async () => {
  await prisma.task.deleteMany();
  await prisma.wedding.deleteMany();
  await prisma.checklistTemplate.deleteMany();
});

async function seedTemplates() {
  await prisma.checklistTemplate.createMany({ data: [
    { title_en: 'A', title_he: 'א', category: 'VENUE', priority: 'HIGH', dueOffsetDays: 100, sortOrder: 1, active: true },
    { title_en: 'B', title_he: 'ב', category: 'MUSIC', priority: 'LOW', dueOffsetDays: null, sortOrder: 2, active: true },
    { title_en: 'C-inactive', title_he: 'ג', category: 'OTHER', priority: 'LOW', sortOrder: 3, active: false },
  ]});
}

describe('copy engine', () => {
  it('computeDueDate subtracts offset days from the wedding date', () => {
    const wd = new Date('2026-12-01T00:00:00Z');
    expect(computeDueDate(wd, 10)?.toISOString().slice(0,10)).toBe('2026-11-21');
    expect(computeDueDate(wd, null)).toBeNull();
    expect(computeDueDate(null, 10)).toBeNull();
  });

  it('seeds only active templates as snapshots with computed due dates, once', async () => {
    await seedTemplates();
    const w = await prisma.wedding.create({ data: { weddingDate: new Date('2026-12-01T00:00:00Z') } });
    await seedTasksForWedding(w.id);
    const tasks = await prisma.task.findMany({ where: { weddingId: w.id }, orderBy: { sortOrder: 'asc' } });
    expect(tasks).toHaveLength(2); // inactive excluded
    expect(tasks[0].title_he).toBe('א');
    expect(tasks[0].dueDate?.toISOString().slice(0,10)).toBe('2026-08-23'); // 100 days before
    expect(tasks[1].dueDate).toBeNull(); // no offset
    const w2 = await prisma.wedding.findUnique({ where: { id: w.id } });
    expect(w2?.tasksSeededAt).toBeInstanceOf(Date);
    // idempotent
    await seedTasksForWedding(w.id);
    expect(await prisma.task.count({ where: { weddingId: w.id } })).toBe(2);
  });

  it('editing a template after seeding does NOT change existing tasks (snapshot)', async () => {
    await seedTemplates();
    const w = await prisma.wedding.create({ data: {} });
    await seedTasksForWedding(w.id);
    const tmpl = await prisma.checklistTemplate.findFirst({ where: { title_en: 'A' } });
    await prisma.checklistTemplate.update({ where: { id: tmpl!.id }, data: { title_en: 'CHANGED' } });
    const task = await prisma.task.findFirst({ where: { weddingId: w.id, sourceTemplateId: tmpl!.id } });
    expect(task?.title_en).toBe('A'); // unchanged
  });

  it('recompute updates non-overridden derived due dates; leaves overridden ones', async () => {
    await seedTemplates();
    const w = await prisma.wedding.create({ data: { weddingDate: new Date('2026-12-01T00:00:00Z') } });
    await seedTasksForWedding(w.id);
    // override one task's due date
    const a = await prisma.task.findFirst({ where: { weddingId: w.id, title_en: 'A' } });
    await prisma.task.update({ where: { id: a!.id }, data: { dueDate: new Date('2027-01-01'), dueDateOverridden: true } });
    // change wedding date + recompute
    await prisma.wedding.update({ where: { id: w.id }, data: { weddingDate: new Date('2027-06-01T00:00:00Z') } });
    await recomputeDueDates(w.id);
    const a2 = await prisma.task.findFirst({ where: { id: a!.id } });
    expect(a2?.dueDate?.toISOString().slice(0,10)).toBe('2027-01-01'); // overridden kept
  });
});
