import { setRequestLocale } from 'next-intl/server';
import { getAllConcepts } from '@/lib/concepts/queries';
import { ConceptsAdmin, type SerializedAdminConcept } from './concepts-admin';

export default async function AdminConceptsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const concepts = await getAllConcepts();
  const serialized: SerializedAdminConcept[] = concepts.map((c) => ({
    id: c.id,
    title_en: c.title_en,
    title_he: c.title_he,
    titleLocale: c.titleLocale,
    tagline_en: c.tagline_en,
    tagline_he: c.tagline_he,
    description_en: c.description_en,
    description_he: c.description_he,
    palette: c.palette,
    isPremium: c.isPremium,
    active: c.active,
    sortOrder: c.sortOrder,
    images: c.images.map((im) => ({
      id: im.id,
      url: im.url,
      alt_en: im.alt_en,
      alt_he: im.alt_he,
      sortOrder: im.sortOrder,
    })),
    elements: c.elements.map((el) => ({
      id: el.id,
      title_en: el.title_en,
      title_he: el.title_he,
      titleLocale: el.titleLocale,
      description_en: el.description_en,
      description_he: el.description_he,
      category: el.category,
      estCostMin: el.estCostMin,
      estCostMax: el.estCostMax,
      active: el.active,
      sortOrder: el.sortOrder,
    })),
  }));

  return <ConceptsAdmin concepts={serialized} />;
}
