import { describe, it, expect, afterEach, vi } from 'vitest';
import { prisma } from '@/lib/db';

// Control the authenticated caller. The action re-checks role against the DB,
// so tests set both the session claim and the persisted User.role.
let currentUser: { id: string; role: 'USER' | 'ADMIN' } | null = null;
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(async () => (currentUser ? { user: { id: currentUser.id, role: currentUser.role } } : null)),
}));

import {
  createTemplate,
  updateTemplate,
  deleteTemplate,
  reorderTemplate,
  setTemplateActive,
} from './admin-templates';

async function makeUser(email: string, role: 'USER' | 'ADMIN') {
  return prisma.user.create({ data: { email, role } });
}

/** Sign in as a freshly-created admin and return their id. */
async function signInAsAdmin(email = 'admin@example.com') {
  const admin = await makeUser(email, 'ADMIN');
  currentUser = { id: admin.id, role: 'ADMIN' };
  return admin.id;
}

const validTemplate = {
  title_en: 'Book venue',
  title_he: 'הזמנת אולם',
  category: 'VENUE' as const,
  priority: 'HIGH' as const,
  dueOffsetDays: 300,
  active: true,
  sortOrder: 1,
};

async function makeTemplate(overrides: Record<string, unknown> = {}) {
  return prisma.checklistTemplate.create({
    data: {
      title_en: 'Seeded template',
      title_he: 'תבנית',
      category: 'PLANNING',
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
  currentUser = null;
});

describe('admin authorization', () => {
  it('rejects a non-admin (USER) caller with FORBIDDEN and no write', async () => {
    const user = await makeUser('user@example.com', 'USER');
    currentUser = { id: user.id, role: 'USER' };

    expect(await createTemplate(validTemplate)).toEqual({ ok: false, error: 'FORBIDDEN' });
    expect(await prisma.checklistTemplate.count()).toBe(0);
  });

  it('rejects an unauthenticated caller with FORBIDDEN and no write', async () => {
    currentUser = null;
    expect(await createTemplate(validTemplate)).toEqual({ ok: false, error: 'FORBIDDEN' });
    expect(await prisma.checklistTemplate.count()).toBe(0);
  });

  it('rejects a stale-JWT admin whose DB role is USER (DB is source of truth)', async () => {
    const user = await makeUser('stale@example.com', 'USER');
    // Session still claims ADMIN, but the live DB role is USER.
    currentUser = { id: user.id, role: 'ADMIN' };
    expect(await createTemplate(validTemplate)).toEqual({ ok: false, error: 'FORBIDDEN' });
    expect(await prisma.checklistTemplate.count()).toBe(0);
  });

  it('rejects a non-admin on every mutating action with no write', async () => {
    const template = await makeTemplate();
    const user = await makeUser('user2@example.com', 'USER');
    currentUser = { id: user.id, role: 'USER' };

    expect(await createTemplate(validTemplate)).toEqual({ ok: false, error: 'FORBIDDEN' });
    expect(await updateTemplate(template.id, validTemplate)).toEqual({ ok: false, error: 'FORBIDDEN' });
    expect(await reorderTemplate(template.id, 9)).toEqual({ ok: false, error: 'FORBIDDEN' });
    expect(await setTemplateActive(template.id, false)).toEqual({ ok: false, error: 'FORBIDDEN' });
    expect(await deleteTemplate(template.id)).toEqual({ ok: false, error: 'FORBIDDEN' });

    // Template untouched, and still exactly one.
    expect(await prisma.checklistTemplate.count()).toBe(1);
    const after = await prisma.checklistTemplate.findUnique({ where: { id: template.id } });
    expect(after?.title_en).toBe('Seeded template');
    expect(after?.active).toBe(true);
  });
});

describe('createTemplate', () => {
  it('persists a template and returns its id', async () => {
    await signInAsAdmin();
    const res = await createTemplate(validTemplate);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.id).toBeTruthy();
    const created = await prisma.checklistTemplate.findUnique({ where: { id: res.id! } });
    expect(created?.title_en).toBe('Book venue');
    expect(created?.category).toBe('VENUE');
    expect(created?.dueOffsetDays).toBe(300);
  });

  it('returns INVALID on bad input', async () => {
    await signInAsAdmin();
    expect(await createTemplate({ title_en: '', category: 'NOPE' })).toEqual({ ok: false, error: 'INVALID' });
    expect(await prisma.checklistTemplate.count()).toBe(0);
  });
});

describe('updateTemplate', () => {
  it('updates an existing template', async () => {
    await signInAsAdmin();
    const template = await makeTemplate();
    const res = await updateTemplate(template.id, { ...validTemplate, title_en: 'Renamed' });
    expect(res).toEqual({ ok: true, id: template.id });
    const after = await prisma.checklistTemplate.findUnique({ where: { id: template.id } });
    expect(after?.title_en).toBe('Renamed');
    expect(after?.category).toBe('VENUE');
  });

  it('returns NOT_FOUND for a missing id', async () => {
    await signInAsAdmin();
    expect(await updateTemplate('nonexistent', validTemplate)).toEqual({ ok: false, error: 'NOT_FOUND' });
  });

  it('returns INVALID on bad input', async () => {
    await signInAsAdmin();
    const template = await makeTemplate();
    expect(await updateTemplate(template.id, { title_en: '' })).toEqual({ ok: false, error: 'INVALID' });
  });
});

describe('reorderTemplate', () => {
  it('updates sortOrder', async () => {
    await signInAsAdmin();
    const template = await makeTemplate({ sortOrder: 0 });
    expect(await reorderTemplate(template.id, 42)).toEqual({ ok: true, id: template.id });
    const after = await prisma.checklistTemplate.findUnique({ where: { id: template.id } });
    expect(after?.sortOrder).toBe(42);
  });

  it('returns NOT_FOUND for a missing id', async () => {
    await signInAsAdmin();
    expect(await reorderTemplate('nonexistent', 1)).toEqual({ ok: false, error: 'NOT_FOUND' });
  });
});

describe('setTemplateActive', () => {
  it('toggles active', async () => {
    await signInAsAdmin();
    const template = await makeTemplate({ active: true });
    expect(await setTemplateActive(template.id, false)).toEqual({ ok: true, id: template.id });
    const after = await prisma.checklistTemplate.findUnique({ where: { id: template.id } });
    expect(after?.active).toBe(false);
  });

  it('returns NOT_FOUND for a missing id', async () => {
    await signInAsAdmin();
    expect(await setTemplateActive('nonexistent', false)).toEqual({ ok: false, error: 'NOT_FOUND' });
  });
});

describe('deleteTemplate', () => {
  it('deletes the template', async () => {
    await signInAsAdmin();
    const template = await makeTemplate();
    expect(await deleteTemplate(template.id)).toEqual({ ok: true, id: template.id });
    expect(await prisma.checklistTemplate.findUnique({ where: { id: template.id } })).toBeNull();
  });

  it('returns NOT_FOUND for a missing id', async () => {
    await signInAsAdmin();
    expect(await deleteTemplate('nonexistent')).toEqual({ ok: false, error: 'NOT_FOUND' });
  });

  it('nulls sourceTemplateId on existing tasks referencing the deleted template', async () => {
    await signInAsAdmin();
    const template = await makeTemplate();
    const wedding = await prisma.wedding.create({ data: {} });
    const task = await prisma.task.create({
      data: {
        weddingId: wedding.id,
        title_en: 'Book venue',
        title_he: 'הזמנת אולם',
        category: 'VENUE',
        priority: 'MEDIUM',
        sourceTemplateId: template.id,
      },
    });

    expect(await deleteTemplate(template.id)).toEqual({ ok: true, id: template.id });

    // Task survives with provenance nulled; template is gone.
    const afterTask = await prisma.task.findUnique({ where: { id: task.id } });
    expect(afterTask).not.toBeNull();
    expect(afterTask?.sourceTemplateId).toBeNull();
    expect(afterTask?.title_en).toBe('Book venue');
    expect(await prisma.checklistTemplate.findUnique({ where: { id: template.id } })).toBeNull();
  });
});
