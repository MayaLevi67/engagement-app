import { prisma } from '@/lib/db';
import type { Prisma, TaskCategory } from '@prisma/client';
import { recommendVendors, type RecommendCandidate } from './recommend';

/** A couple's budget expressed as a vendor price-fit window (whole budget as the ceiling). */
export function vendorBudgetFit(wedding: { budgetTotal: number | null }): { min: number | null; max: number | null } | null {
  if (wedding.budgetTotal == null) return null;
  return { min: null, max: wedding.budgetTotal };
}

export interface DirectoryFilters {
  category?: TaskCategory;
  city?: string;
  maxPrice?: number;
  premiumOnly?: boolean;
}

/** Global active vendors + this couple's own private vendors, filtered. */
export function getDirectoryVendors(weddingId: string, filters: DirectoryFilters) {
  const where: Prisma.VendorWhereInput = {
    AND: [
      { OR: [{ weddingId: null, active: true }, { weddingId }] },
      filters.category ? { category: filters.category } : {},
      filters.city ? { city: { equals: filters.city, mode: 'insensitive' } } : {},
      filters.maxPrice != null ? { OR: [{ priceMin: null }, { priceMin: { lte: filters.maxPrice } }] } : {},
      filters.premiumOnly ? { isPremium: true } : {},
    ],
  };
  return prisma.vendor.findMany({
    where,
    include: { images: { orderBy: { sortOrder: 'asc' }, take: 1 } },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
}

/** A vendor the caller may see (global, or their own private) + the caller's quote. */
export async function getVendorDetail(id: string, weddingId: string) {
  const vendor = await prisma.vendor.findFirst({
    where: { id, OR: [{ weddingId: null }, { weddingId }] },
    include: { images: { orderBy: { sortOrder: 'asc' } } },
  });
  if (!vendor) return null;
  const quote = await prisma.vendorQuote.findUnique({
    where: { weddingId_vendorId: { weddingId, vendorId: id } },
  });
  return { vendor, quote };
}

/** Rule-based matches from the GLOBAL catalog only (never private vendors). */
export async function getRecommendedVendors(
  wedding: { id: string; city: string | null; budgetTotal: number | null },
  opts: { category?: TaskCategory; limit?: number } = {},
) {
  const candidates = await prisma.vendor.findMany({
    where: { weddingId: null, active: true, ...(opts.category ? { category: opts.category } : {}) },
    include: { images: { orderBy: { sortOrder: 'asc' }, take: 1 } },
  });
  const ranked = recommendVendors(
    candidates.map(
      (v): RecommendCandidate => ({
        id: v.id, category: v.category, city: v.city,
        priceMin: v.priceMin, priceMax: v.priceMax,
        verified: v.verified, isPremium: v.isPremium, sortOrder: v.sortOrder,
      }),
    ),
    { category: opts.category, city: wedding.city, budgetFit: vendorBudgetFit(wedding) },
    opts.limit ?? 6,
  );
  const byId = new Map(candidates.map((v) => [v.id, v]));
  return ranked.map((r) => byId.get(r.id)!).filter(Boolean);
}

export function getWeddingQuotes(weddingId: string) {
  return prisma.vendorQuote.findMany({
    where: { weddingId },
    include: { vendor: { include: { images: { orderBy: { sortOrder: 'asc' }, take: 1 } } } },
    orderBy: { updatedAt: 'desc' },
  });
}
