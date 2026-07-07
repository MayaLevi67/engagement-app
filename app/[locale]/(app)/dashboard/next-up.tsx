import { useTranslations } from 'next-intl';
import { Link } from '@/lib/i18n/navigation';
import { resolveTaskTitle } from '@/lib/checklist/title';
import type { NextUpTask } from '@/lib/dashboard/aggregate';

export function NextUp({ locale, tasks }: { locale: string; tasks: NextUpTask[] }) {
  const t = useTranslations('Dashboard');
  const fmtDate = (iso: string) =>
    new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(iso));

  return (
    <section className="flex flex-col gap-2 rounded-card bg-surface p-5 shadow-sm">
      <h2 className="font-display text-lg text-text">{t('nextUpTitle')}</h2>
      {tasks.length === 0 ? (
        <p className="text-sm text-muted">{t('nextUpEmpty')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {tasks.map((task) => (
            <li key={task.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="text-text">{resolveTaskTitle(task, locale)}</span>
              <span className={task.overdue ? 'text-red-600' : 'text-muted'}>
                {task.overdue ? `${t('nextUpOverdue')} · ` : ''}
                {task.dueDate ? fmtDate(task.dueDate) : t('noDueDate')}
              </span>
            </li>
          ))}
        </ul>
      )}
      <Link href="/checklist" className="mt-1 text-sm text-primary">{t('checklistCta')}</Link>
    </section>
  );
}
