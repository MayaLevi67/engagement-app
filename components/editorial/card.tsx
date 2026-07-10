export function Card({
  children,
  accent = 'sage',
  className = '',
}: {
  children: React.ReactNode;
  accent?: 'sage' | 'wine' | 'none';
  className?: string;
}) {
  const border =
    accent === 'wine' ? 'border-s-[3px] border-wine' : accent === 'sage' ? 'border-s-[3px] border-primary' : '';
  return <div className={`rounded-card bg-surface p-4 shadow-sm ${border} ${className}`.trim()}>{children}</div>;
}
