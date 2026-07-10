import { setRequestLocale } from 'next-intl/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getCurrentWedding } from '@/lib/wedding/queries';
import { redirect } from '@/lib/i18n/navigation';
import { isPremium } from '@/lib/premium/entitlement';
import { resolveTaskTitle } from '@/lib/checklist/title';
import { resolveVendorTitle } from '@/lib/vendors/title';
import { taskMoney } from '@/lib/payments/rollup';
import { PaymentsView, type SerializedPaymentRow } from './payments-view';
import { Paywall } from './paywall';

export default async function PaymentsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user?.id) redirect({ href: '/login', locale });
  const wedding = await getCurrentWedding(session!.user.id);
  if (!wedding) redirect({ href: '/onboarding', locale });

  if (!isPremium(wedding!)) {
    return (
      <main className="mx-auto w-full max-w-3xl p-6 sm:p-8">
        <Paywall />
      </main>
    );
  }

  const tasks = await prisma.task.findMany({
    where: {
      weddingId: wedding!.id,
      deletedAt: null,
      OR: [{ estimatedCost: { not: null } }, { payments: { some: {} } }],
    },
    include: { payments: true },
    orderBy: { sortOrder: 'asc' },
  });

  const taskIds = tasks.map((task) => task.id);
  const quotes = taskIds.length
    ? await prisma.vendorQuote.findMany({
        where: { taskId: { in: taskIds } },
        select: {
          taskId: true,
          vendor: { select: { name_en: true, name_he: true, titleLocale: true } },
        },
      })
    : [];

  const vendorNameByTask = new Map<string, string>();
  for (const quote of quotes) {
    if (quote.taskId && !vendorNameByTask.has(quote.taskId)) {
      vendorNameByTask.set(quote.taskId, resolveVendorTitle(quote.vendor, locale));
    }
  }

  const rows: SerializedPaymentRow[] = tasks.map((task) => {
    const { cost, paid, remaining } = taskMoney(task.estimatedCost, task.payments);
    return {
      taskId: task.id,
      title: resolveTaskTitle(task, locale),
      vendorName: vendorNameByTask.get(task.id) ?? null,
      cost,
      paid,
      remaining,
      payments: task.payments.map((payment) => ({
        id: payment.id,
        amount: payment.amount,
        payer: payment.payer,
        payerLabel: payment.payerLabel,
        paidOn: payment.paidOn ? payment.paidOn.toISOString() : null,
        note: payment.note,
      })),
    };
  });

  return (
    <main className="mx-auto w-full max-w-3xl p-6 sm:p-8">
      <PaymentsView
        rows={rows}
        locale={locale}
        partner1Name={wedding!.partner1Name}
        partner2Name={wedding!.partner2Name}
      />
    </main>
  );
}
