function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const rad = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

export function donutSegments(values: number[]): { start: number; end: number; percent: number }[] {
  const total = values.reduce((s, v) => s + Math.max(0, v), 0);
  if (total <= 0) return [];
  let cursor = -90;
  return values.map((v) => {
    const percent = Math.max(0, v) / total;
    const start = cursor;
    const end = cursor + percent * 360;
    cursor = end;
    return { start, end, percent };
  });
}

const FULL_CIRCLE_EPSILON = 1e-6;

export function arcPath(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  startDeg: number,
  endDeg: number
): string {
  // SVG's elliptical-arc command can't draw a full 360° sweep in one command
  // (start === end mod 360°, making the arc degenerate). When a segment's sweep
  // is (within epsilon of) a full circle — e.g. a single-category donut — split
  // both the outer and inner arcs into two 180° halves so the ring still closes
  // as a proper annulus.
  if (endDeg - startDeg >= 360 - FULL_CIRCLE_EPSILON) {
    const midDeg = startDeg + 180;
    const [ox1, oy1] = polar(cx, cy, rOuter, startDeg);
    const [oxMid, oyMid] = polar(cx, cy, rOuter, midDeg);
    const [ix1, iy1] = polar(cx, cy, rInner, startDeg);
    const [ixMid, iyMid] = polar(cx, cy, rInner, midDeg);
    return `M ${ox1} ${oy1} A ${rOuter} ${rOuter} 0 1 1 ${oxMid} ${oyMid} A ${rOuter} ${rOuter} 0 1 1 ${ox1} ${oy1} M ${ix1} ${iy1} A ${rInner} ${rInner} 0 1 0 ${ixMid} ${iyMid} A ${rInner} ${rInner} 0 1 0 ${ix1} ${iy1} Z`;
  }

  const large = endDeg - startDeg > 180 ? 1 : 0;
  const [ox1, oy1] = polar(cx, cy, rOuter, startDeg);
  const [ox2, oy2] = polar(cx, cy, rOuter, endDeg);
  const [ix2, iy2] = polar(cx, cy, rInner, endDeg);
  const [ix1, iy1] = polar(cx, cy, rInner, startDeg);
  return `M ${ox1} ${oy1} A ${rOuter} ${rOuter} 0 ${large} 1 ${ox2} ${oy2} L ${ix2} ${iy2} A ${rInner} ${rInner} 0 ${large} 0 ${ix1} ${iy1} Z`;
}
