'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { restoreTask, permanentlyDeleteTask } from '@/lib/actions/checklist';
import { resolveTaskTitle } from '@/lib/checklist/title';
import type { SerializedTask } from './checklist-view';

interface TrashViewProps {
  locale: string;
  tasks: SerializedTask[];
  onBack: () => void;
  onChanged: () => void;
}

export function TrashView({ locale, tasks, onBack, onChanged }: TrashViewProps) {
  const t = useTranslations('Checklist');
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);

  async function handleRestore(taskId: string) {
    setErrorId(null);
    setPendingId(taskId);
    const result = await restoreTask(taskId);
    setPendingId(null);
    if (!result.ok) {
      setErrorId(taskId);
      return;
    }
    onChanged();
  }

  async function handleDeleteForever(taskId: string) {
    setErrorId(null);
    setPendingId(taskId);
    const result = await permanentlyDeleteTask(taskId);
    setPendingId(null);
    if (!result.ok) {
      setErrorId(taskId);
      return;
    }
    onChanged();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onBack} className="text-sm text-primary">
          {t('backToChecklist')}
        </button>
        <h1 className="font-display text-2xl text-text">{t('recentlyDeleted')}</h1>
      </div>

      {tasks.length === 0 ? (
        <p className="rounded-card bg-surface p-6 text-center text-sm text-muted shadow-sm">
          {t('trashEmpty')}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {tasks.map((task) => (
            <div key={task.id} className="flex flex-col gap-2 rounded-card bg-surface p-4 shadow-sm">
              <div className="flex flex-wrap items-center gap-3">
                <span className="flex-1 text-sm text-text">{resolveTaskTitle(task, locale)}</span>
                <button
                  type="button"
                  disabled={pendingId === task.id}
                  onClick={() => handleRestore(task.id)}
                  className="rounded-card border border-primary px-3 py-1.5 text-sm text-primary disabled:opacity-60"
                >
                  {t('restore')}
                </button>
                <button
                  type="button"
                  disabled={pendingId === task.id}
                  onClick={() => handleDeleteForever(task.id)}
                  className="rounded-card border border-red-600 px-3 py-1.5 text-sm text-red-600 disabled:opacity-60"
                >
                  {t('deleteForever')}
                </button>
              </div>
              {errorId === task.id ? <p className="text-sm text-red-600">{t('error')}</p> : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
