'use server';

import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/auth/password';
import { sendPasswordResetEmail } from '@/lib/email/resend';

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function requestPasswordReset(
  email: string,
): Promise<{ ok: true }> {
  const user = await prisma.user.findUnique({ where: { email } });

  // Always return ok to avoid leaking which emails are registered.
  if (!user) return { ok: true };

  const token = randomBytes(32).toString('hex');
  await prisma.verificationToken.create({
    data: {
      identifier: email,
      token,
      expires: new Date(Date.now() + TOKEN_TTL_MS),
    },
  });

  const resetUrl = `${process.env.APP_URL}/reset-password?token=${token}`;
  await sendPasswordResetEmail(email, resetUrl);

  return { ok: true };
}

const resetSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});

type ResetResult =
  | { ok: true }
  | { ok: false; error: 'INVALID_TOKEN' | 'EXPIRED' | 'INVALID' };

export async function performPasswordReset(input: {
  token: string;
  password: string;
}): Promise<ResetResult> {
  const parsed = resetSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'INVALID' };

  const record = await prisma.verificationToken.findUnique({
    where: { token: parsed.data.token },
  });
  if (!record) return { ok: false, error: 'INVALID_TOKEN' };

  if (record.expires < new Date()) {
    await prisma.verificationToken.delete({
      where: { token: parsed.data.token },
    });
    return { ok: false, error: 'EXPIRED' };
  }

  await prisma.user.update({
    where: { email: record.identifier },
    data: { passwordHash: await hashPassword(parsed.data.password) },
  });

  // Consume all outstanding tokens for this identifier.
  await prisma.verificationToken.deleteMany({
    where: { identifier: record.identifier },
  });

  return { ok: true };
}
