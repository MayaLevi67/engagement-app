'use server';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { getCurrentWedding } from '@/lib/wedding/queries';
import {
  namesSchema, dateSchema, sizeBudgetSchema, styleSchema, prioritiesSchema,
  fullProfileSchema, type OnboardingStepId,
} from '@/lib/wedding/profile-fields';
import type { z } from 'zod';

export type ActionResult =
  | { ok: true }
  | { ok: false; error: 'UNAUTHENTICATED' | 'INVALID' };

async function requireUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

/** Get the caller's wedding id, creating+linking a wedding if they have none. */
async function ensureWeddingId(userId: string): Promise<string> {
  const existing = await getCurrentWedding(userId);
  if (existing) return existing.id;
  const wedding = await prisma.wedding.create({ data: {} });
  await prisma.user.update({ where: { id: userId }, data: { weddingId: wedding.id } });
  return wedding.id;
}

export async function saveNames(input: unknown): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: 'UNAUTHENTICATED' };
  const parsed = namesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'INVALID' };
  const weddingId = await ensureWeddingId(userId);
  await prisma.wedding.update({ where: { id: weddingId }, data: parsed.data });
  return { ok: true };
}

const STEP_SCHEMAS: Record<Exclude<OnboardingStepId, 'names' | 'done'>, z.ZodTypeAny> = {
  date: dateSchema,
  sizeBudget: sizeBudgetSchema,
  style: styleSchema,
  priorities: prioritiesSchema,
};

export async function saveStep(step: keyof typeof STEP_SCHEMAS, input: unknown): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: 'UNAUTHENTICATED' };
  const schema = STEP_SCHEMAS[step];
  if (!schema) return { ok: false, error: 'INVALID' };
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'INVALID' };
  const weddingId = await ensureWeddingId(userId);
  await prisma.wedding.update({
    where: { id: weddingId },
    data: parsed.data as Prisma.WeddingUpdateInput,
  });
  return { ok: true };
}

export async function completeOnboarding(): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: 'UNAUTHENTICATED' };
  const weddingId = await ensureWeddingId(userId);
  await prisma.wedding.update({ where: { id: weddingId }, data: { onboardingCompletedAt: new Date() } });
  return { ok: true };
}

export async function updateWeddingProfile(input: unknown): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: 'UNAUTHENTICATED' };
  const parsed = fullProfileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'INVALID' };
  const weddingId = await ensureWeddingId(userId);
  await prisma.wedding.update({ where: { id: weddingId }, data: parsed.data });
  return { ok: true };
}
