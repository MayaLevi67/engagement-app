'use server';

import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/auth/password';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).optional(),
});

type RegisterResult =
  | { ok: true }
  | { ok: false; error: 'EMAIL_TAKEN' | 'INVALID' };

export async function registerUser(input: {
  email: string;
  password: string;
  name?: string;
}): Promise<RegisterResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'INVALID' };

  const existing = await prisma.user.findUnique({
    where: { email: parsed.data.email },
  });
  if (existing) return { ok: false, error: 'EMAIL_TAKEN' };

  try {
    await prisma.user.create({
      data: {
        email: parsed.data.email,
        name: parsed.data.name,
        passwordHash: await hashPassword(parsed.data.password),
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return { ok: false, error: 'EMAIL_TAKEN' };
    }
    throw err;
  }

  return { ok: true };
}
