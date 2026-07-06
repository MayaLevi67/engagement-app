import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getCurrentWedding } from '@/lib/wedding/queries';
import { getConceptDetail, getWeddingConceptState } from '@/lib/concepts/queries';
import { resolveConceptTitle } from '@/lib/concepts/title';
import { redirect } from '@/lib/i18n/navigation';
import { ConceptDetail, type SerializedConceptDetail } from './concept-detail';

export default async function ConceptDetailPage({
  params,
}: {
  params: Promise<{ locale: string; conceptId: string }>;
}) {
  const { locale, conceptId } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user?.id) redirect({ href: '/login', locale });
  const wedding = await getCurrentWedding(session!.user.id);
  if (!wedding) redirect({ href: '/onboarding', locale });

  const [concept, state] = await Promise.all([
    getConceptDetail(conceptId),
    getWeddingConceptState(wedding!.id),
  ]);
  if (!concept) notFound();

  const pick = (he: string | null, en: string | null) =>
    locale === 'he' ? (he ?? en ?? '') : (en ?? he ?? '');

  const detail: SerializedConceptDetail = {
    id: concept.id,
    title: resolveConceptTitle(concept, locale),
    tagline: pick(concept.tagline_he, concept.tagline_en),
    description: pick(concept.description_he, concept.description_en),
    palette: concept.palette,
    isPremium: concept.isPremium,
    isSelected: state.selectedConceptId === concept.id,
    images: concept.images.map((im) => ({ url: im.url, alt: pick(im.alt_he, im.alt_en) })),
    elements: concept.elements.map((el) => ({
      id: el.id,
      title: resolveConceptTitle(el, locale),
      description: pick(el.description_he, el.description_en),
      category: el.category,
      estCostMin: el.estCostMin,
      estCostMax: el.estCostMax,
      isAdded: state.pushedElementIds.includes(el.id),
    })),
  };

  return (
    <main className="mx-auto w-full max-w-5xl p-6 sm:p-8">
      <ConceptDetail concept={detail} />
    </main>
  );
}
