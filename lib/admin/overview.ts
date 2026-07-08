import { prisma } from '@/lib/db';

export interface AdminOverview {
  checklistTemplates: { total: number; active: number };
  concepts: { total: number; active: number };
  vendors: { total: number; active: number };
  budget: { sum: number; balanced: boolean };
}

/** Sum active baseline percentages and flag whether they total exactly 100. */
export function budgetBaselineStatus(rows: { defaultPercent: number; active: boolean }[]): {
  sum: number;
  balanced: boolean;
} {
  const sum = rows.filter((r) => r.active).reduce((s, r) => s + r.defaultPercent, 0);
  return { sum, balanced: sum === 100 };
}

/** Read-only counts of admin-managed content for the overview page. */
export async function getAdminOverview(): Promise<AdminOverview> {
  const [
    checklistTotal, checklistActive,
    conceptsTotal, conceptsActive,
    vendorsTotal, vendorsActive,
    baselineRows,
  ] = await Promise.all([
    prisma.checklistTemplate.count(),
    prisma.checklistTemplate.count({ where: { active: true } }),
    prisma.concept.count(),
    prisma.concept.count({ where: { active: true } }),
    prisma.vendor.count({ where: { weddingId: null } }),
    prisma.vendor.count({ where: { weddingId: null, active: true } }),
    prisma.budgetTemplate.findMany({ select: { defaultPercent: true, active: true } }),
  ]);
  return {
    checklistTemplates: { total: checklistTotal, active: checklistActive },
    concepts: { total: conceptsTotal, active: conceptsActive },
    vendors: { total: vendorsTotal, active: vendorsActive },
    budget: budgetBaselineStatus(baselineRows),
  };
}
