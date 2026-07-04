import { describe, it, expect, afterEach, vi } from 'vitest';
import { prisma } from '@/lib/db';
import { verifyPassword } from '@/lib/auth/password';

vi.mock('@/lib/email/resend', () => ({
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));

import { sendPasswordResetEmail } from '@/lib/email/resend';
import {
  requestPasswordReset,
  performPasswordReset,
} from './reset-password';

afterEach(async () => {
  await prisma.verificationToken.deleteMany();
  await prisma.user.deleteMany();
  vi.clearAllMocks();
});

describe('password reset', () => {
  it('sends a reset email and stores a token for an existing user', async () => {
    await prisma.user.create({
      data: { email: 'reset@example.com', passwordHash: 'x' },
    });

    const result = await requestPasswordReset('reset@example.com');
    expect(result).toEqual({ ok: true });
    expect(sendPasswordResetEmail).toHaveBeenCalledOnce();

    const tokens = await prisma.verificationToken.findMany({
      where: { identifier: 'reset@example.com' },
    });
    expect(tokens).toHaveLength(1);
  });

  it('still returns ok and stores a token when the email send fails', async () => {
    await prisma.user.create({
      data: { email: 'reset-fail@example.com', passwordHash: 'x' },
    });
    vi.mocked(sendPasswordResetEmail).mockRejectedValueOnce(
      new Error('smtp down'),
    );
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const result = await requestPasswordReset('reset-fail@example.com');
    expect(result).toEqual({ ok: true });

    const tokens = await prisma.verificationToken.findMany({
      where: { identifier: 'reset-fail@example.com' },
    });
    expect(tokens).toHaveLength(1);

    consoleErrorSpy.mockRestore();
  });

  it('returns ok but sends nothing for an unknown email (no enumeration)', async () => {
    const result = await requestPasswordReset('ghost@example.com');
    expect(result).toEqual({ ok: true });
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('resets the password with a valid token and consumes it', async () => {
    const user = await prisma.user.create({
      data: { email: 'reset2@example.com', passwordHash: 'old' },
    });
    await requestPasswordReset('reset2@example.com');
    const token = (
      await prisma.verificationToken.findFirst({
        where: { identifier: 'reset2@example.com' },
      })
    )!.token;

    const result = await performPasswordReset({
      token,
      password: 'brandNewPw123',
    });
    expect(result).toEqual({ ok: true });

    const updated = await prisma.user.findUnique({ where: { id: user.id } });
    expect(await verifyPassword('brandNewPw123', updated!.passwordHash!)).toBe(
      true,
    );

    const remaining = await prisma.verificationToken.findMany({
      where: { identifier: 'reset2@example.com' },
    });
    expect(remaining).toHaveLength(0);
  });

  it('rejects an unknown token', async () => {
    const result = await performPasswordReset({
      token: 'does-not-exist',
      password: 'brandNewPw123',
    });
    expect(result).toEqual({ ok: false, error: 'INVALID_TOKEN' });
  });
});
