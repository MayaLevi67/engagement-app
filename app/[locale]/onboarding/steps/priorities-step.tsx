'use client';

import { useTranslations } from 'next-intl';
import { PRIORITY_OPTIONS } from '@/lib/wedding/profile-fields';
import type { Priority } from '@prisma/client';

export interface PrioritiesStepValues {
  priorities: Priority[];
}

interface PrioritiesStepProps extends PrioritiesStepValues {
  onChange: (patch: Partial<PrioritiesStepValues>) => void;
}

const MAX_PRIORITIES = 3;

export function PrioritiesStep({ priorities, onChange }: PrioritiesStepProps) {
  const t = useTranslations('WeddingProfile');

  function toggle(option: Priority) {
    if (priorities.includes(option)) {
      onChange({ priorities: priorities.filter((p) => p !== option) });
      return;
    }
    if (priorities.length >= MAX_PRIORITIES) return;
    onChange({ priorities: [...priorities, option] });
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-muted">{t('priorities')}</p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        {PRIORITY_OPTIONS.map((option) => {
          const rank = priorities.indexOf(option);
          const selected = rank !== -1;
          const disabled = !selected && priorities.length >= MAX_PRIORITIES;
          return (
            <button
              key={option}
              type="button"
              onClick={() => toggle(option)}
              disabled={disabled}
              aria-pressed={selected}
              className={
                selected
                  ? 'flex items-center gap-2 rounded-card border border-primary bg-primary px-4 py-2 text-sm text-background disabled:opacity-40'
                  : 'flex items-center gap-2 rounded-card border border-muted/30 px-4 py-2 text-sm text-text disabled:opacity-40'
              }
            >
              {selected ? (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-background text-primary">
                  {rank + 1}
                </span>
              ) : null}
              <span>{t(`priority.${option}`)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
