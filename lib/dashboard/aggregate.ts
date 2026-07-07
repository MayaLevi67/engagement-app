import type { TaskStatus, TitleLocale, VendorQuoteStatus, Wedding } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getTasks } from '@/lib/checklist/queries';
import { getWeddingQuotes } from '@/lib/vendors/queries';
import { rollupTasks } from '@/lib/budget/rollup';

export interface ChecklistSummary { done: number; total: number; pct: number; overdue: number }
export interface BudgetSummary { total: number; committed: number; remaining: number; pct: number }
export interface VendorCounts { shortlisted: number; booked: number }
export interface ConceptSummary {
  id: string; title_en: string; title_he: string; titleLocale: TitleLocale; palette: string[];
}
export interface NextUpTask {
  id: string; title_en: string; title_he: string; titleLocale: TitleLocale;
  dueDate: string | null; overdue: boolean;
}
export interface DashboardData {
  partner1Name: string | null;
  partner2Name: string | null;
  weddingDate: string | null;
  countdownDays: number | null;
  dateIsApproximate: boolean;
  checklist: ChecklistSummary;
  budget: BudgetSummary | null;
  vendors: VendorCounts;
  concept: ConceptSummary | null;
  nextUp: NextUpTask[];
}

// UTC-based so day counts / overdue are deterministic regardless of the host
// timezone (matches the repo's TZ-independent date math, e.g. computeDueDate).
function startOfDay(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** Whole days from `now` to `weddingDate` (0 = today, negative = past); null if no date. */
export function daysUntilWedding(weddingDate: Date | null, now: Date): number | null {
  if (!weddingDate) return null;
  const ms = startOfDay(weddingDate) - startOfDay(now);
  return Math.round(ms / 86_400_000);
}

type ProgressTask = { status: TaskStatus; dueDate: Date | null; deletedAt: Date | null };

export function checklistProgress(tasks: ProgressTask[], now: Date): ChecklistSummary {
  const active = tasks.filter((t) => !t.deletedAt);
  const total = active.length;
  const done = active.filter((t) => t.status === 'DONE').length;
  const today = startOfDay(now);
  const overdue = active.filter(
    (t) => t.status === 'OPEN' && t.dueDate != null && startOfDay(t.dueDate) < today,
  ).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return { done, total, pct, overdue };
}

type RollupTask = Parameters<typeof rollupTasks>[0][number];

export function budgetSummary(budgetTotal: number | null, tasks: RollupTask[]): BudgetSummary | null {
  if (budgetTotal == null) return null;
  const { committed } = rollupTasks(tasks);
  const committedTotal = Object.values(committed).reduce((s, n) => s + (n ?? 0), 0);
  const remaining = budgetTotal - committedTotal;
  const pct = budgetTotal > 0 ? Math.round((committedTotal / budgetTotal) * 100) : 0;
  return { total: budgetTotal, committed: committedTotal, remaining, pct };
}

export function vendorCounts(quotes: { status: VendorQuoteStatus }[]): VendorCounts {
  return { shortlisted: quotes.length, booked: quotes.filter((q) => q.status === 'BOOKED').length };
}

type NextUpInput = {
  id: string; title_en: string; title_he: string; titleLocale: TitleLocale;
  status: TaskStatus; dueDate: Date | null; deletedAt: Date | null;
};

export function nextUpTasks(tasks: NextUpInput[], now: Date, limit: number): NextUpTask[] {
  const today = startOfDay(now);
  const open = tasks.filter((t) => !t.deletedAt && t.status === 'OPEN');
  const sorted = [...open].sort((a, b) => {
    if (a.dueDate == null && b.dueDate == null) return 0;
    if (a.dueDate == null) return 1; // nulls last
    if (b.dueDate == null) return -1;
    return a.dueDate.getTime() - b.dueDate.getTime();
  });
  return sorted.slice(0, limit).map((t) => ({
    id: t.id,
    title_en: t.title_en,
    title_he: t.title_he,
    titleLocale: t.titleLocale,
    dueDate: t.dueDate ? t.dueDate.toISOString() : null,
    overdue: t.dueDate != null && startOfDay(t.dueDate) < today,
  }));
}

/** Compose the per-phase queries into one dashboard payload. `now` is injected for testability. */
export async function getDashboardData(wedding: Wedding, now: Date): Promise<DashboardData> {
  const [tasks, quotes, concept] = await Promise.all([
    getTasks(wedding.id),
    getWeddingQuotes(wedding.id),
    wedding.selectedConceptId
      ? prisma.concept.findUnique({
          where: { id: wedding.selectedConceptId },
          select: { id: true, title_en: true, title_he: true, titleLocale: true, palette: true },
        })
      : Promise.resolve(null),
  ]);

  return {
    partner1Name: wedding.partner1Name,
    partner2Name: wedding.partner2Name,
    weddingDate: wedding.weddingDate ? wedding.weddingDate.toISOString() : null,
    countdownDays: daysUntilWedding(wedding.weddingDate, now),
    dateIsApproximate: wedding.dateIsApproximate,
    checklist: checklistProgress(tasks, now),
    budget: budgetSummary(wedding.budgetTotal, tasks),
    vendors: vendorCounts(quotes),
    concept: concept ?? null,
    nextUp: nextUpTasks(tasks, now, 3),
  };
}
