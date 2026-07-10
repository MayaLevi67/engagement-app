import { ImageBlock } from './image-block';
export function ImageSection({
  src,
  alt,
  placeholderLabel,
  children,
}: {
  src?: string | null;
  alt: string;
  placeholderLabel?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-card">
      <ImageBlock src={src} alt={alt} placeholderLabel={placeholderLabel} className="min-h-44" />
      {children ? (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-forest/70 to-transparent p-5 text-background">
          {children}
        </div>
      ) : null}
    </div>
  );
}
