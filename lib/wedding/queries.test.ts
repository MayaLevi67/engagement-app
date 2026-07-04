import { describe, it, expect, afterEach } from 'vitest';
import { prisma } from '@/lib/db';
import { getCurrentWedding } from './queries';

afterEach(async () => {
  await prisma.user.deleteMany();
  await prisma.wedding.deleteMany();
});

describe('getCurrentWedding', () => {
  it('returns the wedding linked to the user', async () => {
    const wedding = await prisma.wedding.create({
      data: { partner1Name: 'Maya', priorities: ['FOOD', 'PARTY'] },
    });
    const user = await prisma.user.create({
      data: { email: 'a@example.com', weddingId: wedding.id },
    });
    const result = await getCurrentWedding(user.id);
    expect(result?.id).toBe(wedding.id);
    expect(result?.partner1Name).toBe('Maya');
    expect(result?.priorities).toEqual(['FOOD', 'PARTY']);
  });

  it('returns null when the user has no wedding', async () => {
    const user = await prisma.user.create({ data: { email: 'b@example.com' } });
    expect(await getCurrentWedding(user.id)).toBeNull();
  });
});
