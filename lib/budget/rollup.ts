import type { TaskCategory } from '@prisma/client';

type RollupTask = {
  category: TaskCategory;
  status: 'OPEN' | 'DONE';
  amountPaid: number | null;
  estimatedCost: number | null;
  deletedAt: Date | null;
};

/** committed = Σ paid on DONE tasks; planned = Σ estimate on OPEN tasks. Soft-deleted excluded. */
export function rollupTasks(tasks: RollupTask[]): {
  committed: Partial<Record<TaskCategory, number>>;
  planned: Partial<Record<TaskCategory, number>>;
} {
  const committed: Partial<Record<TaskCategory, number>> = {};
  const planned: Partial<Record<TaskCategory, number>> = {};
  for (const t of tasks) {
    if (t.deletedAt) continue;
    if (t.status === 'DONE' && t.amountPaid != null) {
      committed[t.category] = (committed[t.category] ?? 0) + t.amountPaid;
    } else if (t.status === 'OPEN' && t.estimatedCost != null) {
      planned[t.category] = (planned[t.category] ?? 0) + t.estimatedCost;
    }
  }
  return { committed, planned };
}

type RangeElement = {
  category: TaskCategory;
  estCostMin: number | null;
  estCostMax: number | null;
  active: boolean;
};

/** Sum the selected concept's active elements into a per-category cost range. */
export function sumConceptRanges(
  elements: RangeElement[],
): Partial<Record<TaskCategory, { min: number; max: number }>> {
  const out: Partial<Record<TaskCategory, { min: number; max: number }>> = {};
  for (const e of elements) {
    if (!e.active) continue;
    const cur = out[e.category] ?? { min: 0, max: 0 };
    cur.min += e.estCostMin ?? 0;
    cur.max += e.estCostMax ?? 0;
    out[e.category] = cur;
  }
  return out;
}
