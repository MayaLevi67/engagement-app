import { monogram } from './monogram';

export function Hero({
  coupleName,
  partner1Name,
  partner2Name,
  children,
}: {
  coupleName: string | null;
  partner1Name: string | null;
  partner2Name: string | null;
  children?: React.ReactNode;
}) {
  const mono = monogram(partner1Name, partner2Name);
  return (
    <section className="rounded-card bg-forest px-6 py-10 text-center text-background">
      {mono ? <div className="font-display text-sm tracking-[0.25em] text-background/80">{mono}</div> : null}
      {coupleName ? <h1 className="mt-2 font-display text-4xl text-background sm:text-5xl">{coupleName}</h1> : null}
      {children ? (
        <div className="mt-5 inline-block border-y border-background/40 px-6 py-2 font-display text-2xl text-background">
          {children}
        </div>
      ) : null}
    </section>
  );
}
