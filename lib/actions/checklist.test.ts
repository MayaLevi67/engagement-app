import { describe, it, expect, afterEach, vi } from 'vitest';
import { prisma } from '@/lib/db';
import { getTasks } from '@/lib/checklist/queries';

let currentUserId: string | null = null;
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(async () => (currentUserId ? { user: { id: currentUserId } } : null)),
}));

import {
  setTaskStatus,
  editTask,
  softDeleteTask,
  restoreTask,
  permanentlyDeleteTask,
  addCustomTask,
  setTaskReminder,
} from './checklist';

async function makeUserWithWedding(email: string) {
  const wedding = await prisma.wedding.create({ data: {} });
  const user = await prisma.user.create({ data: { email, weddingId: wedding.id } });
  return { userId: user.id, weddingId: wedding.id };
}

async function makeTask(weddingId: string, overrides: Record<string, unknown> = {}) {
  return prisma.task.create({
    data: {
      weddingId,
      title_en: 'Book venue',
      title_he: 'הזמנת אולם',
      category: 'VENUE',
      priority: 'MEDIUM',
      ...overrides,
    },
  });
}

afterEach(async () => {
  await prisma.task.deleteMany();
  await prisma.checklistTemplate.deleteMany();
  await prisma.user.deleteMany();
  await prisma.wedding.deleteMany();
  currentUserId = null;
});

describe('setTaskStatus', () => {
  it('marks a task done and stamps completedAt', async () => {
    const { userId, weddingId } = await makeUserWithWedding('a@example.com');
    currentUserId = userId;
    const task = await makeTask(weddingId);

    expect(await setTaskStatus(task.id, true)).toEqual({ ok: true });
    const after = await prisma.task.findUnique({ where: { id: task.id } });
    expect(after?.status).toBe('DONE');
    expect(after?.completedAt).toBeInstanceOf(Date);
  });

  it('reopens a task and clears completedAt', async () => {
    const { userId, weddingId } = await makeUserWithWedding('b@example.com');
    currentUserId = userId;
    const task = await makeTask(weddingId, { status: 'DONE', completedAt: new Date() });

    expect(await setTaskStatus(task.id, false)).toEqual({ ok: true });
    const after = await prisma.task.findUnique({ where: { id: task.id } });
    expect(after?.status).toBe('OPEN');
    expect(after?.completedAt).toBeNull();
  });

  it('rejects unauthenticated callers', async () => {
    const { weddingId } = await makeUserWithWedding('c@example.com');
    const task = await makeTask(weddingId);
    currentUserId = null;
    expect(await setTaskStatus(task.id, true)).toEqual({ ok: false, error: 'UNAUTHENTICATED' });
  });
});

describe('editTask', () => {
  it('updates fields and sets dueDateOverridden when a dueDate key is present', async () => {
    const { userId, weddingId } = await makeUserWithWedding('d@example.com');
    currentUserId = userId;
    const task = await makeTask(weddingId, { dueOffsetDays: 180 });

    const res = await editTask(task.id, {
      title_en: 'Book the grand hall',
      priority: 'HIGH',
      dueDate: new Date('2027-05-01'),
    });
    expect(res).toEqual({ ok: true });
    const after = await prisma.task.findUnique({ where: { id: task.id } });
    expect(after?.title_en).toBe('Book the grand hall');
    expect(after?.priority).toBe('HIGH');
    expect(after?.dueDate?.getTime()).toBe(new Date('2027-05-01').getTime());
    expect(after?.dueDateOverridden).toBe(true);
  });

  it('does not set dueDateOverridden when dueDate is absent from input', async () => {
    const { userId, weddingId } = await makeUserWithWedding('e@example.com');
    currentUserId = userId;
    const task = await makeTask(weddingId);

    expect(await editTask(task.id, { title_en: 'Renamed' })).toEqual({ ok: true });
    const after = await prisma.task.findUnique({ where: { id: task.id } });
    expect(after?.title_en).toBe('Renamed');
    expect(after?.dueDateOverridden).toBe(false);
  });

  it('sets dueDateOverridden when dueDate is explicitly cleared (null)', async () => {
    const { userId, weddingId } = await makeUserWithWedding('f@example.com');
    currentUserId = userId;
    const task = await makeTask(weddingId, { dueDate: new Date('2027-01-01'), dueOffsetDays: 100 });

    expect(await editTask(task.id, { dueDate: null })).toEqual({ ok: true });
    const after = await prisma.task.findUnique({ where: { id: task.id } });
    expect(after?.dueDate).toBeNull();
    expect(after?.dueDateOverridden).toBe(true);
  });

  it('rejects invalid input', async () => {
    const { userId, weddingId } = await makeUserWithWedding('g@example.com');
    currentUserId = userId;
    const task = await makeTask(weddingId);
    expect(await editTask(task.id, { priority: 'NOT_A_PRIORITY' })).toEqual({ ok: false, error: 'INVALID' });
  });
});

