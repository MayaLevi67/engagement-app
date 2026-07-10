export function SectionHeader({ title, numeral, kicker }: { title: string; numeral?: string; kicker?: string }) {
  return (
    <div className="mb-4 mt-2 flex items-center gap-3">
      {numeral ? <span className="font-display text-4xl leading-none text-primary/40">{numeral}</span> : null}
      <div>
        {kicker ? <div className="text-xs uppercase tracking-[0.14em] text-wine">{kicker}</div> : null}
        <h2 className="font-display text-2xl text-forest">{title}</h2>
      </div>
      <span className="ms-2 h-px flex-1 bg-line" />
    </div>
  );
}
