import { prisma } from '@/lib/db';
import type { ConceptElement, Prisma } from '@prisma/client';

export function getActiveConcepts() {
  return prisma.concept.findMany({
    where: { active: true },
    include: { images: { orderBy: { sortOrder: 'asc' } } },
    orderBy: { sortOrder: 'asc' },
  });
}

export function getAllConcepts() {
  return prisma.concept.findMany({
    include: {
      images: { orderBy: { sortOrder: 'asc' } },
      elements: { orderBy: { sortOrder: 'asc' } },
    },
    orderBy: { sortOrder: 'asc' },
  });
}

export function getConceptDetail(id: string) {
  return prisma.concept.findUnique({
    where: { id },
    include: {
      images: { orderBy: { sortOrder: 'asc' } },
      elements: { where: { active: true }, orderBy: { sortOrder: 'asc' } },
    },
  });
}

/** The couple's selection + favorites + which element ids already have a live pushed task. */
export async function getWeddingConceptState(weddingId: string): Promise<{
  selectedConceptId: string | null;
  favoriteConceptIds: string[];
  pushedElementIds: string[];
}> {
  const [wedding, favorites, pushed] = await Promise.all([
    prisma.wedding.findUnique({ where: { id: weddingId }, select: { selectedConceptId: true } }),
    prisma.conceptFavorite.findMany({ where: { weddingId }, select: { conceptId: true } }),
    prisma.task.findMany({
      where: { weddingId, deletedAt: null, sourceConceptElementId: { not: null } },
      select: { sourceConceptElementId: true },
    }),
  ]);
  return {
    selectedConceptId: wedding?.selectedConceptId ?? null,
    favoriteConceptIds: favorites.map((f) => f.conceptId),
    pushedElementIds: pushed.map((p) => p.sourceConceptElementId!),
  };
}

/** Map a concept element into a Task-create payload (self-contained snapshot). */
export function elementToTaskPayload(
  weddingId: string,
  element: Pick<ConceptElement, 'id' | 'title_en' | 'title_he' | 'titleLocale' | 'category'>,
  sortOrder: number,
): Prisma.TaskUncheckedCreateInput {
  return {
    weddingId,
    title_en: element.title_en,
    title_he: element.title_he,
    titleLocale: element.titleLocale,
    category: element.category,
    dueOffsetDays: null,
    isCustom: true,
    sourceConceptElementId: element.id,
    sortOrder,
  };
}
