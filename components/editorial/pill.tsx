export function Pill({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'active' | 'emphasis';
}) {
  const cls =
    tone === 'active' ? 'bg-primary text-background' : tone === 'emphasis' ? 'bg-wine text-background' : 'bg-muted/20 text-muted';
  return <span className={`inline-block rounded-full px-3 py-1 text-xs tracking-wide ${cls}`}>{children}</span>;
}
