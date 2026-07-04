import { describe, it, expect, afterEach } from 'vitest';
import { prisma } from './db';

afterEach(async () => {
  await prisma.user.deleteMany();
  await prisma.wedding.deleteMany();
});

describe('database layer', () => {
  it('creates a user with the default USER role and he locale', async () => {
    const user = await prisma.user.create({
      data: { email: 'a@example.com' },
    });
    expect(user.role).toBe('USER');
    expect(user.locale).toBe('he');
  });

  it('links multiple users to one wedding (couple sharing)', async () => {
    const wedding = await prisma.wedding.create({ data: {} });
    await prisma.user.create({
      data: { email: 'partner1@example.com', weddingId: wedding.id },
    });
    await prisma.user.create({
      data: { email: 'partner2@example.com', weddingId: wedding.id },
    });

    const withMembers = await prisma.wedding.findUnique({
      where: { id: wedding.id },
      include: { members: true },
    });
    expect(withMembers?.members).toHaveLength(2);
  });
});
