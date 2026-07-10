export function ImageBlock({
  src,
  alt,
  placeholderLabel,
  className = '',
}: {
  src?: string | null;
  alt: string;
  placeholderLabel?: string;
  className?: string;
}) {
  if (!src) {
    return (
      <div
        className={`flex items-end justify-center rounded-card bg-forest/10 ${className}`.trim()}
        aria-hidden="true"
      >
        {placeholderLabel ? (
          <span className="pb-3 text-xs uppercase tracking-[0.18em] text-muted">{placeholderLabel}</span>
        ) : null}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- couple-supplied external/uploaded images, not build-time assets
    <img src={src} alt={alt} loading="lazy" className={`h-full w-full rounded-card object-cover ${className}`.trim()} />
  );
}
