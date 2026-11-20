type SavingsLine = {
  qty: number;
  unitPrice: number;
  lineTotal: number;
  snapshotBaseUnitPrice?: number | null;
  promoDiscountAmount?: number | null;
  isPromoGift?: boolean;
};

/** What the customer saved against original prices, split into sale discounts, the promo code and the code's free gift
 * (at its normal price) (spec section 9.2), in piastres. */
export function orderSavings(lines: SavingsLine[]): { saleCents: number; promoCents: number; giftCents: number } {
  let saleCents = 0;
  let promoCents = 0;
  let giftCents = 0;
  for (const line of lines) {
    if (line.isPromoGift) {
      giftCents += Math.round((line.snapshotBaseUnitPrice ?? 0) * 100) * line.qty;
      continue;
    }
    const originalCents = Math.round((line.snapshotBaseUnitPrice ?? line.unitPrice) * 100) * line.qty;
    const promo = Math.round((line.promoDiscountAmount ?? 0) * 100);
    promoCents += promo;
    saleCents += Math.max(0, originalCents - Math.round(line.lineTotal * 100) - promo);
  }
  return { saleCents, promoCents, giftCents };
}
