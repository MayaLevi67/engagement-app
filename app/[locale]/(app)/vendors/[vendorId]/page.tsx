import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getCurrentWedding } from '@/lib/wedding/queries';
import { getVendorDetail } from '@/lib/vendors/queries';
import { getTasks } from '@/lib/checklist/queries';
import { resolveTaskTitle } from '@/lib/checklist/title';
import { redirect } from '@/lib/i18n/navigation';
import { isPremium } from '@/lib/premium/entitlement';
import { VendorDetail, type SerializedVendorDetail } from './vendor-detail';
import type { SerializedQuote, QuoteTask } from './quote-panel';

export default async function VendorDetailPage({
  params,
}: {
  params: Promise<{ locale: string; vendorId: string }>;
}) {
  const { locale, vendorId } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user?.id) redirect({ href: '/login', locale });
  const wedding = await getCurrentWedding(session!.user.id);
  if (!wedding) redirect({ href: '/onboarding', locale });

  const [detail, tasks] = await Promise.all([
    getVendorDetail(vendorId, wedding!.id),
    getTasks(wedding!.id),
  ]);
  if (!detail) notFound();

  const pick = (he: string | null, en: string | null) =>
    locale === 'he' ? (he ?? en ?? '') : (en ?? he ?? '');

  const { vendor, quote } = detail;

  const serializedVendor: SerializedVendorDetail = {
    id: vendor.id,
    name_en: vendor.name_en,
    name_he: vendor.name_he,
    titleLocale: vendor.titleLocale,
    category: vendor.category,
    city: vendor.city,
    priceMin: vendor.priceMin,
    priceMax: vendor.priceMax,
    description: pick(vendor.description_he, vendor.description_en),
    email: vendor.email,
    phone: vendor.phone,
    website: vendor.website,
    verified: vendor.verified,
    isPremium: vendor.isPremium,
    isPrivate: vendor.weddingId != null,
    images: vendor.images.map((image) => ({ url: image.url, alt: pick(image.alt_he, image.alt_en) })),
  };

  const serializedQuote: SerializedQuote | null = quote
    ? { status: quote.status, amount: quote.amount, notes: quote.notes, taskId: quote.taskId }
    : null;

  const serializedTasks: QuoteTask[] = tasks.map(
    (task): QuoteTask => ({ id: task.id, title: resolveTaskTitle(task, locale) }),
  );

  return (
    <main className="mx-auto w-full max-w-3xl p-6 sm:p-8">
      <VendorDetail
        locale={locale}
        vendor={serializedVendor}
        quote={serializedQuote}
        tasks={serializedTasks}
        premium={isPremium(wedding!)}
      />
    </main>
  );
}
