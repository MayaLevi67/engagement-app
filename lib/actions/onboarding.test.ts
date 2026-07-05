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
  await prisma.task.deleteMany();
  await prisma.checklistTemplate.deleteMany();
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

  it('updateWeddingProfile clears a previously-set field to null (empty -> null)', async () => {
    currentUserId = await makeUser('f@example.com');
    await saveNames({ partner1Name: 'Maya', partner2Name: 'Asaf' });

    // First set nullable scalars.
    const set = await updateWeddingProfile({
      partner1Name: 'Maya',
      partner2Name: 'Asaf',
      city: 'Tel Aviv',
      weddingDate: new Date('2027-05-01'),
      guestCount: 200,
      budgetTotal: 150000,
      venueSetting: 'OUTDOOR',
      ceremonyType: 'CIVIL',
      priorities: ['FOOD'],
    });
    expect(set).toEqual({ ok: true });
    const before = await prisma.user.findUnique({ where: { id: currentUserId! }, include: { wedding: true } });
    expect(before?.wedding?.city).toBe('Tel Aviv');
    expect(before?.wedding?.weddingDate).toBeInstanceOf(Date);

    // Now clear them: empty/blank must persist null, not leave unchanged.
    const cleared = await updateWeddingProfile({
      partner1Name: 'Maya',
      partner2Name: null,
      city: null,
      weddingDate: null,
      guestCount: null,
      budgetTotal: null,
      venueSetting: null,
      ceremonyType: null,
      priorities: [],
    });
    expect(cleared).toEqual({ ok: true });
    const after = await prisma.user.findUnique({ where: { id: currentUserId! }, include: { wedding: true } });
    expect(after?.wedding?.city).toBeNull();
    expect(after?.wedding?.weddingDate).toBeNull();
    expect(after?.wedding?.partner2Name).toBeNull();
    expect(after?.wedding?.guestCount).toBeNull();
    expect(after?.wedding?.budgetTotal).toBeNull();
    expect(after?.wedding?.venueSetting).toBeNull();
    expect(after?.wedding?.ceremonyType).toBeNull();
    expect(after?.wedding?.priorities).toEqual([]);
    // partner1Name (required) is untouched.
    expect(after?.wedding?.partner1Name).toBe('Maya');
  });

  it('saveStep clears a date set on a prior step (weddingDate -> null)', async () => {
    currentUserId = await makeUser('g@example.com');
    await saveNames({ partner1Name: 'Maya' });
    await saveStep('date', { weddingDate: new Date('2027-08-08'), dateIsApproximate: false });
    const before = await prisma.user.findUnique({ where: { id: currentUserId! }, include: { wedding: true } });
    expect(before?.wedding?.weddingDate).toBeInstanceOf(Date);

    expect(await saveStep('date', { weddingDate: null, dateIsApproximate: false })).toEqual({ ok: true });
    const after = await prisma.user.findUnique({ where: { id: currentUserId! }, include: { wedding: true } });
    expect(after?.wedding?.weddingDate).toBeNull();
  });

  it('partner1Name stays required: empty is rejected and leaves state unchanged', async () => {
    currentUserId = await makeUser('h@example.com');
    await saveNames({ partner1Name: 'Maya' });
    expect(await updateWeddingProfile({ partner1Name: '', priorities: [] })).toEqual({ ok: false, error: 'INVALID' });
    const u = await prisma.user.findUnique({ where: { id: currentUserId! }, include: { wedding: true } });
    expect(u?.wedding?.partner1Name).toBe('Maya');
  });

  it('completeOnboarding seeds tasks from active checklist templates', async () => {
    await prisma.checklistTemplate.create({
      data: {
        title_en: 'Book venue', title_he: 'הזמנת אולם',
        category: 'VENUE', dueOffsetDays: 180, active: true, sortOrder: 1,
      },
    });
    currentUserId = await makeUser('i@example.com');
    await saveNames({ partner1Name: 'Maya' });
    expect(await completeOnboarding()).toEqual({ ok: true });
    const u = await prisma.user.findUnique({ where: { id: currentUserId! }, include: { wedding: true } });
    const tasks = await prisma.task.findMany({ where: { weddingId: u!.wedding!.id } });
    expect(tasks.length).toBeGreaterThanOrEqual(1);
    expect(tasks.some((t) => t.title_en === 'Book venue')).toBe(true);
  });

  it('updateWeddingProfile recomputes due dates for already-seeded tasks when weddingDate changes', async () => {
    await prisma.checklistTemplate.create({
      data: {
        title_en: 'Book venue', title_he: 'הזמנת אולם',
        category: 'VENUE', dueOffsetDays: 180, active: true, sortOrder: 1,
      },
    });
    currentUserId = await makeUser('j@example.com');
    await saveNames({ partner1Name: 'Maya' });
    await completeOnboarding();

    const res = await updateWeddingProfile({ partner1Name: 'Maya', priorities: [], weddingDate: new Date('2027-06-01') });
    expect(res).toEqual({ ok: true });

    const u = await prisma.user.findUnique({ where: { id: currentUserId! }, include: { wedding: true } });
    const task = await prisma.task.findFirst({ where: { weddingId: u!.wedding!.id, title_en: 'Book venue' } });
    expect(task?.dueDate).toBeInstanceOf(Date);
    expect(task?.dueDate?.getTime()).toBe(new Date('2027-06-01').getTime() - 180 * 24 * 60 * 60 * 1000);
  });
});
