import type { Priority, TaskCategory } from '@prisma/client';

/** Each onboarding Priority boosts one or more budget categories. */
export const PRIORITY_CATEGORY_MAP: Record<Priority, TaskCategory[]> = {
  FOOD: ['CATERING'],
  PARTY: ['MUSIC'],
  PHOTOGRAPHY: ['PHOTOGRAPHY'],
  GUEST_EXPERIENCE: ['GUESTS'],
  DESIGN: ['DESIGN', 'FLOWERS'],
  FASHION: ['ATTIRE'],
};

/** Weight multiplier applied once per matched priority. */
export const PRIORITY_BOOST = 1.5;

export function priorityBoostFor(category: TaskCategory, priorities: Priority[]): number {
  let boost = 1;
  for (const p of priorities) {
    if (PRIORITY_CATEGORY_MAP[p]?.includes(category)) boost *= PRIORITY_BOOST;
  }
  return boost;
}
