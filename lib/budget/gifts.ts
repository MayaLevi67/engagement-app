export interface GiftEstimate {
  estimatedGifts: number;
  delta: number | null;
}

/** estimatedGifts = avg × count; delta = estimatedGifts − budgetTotal (null if no budget). */
export function estimateGifts(input: {
  avgGiftPerGuest: number | null;
  guestCount: number | null;
  budgetTotal: number | null;
}): GiftEstimate {
  const avg = input.avgGiftPerGuest ?? 0;
  const count = input.guestCount ?? 0;
  const estimatedGifts = Math.max(0, Math.round(avg * count));
  const delta = input.budgetTotal == null ? null : estimatedGifts - input.budgetTotal;
  return { estimatedGifts, delta };
}