describe('soft delete / restore / permanent delete', () => {
  it('softDeleteTask sets deletedAt and excludes it from getTasks', async () => {
    const { userId, weddingId } = await makeUserWithWedding('h@example.com');
    currentUserId = userId;
    const task = await makeTask(weddingId);

    expect(await softDeleteTask(task.id)).toEqual({ ok: true });
    const after = await prisma.task.findUnique({ where: { id: task.id } });
    expect(after?.deletedAt).toBeInstanceOf(Date);
    const visible = await getTasks(weddingId);
    expect(visible.some((t) => t.id === task.id)).toBe(false);
  });

  it('restoreTask clears deletedAt', async () => {
    const { userId, weddingId } = await makeUserWithWedding('i@example.com');
    currentUserId = userId;
    const task = await makeTask(weddingId, { deletedAt: new Date() });

    expect(await restoreTask(task.id)).toEqual({ ok: true });
    const after = await prisma.task.findUnique({ where: { id: task.id } });
    expect(after?.deletedAt).toBeNull();
    const visible = await getTasks(weddingId);
    expect(visible.some((t) => t.id === task.id)).toBe(true);
  });

  it('permanentlyDeleteTask removes the row', async () => {
    const { userId, weddingId } = await makeUserWithWedding('j@example.com');
    currentUserId = userId;
    const task = await makeTask(weddingId, { deletedAt: new Date() });

    expect(await permanentlyDeleteTask(task.id)).toEqual({ ok: true });
    const after = await prisma.task.findUnique({ where: { id: task.id } });
    expect(after).toBeNull();
  });
});

describe('addCustomTask', () => {
  it('creates a custom task with appended sortOrder', async () => {
    const { userId, weddingId } = await makeUserWithWedding('k@example.com');
    currentUserId = userId;
    await makeTask(weddingId, { sortOrder: 5 });

    const res = await addCustomTask({
      title_en: 'Order fireworks',
      category: 'OTHER',
      priority: 'LOW',
      dueDate: new Date('2027-06-01'),
    });
    expect(res).toEqual({ ok: true });
    const created = await prisma.task.findFirst({ where: { weddingId, title_en: 'Order fireworks' } });
    expect(created?.isCustom).toBe(true);
    expect(created?.sourceTemplateId).toBeNull();
    expect(created?.sortOrder).toBe(6);
    expect(created?.dueDate?.getTime()).toBe(new Date('2027-06-01').getTime());
    expect(created?.dueDateOverridden).toBe(true);
  });

  it('starts sortOrder at 0 when the wedding has no tasks', async () => {
    const { userId, weddingId } = await makeUserWithWedding('l@example.com');
    currentUserId = userId;
    expect(await addCustomTask({ title_en: 'First task' })).toEqual({ ok: true });
    const created = await prisma.task.findFirst({ where: { weddingId, title_en: 'First task' } });
    expect(created?.sortOrder).toBe(0);
    expect(created?.dueDateOverridden).toBe(false);
  });

  it('rejects a custom task with no title', async () => {
    const { userId } = await makeUserWithWedding('m@example.com');
    currentUserId = userId;
    expect(await addCustomTask({ category: 'OTHER' })).toEqual({ ok: false, error: 'INVALID' });
  });

  it('returns NOT_FOUND when the caller has no wedding', async () => {
    const user = await prisma.user.create({ data: { email: 'n@example.com' } });
    currentUserId = user.id;
    expect(await addCustomTask({ title_en: 'X' })).toEqual({ ok: false, error: 'NOT_FOUND' });
  });
});

