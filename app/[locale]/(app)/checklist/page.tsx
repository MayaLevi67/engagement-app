import { setRequestLocale } from 'next-intl/server';
import { auth } from '@/lib/auth';
import { getCurrentWedding } from '@/lib/wedding/queries';
import { getTasks, getTrashedTasks } from '@/lib/checklist/queries';
import { seedTasksForWedding } from '@/lib/checklist/copy';
import { redirect } from '@/lib/i18n/navigation';
import { isPremium, capChecklist } from '@/lib/premium/entitlement';
import { ChecklistView, type SerializedTask } from './checklist-view';
import type { Task, TaskPayment } from '@prisma/client';

type TaskWithPayments = Task & { payments: TaskPayment[] };

function serializeTask(task: TaskWithPayments): SerializedTask {
  return {
    id: task.id,
    title_en: task.title_en,
    title_he: task.title_he,
    titleLocale: task.titleLocale,
    category: task.category,
    priority: task.priority,
    dueDate: task.dueDate ? task.dueDate.toISOString() : null,
    status: task.status,
    completedAt: task.completedAt ? task.completedAt.toISOString() : null,
    isCustom: task.isCustom,
    reminderEnabled: task.reminderEnabled,
    remindAt: task.remindAt ? task.remindAt.toISOString() : null,
    notes: task.notes,
    estimatedCost: task.estimatedCost,
    amountPaid: task.amountPaid,
    deletedAt: task.deletedAt ? task.deletedAt.toISOString() : null,
    payments: task.payments.map((payment) => ({
      id: payment.id,
      amount: payment.amount,
      payer: payment.payer,
      payerLabel: payment.payerLabel,
      paidOn: payment.paidOn ? payment.paidOn.toISOString() : null,
      note: payment.note,
    })),
  };
}

export default async function ChecklistPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user?.id) {
    redirect({ href: '/login', locale });
  }

  let wedding = await getCurrentWedding(session!.user.id);
  if (!wedding) {
    redirect({ href: '/onboarding', locale });
  }

  // Safety net: a couple who somehow reached the checklist before seeding
  // ran (e.g. a stalled background job) gets backfilled here, on demand.
  if (!wedding!.tasksSeededAt) {
    await seedTasksForWedding(wedding!.id);
    wedding = await getCurrentWedding(session!.user.id);
  }

  const [tasks, trashedTasks] = await Promise.all([
    getTasks(wedding!.id),
    getTrashedTasks(wedding!.id),
  ]);

  const done = tasks.filter((t) => t.status === 'DONE').length;
  const premium = isPremium(wedding!);
  const { tasks: shown, hiddenCount } = capChecklist(tasks, premium);

  return (
    <main className="mx-auto w-full max-w-3xl p-6 sm:p-8">
      <ChecklistView
        locale={locale}
        tasks={shown.map(serializeTask)}
        trashedTasks={trashedTasks.map(serializeTask)}
        counts={{ done, total: tasks.length }}
        hiddenCount={hiddenCount}
        premium={premium}
        partner1Name={wedding!.partner1Name}
        partner2Name={wedding!.partner2Name}
      />
    </main>
  );
}
