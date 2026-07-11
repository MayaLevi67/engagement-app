import { donutSegments, arcPath } from './donut-geometry';

export type Slice = { label: string; value: number; token: string };

export function Donut({ slices, sliceTitle }: { slices: Slice[]; sliceTitle: (s: Slice, percent: number) => string }) {
  const segs = donutSegments(slices.map((s) => s.value));
  const size = 180, cx = 90, cy = 90, rOuter = 84, rInner = 52;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto block h-auto w-full max-w-[220px]" role="img">
      {segs.map((seg, i) => {
        // 2px cream gap between slices: inset the arc a hair at each end.
        // Clamp the gap to half the slice's span so a slice thinner than the
        // full 1.2deg gap (e.g. a payer who paid a tiny sliver of the total)
        // never has its arc inverted (start > end).
        const span = seg.end - seg.start;
        const gap = segs.length > 1 ? Math.min(1.2, span / 2) : 0;
        return (
          <path
            key={`${slices[i].token}-${slices[i].label}`}
            d={arcPath(cx, cy, rOuter, rInner, seg.start + gap, seg.end - gap)}
            className={`fill-${slices[i].token}`}
          >
            <title>{sliceTitle(slices[i], seg.percent)}</title>
          </path>
        );
      })}
    </svg>
  );
}
