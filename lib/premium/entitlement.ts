/** Free couples see at most this many checklist tasks. */
export const FREE_CHECKLIST_LIMIT = 10;

/** The single premium predicate consulted by every gate. */
export function isPremium(wedding: { premiumUnlockedAt: Date | null }): boolean {
  return wedding.premiumUnlockedAt != null;
}

/** All tasks for premium; the first FREE_CHECKLIST_LIMIT + a hidden count for free. */
export function capChecklist<T>(tasks: T[], premium: boolean): { tasks: T[]; hiddenCount: number } {
  if (premium) return { tasks, hiddenCount: 0 };
  return {
    tasks: tasks.slice(0, FREE_CHECKLIST_LIMIT),
    hiddenCount: Math.max(0, tasks.length - FREE_CHECKLIST_LIMIT),
  };
}
