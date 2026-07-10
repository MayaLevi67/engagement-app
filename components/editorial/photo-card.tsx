import { ImageBlock } from './image-block';
export function PhotoCard({
  src,
  alt,
  placeholderLabel,
  children,
}: {
  src?: string | null;
  alt: string;
  placeholderLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-card bg-surface shadow-sm">
      <ImageBlock src={src} alt={alt} placeholderLabel={placeholderLabel} className="h-40" />
      <div className="p-4">{children}</div>
    </div>
  );
}
