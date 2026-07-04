import { describe, it, expect, afterEach, vi } from 'vitest';
import { prisma } from '@/lib/db';

let currentUserId: string | null = null;
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(async () => (currentUserId ? { user: { id: currentUserId } } : null)),
}));

import { saveNames, saveStep, completeOnboarding, updateWeddingProfile } from './onboarding';

async function makeUser(email: string) {
  const u = await prisma.user.create({ data: { email } });
  return u.id;
}

afterEach(async () => {
  await prisma.user.deleteMany();
  await prisma.wedding.deleteMany();
  currentUserId = null;
});

describe('onboarding actions', () => {
  it('saveNames creates and links a wedding for a user with none', async () => {
    currentUserId = await makeUser('a@example.com');
    const res = await saveNames({ partner1Name: 'Maya', partner2Name: 'Asaf' });
    expect(res).toEqual({ ok: true });
    const u = await prisma.user.findUnique({ where: { id: currentUserId! }, include: { wedding: true } });
    expect(u?.wedding?.partner1Name).toBe('Maya');
    expect(u?.wedding?.partner2Name).toBe('Asaf');
  });

  it('rejects unauthenticated callers', async () => {
    currentUserId = null;
    expect(await saveNames({ partner1Name: 'X' })).toEqual({ ok: false, error: 'UNAUTHENTICATED' });
  });

  it('rejects invalid input', async () => {
    currentUserId = await makeUser('b@example.com');
    expect(await saveNames({ partner1Name: '' })).toEqual({ ok: false, error: 'INVALID' });
  });

  it('saveStep updates the caller\'s own wedding only', async () => {
    currentUserId = await makeUser('c@example.com');
    await saveNames({ partner1Name: 'Maya' });
    const res = await saveStep('sizeBudget', { guestCount: 300, budgetTotal: 180000 });
    expect(res).toEqual({ ok: true });
    const u = await prisma.user.findUnique({ where: { id: currentUserId! }, include: { wedding: true } });
    expect(u?.wedding?.guestCount).toBe(300);
    expect(u?.wedding?.budgetTotal).toBe(180000);
  });

  it('a user cannot mutate another user\'s wedding', async () => {
    const userA = await makeUser('tenant-a@example.com');
    currentUserId = userA;
    await saveNames({ partner1Name: 'Ann' });
    const a = await prisma.user.findUnique({ where: { id: userA }, include: { wedding: true } });
    const weddingIdA = a?.wedding?.id;

    const userB = await makeUser('tenant-b@example.com');
    currentUserId = userB;
    expect(await saveStep('sizeBudget', { guestCount: 50 })).toEqual({ ok: true });

    const b = await prisma.user.findUnique({ where: { id: userB }, include: { wedding: true } });
    expect(b?.wedding?.guestCount).toBe(50);

    const aAfter = await prisma.user.findUnique({ where: { id: userA }, include: { wedding: true } });
    expect(aAfter?.wedding?.guestCount).toBeNull();
    expect(aAfter?.wedding?.id).toBe(weddingIdA);
    expect(b?.wedding?.id).not.toBe(weddingIdA);
  });

  it('completeOnboarding stamps onboardingCompletedAt', async () => {
    currentUserId = await makeUser('d@example.com');
    await saveNames({ partner1Name: 'Maya' });
    expect(await completeOnboarding()).toEqual({ ok: true });
    const u = await prisma.user.findUnique({ where: { id: currentUserId! }, include: { wedding: true } });
    expect(u?.wedding?.onboardingCompletedAt).toBeInstanceOf(Date);
  });

  it('updateWeddingProfile validates and saves all fields', async () => {
    currentUserId = await makeUser('e@example.com');
    await saveNames({ partner1Name: 'Maya' });
    const res = await updateWeddingProfile({ partner1Name: 'Maya', priorities: ['FOOD', 'PARTY'], city: 'Tel Aviv' });
    expect(res).toEqual({ ok: true });
    const u = await prisma.user.findUnique({ where: { id: currentUserId! }, include: { wedding: true } });
    expect(u?.wedding?.city).toBe('Tel Aviv');
    expect(u?.wedding?.priorities).toEqual(['FOOD', 'PARTY']);
  });
});
