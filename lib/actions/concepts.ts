'use server';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getCurrentWedding } from '@/lib/wedding/queries';
import { elementToTaskPayload } from '@/lib/concepts/queries';
import { isPremium } from '@/lib/premium/entitlement';

export type ConceptActionResult =
  | { ok: true }
  | { ok: false; error: 'UNAUTHENTICATED' | 'INVALID' | 'NOT_FOUND' | 'PREMIUM_REQUIRED' };

export async function chooseConcept(conceptId: string): Promise<ConceptActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: 'UNAUTHENTICATED' };
  const wedding = await getCurrentWedding(session.user.id);
  if (!wedding) return { ok: false, error: 'NOT_FOUND' };
  const concept = await prisma.concept.findUnique({
    where: { id: conceptId },
    select: { id: true, active: true, isPremium: true },
  });
  if (!concept || !concept.active) return { ok: false, error: 'NOT_FOUND' };
  if (concept.isPremium && !isPremium(wedding)) return { ok: false, error: 'PREMIUM_REQUIRED' };
  await prisma.wedding.update({
    where: { id: wedding.id },
    data: { selectedConceptId: conceptId },
  });
  return { ok: true };
}

export async function clearSelectedConcept(): Promise<ConceptActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: 'UNAUTHENTICATED' };
  const wedding = await getCurrentWedding(session.user.id);
  if (!wedding) return { ok: false, error: 'NOT_FOUND' };
  await prisma.wedding.update({
    where: { id: wedding.id },
    data: { selectedConceptId: null },
  });
  return { ok: true };
}

export async function toggleFavorite(conceptId: string): Promise<ConceptActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: 'UNAUTHENTICATED' };
  const wedding = await getCurrentWedding(session.user.id);
  if (!wedding) return { ok: false, error: 'NOT_FOUND' };
  const concept = await prisma.concept.findUnique({
    where: { id: conceptId },
    select: { id: true, active: true },
  });
  if (!concept || !concept.active) return { ok: false, error: 'NOT_FOUND' };
  // Idempotent via @@unique([weddingId, conceptId]); the compound selector also
  // scopes the row to the caller's own wedding.
  const existing = await prisma.conceptFavorite.findUnique({
    where: { weddingId_conceptId: { weddingId: wedding.id, conceptId } },
  });
  if (existing) {
    await prisma.conceptFavorite.delete({ where: { id: existing.id } });
  } else {
    await prisma.conceptFavorite.create({ data: { weddingId: wedding.id, conceptId } });
  }
  return { ok: true };
}

export async function addElementToChecklist(elementId: string): Promise<ConceptActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: 'UNAUTHENTICATED' };
  const wedding = await getCurrentWedding(session.user.id);
  if (!wedding) return { ok: false, error: 'NOT_FOUND' };
  const element = await prisma.conceptElement.findUnique({
    where: { id: elementId },
    include: { concept: { select: { isPremium: true } } },
  });
  if (!element) return { ok: false, error: 'NOT_FOUND' };
  if (element.concept.isPremium && !isPremium(wedding)) return { ok: false, error: 'PREMIUM_REQUIRED' };
  // Add-once-while-live: no-op if a non-deleted copy already exists in THIS wedding.
  const live = await prisma.task.findFirst({
    where: { weddingId: wedding.id, deletedAt: null, sourceConceptElementId: elementId },
    select: { id: true },
  });
  if (live) return { ok: true };
  const agg = await prisma.task.aggregate({
    where: { weddingId: wedding.id },
    _max: { sortOrder: true },
  });
  const sortOrder = (agg._max.sortOrder ?? -1) + 1;
  await prisma.task.create({ data: elementToTaskPayload(wedding.id, element, sortOrder) });
  return { ok: true };
}
