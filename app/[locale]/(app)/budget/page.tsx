import { setRequestLocale } from 'next-intl/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getCurrentWedding } from '@/lib/wedding/queries';
import { redirect } from '@/lib/i18n/navigation';
import { rollupTasks, sumConceptRanges } from '@/lib/budget/rollup';
import { optimizeBudget } from '@/lib/budget/optimize';
import { estimateGifts } from '@/lib/budget/gifts';
import { BudgetView } from './budget-view';

export default async function BudgetPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user?.id) redirect({ href: '/login', locale });
  const wedding = await getCurrentWedding(session!.user.id);
  if (!wedding) redirect({ href: '/onboarding', locale });

  const [tasks, allocations, baselineRows, selectedConcept] = await Promise.all([
    prisma.task.findMany({
      where: { weddingId: wedding!.id, deletedAt: null },
      select: { category: true, status: true, amountPaid: true, estimatedCost: true, deletedAt: true },
    }),
    prisma.budgetAllocation.findMany({ where: { weddingId: wedding!.id } }),
    prisma.budgetTemplate.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } }),
    wedding!.selectedConceptId
      ? prisma.concept.findUnique({
          where: { id: wedding!.selectedConceptId },
          include: { elements: { where: { active: true } } },
        })
      : Promise.resolve(null),
  ]);

  const { committed } = rollupTasks(tasks);
  const conceptRanges = selectedConcept ? sumConceptRanges(selectedConcept.elements) : {};
  const baseline = Object.fromEntries(baselineRows.map((b) => [b.category, b.defaultPercent]));
  const pinned = Object.fromEntries(allocations.map((a) => [a.category, a.amount]));

  const result =
    wedding!.budgetTotal != null
      ? optimizeBudget({
          budgetTotal: wedding!.budgetTotal,
          baseline,
          priorities: wedding!.priorities,
          conceptRanges,
          committed,
          pinned,
        })
      : null;

  const gift = estimateGifts({
    avgGiftPerGuest: wedding!.avgGiftPerGuest,
    guestCount: wedding!.guestCount,
    budgetTotal: wedding!.budgetTotal,
  });

  return (
    <main className="mx-auto w-full max-w-3xl p-6 sm:p-8">
      <BudgetView
        locale={locale}
        budgetTotal={wedding!.budgetTotal}
        avgGiftPerGuest={wedding!.avgGiftPerGuest}
        guestCount={wedding!.guestCount}
        categories={result?.perCategory ?? []}
        feedback={result?.feedback ?? { type: 'ok' }}
        gift={gift}
      />
    </main>
  );
}
