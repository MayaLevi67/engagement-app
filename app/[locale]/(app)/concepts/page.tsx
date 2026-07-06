import { setRequestLocale } from 'next-intl/server';
import { auth } from '@/lib/auth';
import { getCurrentWedding } from '@/lib/wedding/queries';
import { getActiveConcepts, getWeddingConceptState } from '@/lib/concepts/queries';
import { resolveConceptTitle } from '@/lib/concepts/title';
import { redirect } from '@/lib/i18n/navigation';
import { ConceptsGallery, type SerializedConcept } from './concepts-gallery';

export default async function ConceptsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user?.id) redirect({ href: '/login', locale });
  const wedding = await getCurrentWedding(session!.user.id);
  if (!wedding) redirect({ href: '/onboarding', locale });

  const [concepts, state] = await Promise.all([
    getActiveConcepts(),
    getWeddingConceptState(wedding!.id),
  ]);

  const serialized: SerializedConcept[] = concepts.map((c) => ({
    id: c.id,
    title: resolveConceptTitle(c, locale),
    tagline: locale === 'he' ? (c.tagline_he ?? c.tagline_en ?? '') : (c.tagline_en ?? c.tagline_he ?? ''),
    palette: c.palette,
    isPremium: c.isPremium,
    coverUrl: c.images[0]?.url ?? null,
    coverAlt: c.images[0] ? (locale === 'he' ? (c.images[0].alt_he ?? '') : (c.images[0].alt_en ?? '')) : '',
    isFavorite: state.favoriteConceptIds.includes(c.id),
    isSelected: state.selectedConceptId === c.id,
  }));

  return (
    <main className="mx-auto w-full max-w-5xl p-6 sm:p-8">
      <ConceptsGallery locale={locale} concepts={serialized} />
    </main>
  );
}
