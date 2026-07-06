'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/lib/i18n/navigation';
import type { TaskCategory, TaskPriority, TaskStatus, TitleLocale } from '@prisma/client';
import { CATEGORY_OPTIONS, PRIORITY_OPTIONS } from '@/lib/checklist/schema';
import { TaskRow } from './task-row';
import { AddCustomTask } from './add-custom-task';
import { TrashView } from './trash-view';

export interface SerializedTask {
  id: string;
  title_en: string;
  title_he: string;
  titleLocale: TitleLocale;
  category: TaskCategory;
  priority: TaskPriority;
  dueDate: string | null;
  status: TaskStatus;
  completedAt: string | null;
  isCustom: boolean;
  reminderEnabled: boolean;
  remindAt: string | null;
  notes: string | null;
  estimatedCost: number | null;
  amountPaid: number | null;
  deletedAt: string | null;
}

type GroupMode = 'category' | 'timeline';
type Bucket = 'overdue' | 'thisMonth' | 'upcoming' | 'noDate' | 'done';

const BUCKET_ORDER: Bucket[] = ['overdue', 'thisMonth', 'upcoming', 'noDate', 'done'];
const ALL = 'ALL' as const;

type CategoryFilter = TaskCategory | typeof ALL;
type StatusFilter = TaskStatus | typeof ALL;
type PriorityFilter = TaskPriority | typeof ALL;

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function bucketFor(task: SerializedTask, now: Date): Bucket {
  if (task.status === 'DONE') return 'done';
  if (!task.dueDate) return 'noDate';
  const today = startOfDay(now);
  const due = startOfDay(new Date(task.dueDate));
  if (due.getTime() < today.getTime()) return 'overdue';
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  if (due.getTime() <= endOfMonth.getTime()) return 'thisMonth';
  return 'upcoming';
}

interface ChecklistViewProps {
  locale: string;
  tasks: SerializedTask[];
  trashedTasks: SerializedTask[];
  counts: { done: number; total: number };
}

export function ChecklistView({ locale, tasks, trashedTasks, counts }: ChecklistViewProps) {
  const t = useTranslations('Checklist');
  const tCategory = useTranslations('TaskCategory');
  const tPriority = useTranslations('TaskPriority');
  const router = useRouter();

  const [groupMode, setGroupMode] = useState<GroupMode>('category');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>(ALL);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(ALL);
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>(ALL);
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [showTrash, setShowTrash] = useState(false);

  const filteredTasks = useMemo(
    () =>
      tasks.filter((task) => {
        if (categoryFilter !== ALL && task.category !== categoryFilter) return false;
        if (statusFilter !== ALL && task.status !== statusFilter) return false;
        if (priorityFilter !== ALL && task.priority !== priorityFilter) return false;
        return true;
      }),
    [tasks, categoryFilter, statusFilter, priorityFilter],
  );

  const groups = useMemo(() => {
    if (groupMode === 'category') {
      return CATEGORY_OPTIONS.map((category) => ({
        key: category as string,
        label: tCategory(category),
        tasks: filteredTasks.filter((task) => task.category === category),
      })).filter((group) => group.tasks.length > 0);
    }
    const now = new Date();
    return BUCKET_ORDER.map((bucket) => ({
      key: bucket as string,
      label: t(`buckets.${bucket}`),
      tasks: filteredTasks.filter((task) => bucketFor(task, now) === bucket),
    })).filter((group) => group.tasks.length > 0);
  }, [groupMode, filteredTasks, tCategory, t]);

  function refresh() {
    router.refresh();
  }

  if (showTrash) {
    return (
      <TrashView
        locale={locale}
        tasks={trashedTasks}
        onBack={() => setShowTrash(false)}
        onChanged={refresh}
      />
    );
  }

  const progressPct = counts.total > 0 ? Math.round((counts.done / counts.total) * 100) : 0;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-2xl text-text">{t('title')}</h1>
        <p className="font-body text-sm text-muted">
          {t('progress', { done: counts.done, total: counts.total })}
        </p>
        <div className="h-2 w-full overflow-hidden rounded-card bg-background">
          <div
            className="h-full rounded-card bg-primary transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setGroupMode('category')}
          aria-pressed={groupMode === 'category'}
          className={
            groupMode === 'category'
              ? 'rounded-card border border-primary bg-primary px-3 py-1.5 text-sm text-background'
              : 'rounded-card border border-muted/30 px-3 py-1.5 text-sm text-text'
          }
        >
          {t('groupByCategory')}
        </button>
        <button
          type="button"
          onClick={() => setGroupMode('timeline')}
          aria-pressed={groupMode === 'timeline'}
          className={
            groupMode === 'timeline'
              ? 'rounded-card border border-primary bg-primary px-3 py-1.5 text-sm text-background'
              : 'rounded-card border border-muted/30 px-3 py-1.5 text-sm text-text'
          }
        >
          {t('groupByTimeline')}
        </button>

        <button
          type="button"
          onClick={() => setShowTrash(true)}
          className="ms-auto rounded-card border border-muted/30 px-3 py-1.5 text-sm text-muted"
        >
          {t('recentlyDeleted')}
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-card bg-surface p-4 shadow-sm">
        <div className="flex flex-col gap-1">
          <label htmlFor="filter-category" className="text-xs text-muted">
            {t('filters.category')}
          </label>
          <select
            id="filter-category"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as CategoryFilter)}
            className="rounded-card border border-muted/30 bg-background px-2 py-1.5 text-sm text-text"
          >
            <option value={ALL}>{t('filters.all')}</option>
            {CATEGORY_OPTIONS.map((category) => (
              <option key={category} value={category}>
                {tCategory(category)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="filter-status" className="text-xs text-muted">
            {t('filters.status')}
          </label>
          <select
            id="filter-status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="rounded-card border border-muted/30 bg-background px-2 py-1.5 text-sm text-text"
          >
            <option value={ALL}>{t('filters.all')}</option>
            <option value="OPEN">{t('statusOpen')}</option>
            <option value="DONE">{t('statusDone')}</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="filter-priority" className="text-xs text-muted">
            {t('filters.priority')}
          </label>
          <select
            id="filter-priority"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as PriorityFilter)}
            className="rounded-card border border-muted/30 bg-background px-2 py-1.5 text-sm text-text"
          >
            <option value={ALL}>{t('filters.all')}</option>
            {PRIORITY_OPTIONS.map((priority) => (
              <option key={priority} value={priority}>
                {tPriority(priority)}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={() => setShowAddCustom(true)}
          className="ms-auto rounded-card bg-primary px-4 py-2 text-sm font-medium text-background"
        >
          {t('addCustom')}
        </button>
      </div>

      {showAddCustom ? (
        <AddCustomTask
          locale={locale}
          onCancel={() => setShowAddCustom(false)}
          onAdded={() => {
            setShowAddCustom(false);
            refresh();
          }}
        />
      ) : null}

      <div className="flex flex-col gap-6">
        {groups.length === 0 ? (
          <p className="rounded-card bg-surface p-6 text-center text-sm text-muted shadow-sm">
            {t('empty')}
          </p>
        ) : (
          groups.map((group) => (
            <section key={group.key} className="flex flex-col gap-2">
              <h2 className="font-display text-lg text-text">{group.label}</h2>
              <div className="flex flex-col gap-2">
                {group.tasks.map((task) => (
                  <TaskRow key={task.id} task={task} locale={locale} onChanged={refresh} />
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
