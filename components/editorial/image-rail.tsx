import { ImageBlock } from './image-block';
export function ImageRail({
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
    <div className="grid gap-4 sm:grid-cols-[1.6fr_1fr]">
      <div>{children}</div>
      <ImageBlock src={src} alt={alt} placeholderLabel={placeholderLabel} className="min-h-56" />
    </div>
  );
}
