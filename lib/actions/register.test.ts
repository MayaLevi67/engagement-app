import { describe, it, expect, afterEach } from 'vitest';
import { prisma } from '@/lib/db';
import { verifyPassword } from '@/lib/auth/password';
import { registerUser } from './register';

afterEach(async () => {
  await prisma.user.deleteMany();
});

describe('registerUser', () => {
  it('creates a USER with a hashed password', async () => {
    const result = await registerUser({
      email: 'new@example.com',
      password: 'pw12345678',
      name: 'New Person',
    });
    expect(result.ok).toBe(true);

    const user = await prisma.user.findUnique({
      where: { email: 'new@example.com' },
    });
    expect(user?.role).toBe('USER');
    expect(user?.passwordHash).toBeTruthy();
    expect(await verifyPassword('pw12345678', user!.passwordHash!)).toBe(true);
  });

  it('rejects a duplicate email', async () => {
    await registerUser({ email: 'dupe@example.com', password: 'pw12345678' });
    const result = await registerUser({
      email: 'dupe@example.com',
      password: 'pw12345678',
    });
    expect(result).toEqual({ ok: false, error: 'EMAIL_TAKEN' });
  });

  it('rejects an invalid input', async () => {
    const result = await registerUser({ email: 'not-an-email', password: 'x' });
    expect(result).toEqual({ ok: false, error: 'INVALID' });
  });
});
