export function monogram(p1?: string | null, p2?: string | null): string {
  const a = p1?.trim()?.[0];
  const b = p2?.trim()?.[0];
  return [a, b].filter(Boolean).join(' & ');
}
