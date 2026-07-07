import { setRequestLocale } from 'next-intl/server';
import type { Vendor, TaskCategory } from '@prisma/client';
import { auth } from '@/lib/auth';
import { getCurrentWedding } from '@/lib/wedding/queries';
import { getDirectoryVendors, getRecommendedVendors, getWeddingQuotes } from '@/lib/vendors/queries';
import { CATEGORY_OPTIONS } from '@/lib/checklist/schema';
import { redirect } from '@/lib/i18n/navigation';
import { VendorsDirectory } from './vendors-directory';
import type { SerializedVendor } from './vendor-card';

function serialize(vendor: Vendor & { images: { url: string }[] }): SerializedVendor {
  return {
    id: vendor.id,
    name_en: vendor.name_en,
    name_he: vendor.name_he,
    titleLocale: vendor.titleLocale,
    category: vendor.category,
    city: vendor.city,
    priceMin: vendor.priceMin,
    priceMax: vendor.priceMax,
    verified: vendor.verified,
    isPremium: vendor.isPremium,
    isPrivate: vendor.weddingId != null,
    coverUrl: vendor.images[0]?.url ?? null,
  };
}

export default async function VendorsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ category?: string; city?: string; maxPrice?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;

  const session = await auth();
  if (!session?.user?.id) redirect({ href: '/login', locale });
  const wedding = await getCurrentWedding(session!.user.id);
  if (!wedding) redirect({ href: '/onboarding', locale });

  const category =
    sp.category && CATEGORY_OPTIONS.includes(sp.category as TaskCategory)
      ? (sp.category as TaskCategory)
      : undefined;
  const maxPrice = sp.maxPrice && !Number.isNaN(Number(sp.maxPrice)) ? Math.trunc(Number(sp.maxPrice)) : undefined;

  const [matches, vendors, quotes] = await Promise.all([
    getRecommendedVendors(wedding!, {}),
    getDirectoryVendors(wedding!.id, { category, city: sp.city || undefined, maxPrice }),
    getWeddingQuotes(wedding!.id),
  ]);

  return (
    <main className="mx-auto w-full max-w-5xl p-6 sm:p-8">
      <VendorsDirectory
        locale={locale}
        matches={matches.map(serialize)}
        vendors={vendors.map(serialize)}
        shortlistedIds={quotes.map((q) => q.vendorId)}
        filters={{ category: category ?? '', city: sp.city ?? '', maxPrice: sp.maxPrice ?? '' }}
      />
    </main>
  );
}
