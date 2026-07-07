import { setRequestLocale } from 'next-intl/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { redirect } from '@/lib/i18n/navigation';
import { VendorsAdmin, type SerializedAdminVendor } from './vendors-admin';

export default async function AdminVendorsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user?.id) redirect({ href: '/login', locale });
  // The role is resolved from the live DB rather than the JWT/session claim,
  // since the JWT role is stamped at login and can be stale.
  const user = await prisma.user.findUnique({ where: { id: session!.user.id }, select: { role: true } });
  if (user?.role !== 'ADMIN') redirect({ href: '/dashboard', locale });

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

  return (
    <main className="mx-auto w-full max-w-4xl p-6 sm:p-8">
      <VendorsAdmin vendors={serialized} />
    </main>
  );
}
