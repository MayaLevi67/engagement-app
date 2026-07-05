import { prisma } from '@/lib/db';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function computeDueDate(weddingDate: Date | null, dueOffsetDays: number | null): Date | null {
  if (!weddingDate || dueOffsetDays == null) return null;
  return new Date(weddingDate.getTime() - dueOffsetDays * MS_PER_DAY);
}

export async function seedTasksForWedding(weddingId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const wedding = await tx.wedding.findUnique({ where: { id: weddingId } });
    if (!wedding || wedding.tasksSeededAt) return; // idempotent
    const templates = await tx.checklistTemplate.findMany({
      where: { active: true }, orderBy: { sortOrder: 'asc' },
    });
    if (templates.length > 0) {
      await tx.task.createMany({
        data: templates.map((t) => ({
          weddingId,
          title_en: t.title_en, title_he: t.title_he, titleLocale: t.titleLocale,
          category: t.category, priority: t.priority, dueOffsetDays: t.dueOffsetDays,
          dueDate: computeDueDate(wedding.weddingDate, t.dueOffsetDays),
          sourceTemplateId: t.id, sortOrder: t.sortOrder,
        })),
      });
    }
    await tx.wedding.update({ where: { id: weddingId }, data: { tasksSeededAt: new Date() } });
  });
}

export async function recomputeDueDates(weddingId: string): Promise<void> {
  const wedding = await prisma.wedding.findUnique({ where: { id: weddingId } });
  if (!wedding) return;
  const tasks = await prisma.task.findMany({
    where: { weddingId, deletedAt: null, dueDateOverridden: false, dueOffsetDays: { not: null } },
  });
  await prisma.$transaction(
    tasks.map((t) =>
      prisma.task.update({
        where: { id: t.id },
        data: { dueDate: computeDueDate(wedding.weddingDate, t.dueOffsetDays) },
      }),
    ),
  );
}
