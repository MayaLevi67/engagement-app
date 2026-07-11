import { Card } from './card';

export function FeatureCard({
  kicker,
  title,
  meta,
  image,
}: {
  kicker?: string;
  title: string;
  meta?: React.ReactNode;
  image?: React.ReactNode;
}) {
  return (
    <Card accent="wine" className="flex items-stretch gap-4 p-0 overflow-hidden">
      {image ? <div className="w-28 shrink-0">{image}</div> : null}
      <div className="p-4">
        {kicker ? <div className="text-xs uppercase tracking-[0.14em] text-wine">{kicker}</div> : null}
        <h3 className="font-display text-xl text-text">{title}</h3>
        {meta ? <div className="mt-1 text-sm text-muted">{meta}</div> : null}
      </div>
    </Card>
  );
}
