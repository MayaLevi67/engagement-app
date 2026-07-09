import { prisma } from '@/lib/db';

export function getTasks(weddingId: string) {
  return prisma.task.findMany({
    where: { weddingId, deletedAt: null },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    include: { payments: { orderBy: { createdAt: 'asc' } } },
  });
}

export function getTrashedTasks(weddingId: string) {
  return prisma.task.findMany({
    where: { weddingId, deletedAt: { not: null } },
    orderBy: { deletedAt: 'desc' },
    include: { payments: { orderBy: { createdAt: 'asc' } } },
  });
}

export function getTemplates() {
  return prisma.checklistTemplate.findMany({ orderBy: { sortOrder: 'asc' } });
}
