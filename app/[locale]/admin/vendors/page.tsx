import { setRequestLocale } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { VendorsAdmin, type SerializedAdminVendor } from './vendors-admin';

export default async function AdminVendorsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const vendors = await prisma.vendor.findMany({
    where: { weddingId: null },
    include: { images: { orderBy: { sortOrder: 'asc' } } },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });

  const serialized: SerializedAdminVendor[] = vendors.map((v) => ({
    id: v.id,
    name_en: v.name_en,
    name_he: v.name_he,
    titleLocale: v.titleLocale,
    category: v.category,
    city: v.city,
    priceMin: v.priceMin,
    priceMax: v.priceMax,
    email: v.email,
    phone: v.phone,
    website: v.website,
    description_en: v.description_en,
    description_he: v.description_he,
    verified: v.verified,
    isPremium: v.isPremium,
    active: v.active,
    sortOrder: v.sortOrder,
    images: v.images.map((im) => ({
      id: im.id,
      url: im.url,
      alt_en: im.alt_en,
      alt_he: im.alt_he,
      sortOrder: im.sortOrder,
    })),
  }));

  return <VendorsAdmin vendors={serialized} />;
}
