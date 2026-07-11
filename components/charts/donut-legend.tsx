import type { Slice } from './donut';

export function DonutLegend({
  slices,
  formatRow,
  formatAmount,
}: {
  slices: Slice[];
  formatRow: (percent: number) => string;
  formatAmount: (value: number) => string;
}) {
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  const sorted = [...slices].sort((a, b) => b.value - a.value);
  return (
    <ul className="flex flex-col gap-1.5">
      {sorted.map((s) => (
        <li key={`${s.token}-${s.label}`} className="flex items-center gap-2 text-sm">
          <span className={`inline-block h-3 w-3 shrink-0 rounded-full bg-${s.token}`} aria-hidden="true" />
          <span className="text-text">{s.label}</span>
          <span className="ms-auto text-muted">{formatRow(s.value / total)} · {formatAmount(s.value)}</span>
        </li>
      ))}
    </ul>
  );
}