describe('setTaskReminder', () => {
  it('enables a reminder with a remindAt', async () => {
    const { userId, weddingId } = await makeUserWithWedding('o@example.com');
    currentUserId = userId;
    const task = await makeTask(weddingId);
    const when = new Date('2027-04-01');

    expect(await setTaskReminder(task.id, true, when)).toEqual({ ok: true });
    const after = await prisma.task.findUnique({ where: { id: task.id } });
    expect(after?.reminderEnabled).toBe(true);
    expect(after?.remindAt?.getTime()).toBe(when.getTime());
  });

  it('disables a reminder and clears remindAt', async () => {
    const { userId, weddingId } = await makeUserWithWedding('p@example.com');
    currentUserId = userId;
    const task = await makeTask(weddingId, { reminderEnabled: true, remindAt: new Date() });

    expect(await setTaskReminder(task.id, false)).toEqual({ ok: true });
    const after = await prisma.task.findUnique({ where: { id: task.id } });
    expect(after?.reminderEnabled).toBe(false);
    expect(after?.remindAt).toBeNull();
  });
});

describe('cross-tenant ownership isolation', () => {
  it('user B cannot edit, mutate, or delete user A\'s task', async () => {
    const a = await makeUserWithWedding('tenant-a@example.com');
    currentUserId = a.userId;
    const taskA = await makeTask(a.weddingId, { title_en: 'Ann task', priority: 'LOW' });

    const b = await makeUserWithWedding('tenant-b@example.com');
    currentUserId = b.userId;

    // Every task-targeted action must refuse and leave A's task untouched.
    expect(await setTaskStatus(taskA.id, true)).toEqual({ ok: false, error: 'NOT_FOUND' });
    expect(await editTask(taskA.id, { title_en: 'Hacked', dueDate: new Date() })).toEqual({ ok: false, error: 'NOT_FOUND' });
    expect(await softDeleteTask(taskA.id)).toEqual({ ok: false, error: 'NOT_FOUND' });
    expect(await restoreTask(taskA.id)).toEqual({ ok: false, error: 'NOT_FOUND' });
    expect(await setTaskReminder(taskA.id, true, new Date())).toEqual({ ok: false, error: 'NOT_FOUND' });
    expect(await permanentlyDeleteTask(taskA.id)).toEqual({ ok: false, error: 'NOT_FOUND' });

    const after = await prisma.task.findUnique({ where: { id: taskA.id } });
    expect(after).not.toBeNull();
    expect(after?.title_en).toBe('Ann task');
    expect(after?.priority).toBe('LOW');
    expect(after?.status).toBe('OPEN');
    expect(after?.completedAt).toBeNull();
    expect(after?.deletedAt).toBeNull();
    expect(after?.reminderEnabled).toBe(false);
    expect(after?.weddingId).toBe(a.weddingId);
  });

  it('returns NOT_FOUND for a task id that does not exist', async () => {
    const { userId } = await makeUserWithWedding('q@example.com');
    currentUserId = userId;
    expect(await setTaskStatus('nonexistent-id', true)).toEqual({ ok: false, error: 'NOT_FOUND' });
  });
});
