import { Donut, type Slice } from './donut';
import { DonutLegend } from './donut-legend';

// Tailwind v4's scanner only sees class names that appear literally in source.
// Donut/DonutLegend build `fill-${token}` / `bg-${token}` dynamically from
// `chart-1`..`chart-12`, so none of those 24 classes would otherwise be
// generated. This hidden, aria-hidden span exists purely to spell them out
// literally so the JIT compiler emits the CSS; it renders nothing visible.
function ChartColorSafelist() {
  return (
    <span
      className="hidden fill-chart-1 bg-chart-1 fill-chart-2 bg-chart-2 fill-chart-3 bg-chart-3 fill-chart-4 bg-chart-4 fill-chart-5 bg-chart-5 fill-chart-6 bg-chart-6 fill-chart-7 bg-chart-7 fill-chart-8 bg-chart-8 fill-chart-9 bg-chart-9 fill-chart-10 bg-chart-10 fill-chart-11 bg-chart-11 fill-chart-12 bg-chart-12"
      aria-hidden="true"
    />
  );
}

export function DonutChart({
  title,
  slices,
  sliceTitle,
  formatRow,
  formatAmount,
  emptyLabel,
}: {
  title: string;
  slices: Slice[];
  sliceTitle: (s: Slice, percent: number) => string;
  formatRow: (percent: number) => string;
  formatAmount: (value: number) => string;
  emptyLabel: string;
}) {
  return (
    <div className="rounded-card bg-surface p-5 shadow-sm">
      <ChartColorSafelist />
      <h2 className="mb-4 font-display text-xl text-forest">{title}</h2>
      {slices.length === 0 ? (
        <p className="text-sm text-muted">{emptyLabel}</p>
      ) : (
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="sm:w-1/2"><Donut slices={slices} sliceTitle={sliceTitle} /></div>
          <div className="sm:w-1/2"><DonutLegend slices={slices} formatRow={formatRow} formatAmount={formatAmount} /></div>
        </div>
      )}
    </div>
  );
}
